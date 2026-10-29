import { Application, Point } from 'pixi.js';
import { Live2DModel, config as liveConfig } from 'pixi-live2d-display/cubism4';

liveConfig.logLevel=1;
const clamp=(n,lo,hi)=>Math.max(lo,Math.min(hi,n));

export async function createPet(view,modelURL,profile,state) {
  const app=new Application({width:300,height:300,backgroundAlpha:0,antialias:true,
    autoDensity:true,resolution:Math.min(devicePixelRatio||1,2),powerPreference:'low-power',
    preserveDrawingBuffer:false});
  app.ticker.maxFPS=30;
  app.view.setAttribute('aria-label','DS 鲸鱼娘，拖动换位置，右键打开菜单');
  app.view.setAttribute('role','img');
  let model;
  try {
    model=await Live2DModel.from(modelURL.href,{autoInteract:false,autoUpdate:false,motionPreload:'NONE'});
    app.stage.addChild(model);
    const internal=model.internalModel;
    const core=internal.coreModel;
    const raw=core.getModel();
    const defaults=Float32Array.from(raw.parameters.values);
    const known=new Set(raw.parameters.ids);
    const expressions=new Map(await Promise.all(profile.expressions.map(async entry=>{
      const response=await fetch(new URL(entry.File,modelURL));
      if(!response.ok)throw new Error(`Expression ${entry.Name}: ${response.status}`);
      return [entry.Name,await response.json()];
    })));
    let bounds;
    let lastTime=performance.now();
    const smooth=new Map();
    const snapshot={};

    // Keep the original motion/physics pipeline, substituting VTube Studio's
    // actual pointer mappings before physics, then applying stackable expressions.
    internal.updateFocus=()=>{};
    internal.updateNaturalMovements=(dt,now)=>{
      const delta=Math.min(dt/1000,.08);
      const rect=view.getBoundingClientRect();
      const pointer=state.tracking?state.pointer:null;
      const nx=pointer?clamp((pointer.x-(rect.left+rect.width*.5))/Math.max(rect.width*.9,100),-1,1):0;
      const ny=pointer?clamp(((rect.top+rect.height*.42)-pointer.y)/Math.max(rect.height*.9,100),-1,1):0;
      for(const mapping of profile.pointer_mappings){
        if(!known.has(mapping.id))continue;
        const axis=mapping.axis==='x'?nx:ny;
        const desired=axis*(axis<0?-mapping.minimum:mapping.maximum);
        const rate=1-Math.exp(-delta/(.035+mapping.smoothing*.006));
        const value=(smooth.get(mapping.id)||0)+(desired-(smooth.get(mapping.id)||0))*rate;
        smooth.set(mapping.id,value);core.setParameterValueById(mapping.id,value);snapshot[mapping.id]=value;
      }
      for(const eye of ['ParamEyeLOpen','ParamEyeROpen']){
        if(known.has(eye))core.setParameterValueById(eye,core.getParameterValueById(eye)*(profile.eye_open||1));
      }
      if(known.has('ParamBreath'))core.setParameterValueById('ParamBreath',.5+.25*Math.sin(now/3200));
      if(state.deskInput && state.pressing){
        if(known.has('pointZ'))core.setParameterValueById('pointZ',1);
        if(known.has('danbaoZ'))core.setParameterValueById('danbaoZ',1);
      }
      for(const name of state.active){
        for(const param of expressions.get(name)?.Parameters||[]){
          if(!known.has(param.Id))continue;
          if(param.Blend==='Multiply')core.multiplyParameterValueById(param.Id,param.Value);
          else if(param.Blend==='Overwrite')core.setParameterValueById(param.Id,param.Value);
          else core.addParameterValueById(param.Id,param.Value);
        }
      }
    };
    function measure(){
      let x0=Infinity,y0=Infinity,x1=-Infinity,y1=-Infinity;
      for(let i=0;i<raw.drawables.count;i++){
        if(raw.drawables.opacities[i]<.01)continue;
        const vertices=internal.getDrawableVertices(i);
        for(let v=0;v<vertices.length;v+=2){
          const p=internal.localTransform.apply(new Point(vertices[v],vertices[v+1]));
          x0=Math.min(x0,p.x);y0=Math.min(y0,p.y);x1=Math.max(x1,p.x);y1=Math.max(y1,p.y);
        }
      }
      bounds=Number.isFinite(x0)?{x:x0,y:y0,width:x1-x0,height:y1-y0}:{x:0,y:0,width:internal.width,height:internal.height};
    }
    // Initialize mesh opacities before fitting the visible half-body composition.
    internal.update(0,0);measure();
    function resize(width,height){
      app.renderer.resize(width,height);
      const scale=Math.min((width-24)/bounds.width,(height-26)/bounds.height);
      model.scale.set(scale);
      model.position.set(width/2-(bounds.x+bounds.width/2)*scale,height-8-(bounds.y+bounds.height)*scale);
      // Clip the canvas hit region to the model silhouette's rough convex hull.
      // Transparent corners then leave blog links and page scrolling accessible.
      const points=[];
      for(let i=0;i<raw.drawables.count;i++){
        if(raw.drawables.opacities[i]<.01)continue;
        const vertices=internal.getDrawableVertices(i);
        for(let j=0;j<vertices.length;j+=2){
          const p=internal.localTransform.apply(new Point(vertices[j],vertices[j+1]));
          points.push([p.x*scale+model.x,p.y*scale+model.y]);
        }
      }
      const polygon=hull(points);
      if(polygon.length>2){
        // Expand slightly to accommodate the head and hair as they move.
        const cx=width/2,cy=height/2;
        app.view.style.clipPath=`polygon(${polygon.map(([x,y])=>`${clamp(cx+(x-cx)*1.10,0,width)}px ${clamp(cy+(y-cy)*1.10,0,height)}px`).join(',')})`;
      }
    }
    app.ticker.add(()=>{
      const now=performance.now();model.update(Math.min(now-lastTime,80));lastTime=now;
    });
    if(new URLSearchParams(location.search).has('pet-debug')){
      internal.on('beforeModelUpdate',()=>{
        for(const id of ['ParamEyeBallX','ParamEyeBallY','ParamCheek17','jingyu']){
          if(known.has(id))snapshot[id]=core.getParameterValueById(id);
        }
      });
      app.view.petDiagnostics={
        snapshot:()=>({...snapshot}),
        stats:()=>({parameters:raw.parameters.count,drawables:raw.drawables.count,expressions:expressions.size,bounds}),
      };
    }
    view.append(app.view);resize(view.clientWidth||300,view.clientHeight||300);
    return {
      resize,
      refreshShape(){setTimeout(()=>{measure();resize(view.clientWidth,view.clientHeight);},100);},
      playAction:index=>model.motion('Action',index,3),
      reset(){
        internal.motionManager.stopAllMotions();
        raw.parameters.values.set(defaults);core.saveParameters();smooth.clear();
        setTimeout(()=>{measure();resize(view.clientWidth,view.clientHeight);},100);
      },
      setVisible(visible){if(visible){lastTime=performance.now();app.start();}else app.stop();},
      destroy(){app.destroy(true,{children:true,texture:true,baseTexture:true});},
    };
  }catch(error){app.destroy(true,{children:true,texture:true,baseTexture:true});throw error;}
}

function hull(points){
  points.sort((a,b)=>a[0]-b[0]||a[1]-b[1]);
  const cross=(o,a,b)=>(a[0]-o[0])*(b[1]-o[1])-(a[1]-o[1])*(b[0]-o[0]);
  const lower=[],upper=[];
  for(const p of points){while(lower.length>=2&&cross(lower[lower.length-2],lower[lower.length-1],p)<=0)lower.pop();lower.push(p);}
  for(let i=points.length-1;i>=0;i--){const p=points[i];while(upper.length>=2&&cross(upper[upper.length-2],upper[upper.length-1],p)<=0)upper.pop();upper.push(p);}
  lower.pop();upper.pop();return lower.concat(upper);
}
