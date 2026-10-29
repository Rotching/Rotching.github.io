import css from './pet.css';

// A tiny shell loads the renderer only after the official Cubism Core is ready.
const script = document.currentScript;
const base = new URL('.', script.src);
const key = 'rotching.live2d-pet.v1';
const clamp = (n, lo, hi) => Math.max(lo, Math.min(hi, n));
const faces = new Set(['悲伤','星星眼','爱心眼','呆呆眼','闭眼口水','哭','开心兴奋','晕晕','生气','调皮','吐舌']);
const faceExtras = new Set(['阴暗','脸红','流汗','问号','感叹号','吐魂','love']);
const names = {aidale:'重锤出击',chuipaopao:'吹泡泡糖'};
let saved = {};
try { saved = JSON.parse(localStorage.getItem(key) || '{}') || {}; } catch { /* Storage can be unavailable. */ }
const state = {
  size: clamp(Number(saved.size) || Number(script.dataset.size) || 300, 180, 520),
  x: Number.isFinite(saved.x) ? saved.x : null, y: Number.isFinite(saved.y) ? saved.y : null,
  hidden: saved.hidden === true, tracking: saved.tracking !== false,
  deskInput: saved.deskInput === true, active: new Set(), pointer: null, pressing: false,
};
let host, root, runtime, loading, failed = false, profile, config, toastTimer;
let tab = 'face';
const persist = () => {
  try { localStorage.setItem(key, JSON.stringify({size:state.size,x:state.x,y:state.y,hidden:state.hidden,tracking:state.tracking,deskInput:state.deskInput})); } catch { /* Keep working without persistence. */ }
};

function makeButton(label, title, action) {
  const button = document.createElement('button');
  button.type = 'button'; button.textContent = label; button.title = title;
  button.setAttribute('aria-label', title); button.addEventListener('click', action);
  return button;
}
function toast(message, duration=2600) {
  const hint = root.querySelector('.hint');
  hint.textContent = message; hint.hidden = false;
  clearTimeout(toastTimer); toastTimer = setTimeout(() => hint.hidden = true, duration);
}
function closePanel() {
  root.querySelector('.panel').hidden = true;
  root.querySelector('[data-menu]').setAttribute('aria-expanded', 'false');
}
function layout() {
  const width = Math.min(state.size, innerWidth - 20, Math.max(150, innerHeight - 80));
  host.style.width = `${width}px`;
  const height = width + 36;
  const x = clamp(state.x ?? innerWidth - width - 18, 8, Math.max(8, innerWidth-width-8));
  const y = clamp(state.y ?? innerHeight - height - 12, 8, Math.max(8, innerHeight-height-8));
  host.style.left = `${x}px`; host.style.top = `${y}px`;
  runtime?.resize(width, width);
  positionPanel();
}
function positionPanel() {
  const panel=root.querySelector('.panel');
  if(panel.hidden)return;
  const rect=host.getBoundingClientRect();
  const pw=Math.min(340,innerWidth-24),ph=panel.getBoundingClientRect().height;
  panel.style.left=`${clamp(rect.right-pw,12,innerWidth-pw-12)}px`;
  panel.style.top=`${clamp(rect.top-ph-8,12,Math.max(12,innerHeight-ph-12))}px`;
}
function changeSize(amount) {
  const before = host.getBoundingClientRect();
  state.size = clamp(state.size + amount, 180, 520);
  if (state.x !== null) state.x = before.right - Math.min(state.size, innerWidth-20);
  if (state.y !== null) state.y = before.bottom - Math.min(state.size, innerWidth-20) - 36;
  layout(); persist();
  const slider = root.querySelector('[data-size]'); if (slider) slider.value = state.size;
  const output = root.querySelector('output'); if (output) output.textContent = `${state.size}px`;
}
function visibility() {
  root.querySelector('.pet').hidden = state.hidden;
  root.querySelector('.wake').hidden = !state.hidden;
  runtime?.setVisible(!state.hidden && !document.hidden);
  if (state.hidden) closePanel();
  persist();
}
function toggleExpression(name) {
  if (state.active.has(name)) state.active.delete(name);
  else {
    if (faces.has(name)) for (const face of faces) state.active.delete(face);
    state.active.add(name);
  }
  runtime.refreshShape();
  renderChoices();
}
function renderChoices() {
  const target = root.querySelector('[data-content]'); target.replaceChildren();
  for (const button of root.querySelectorAll('[role=tab]')) {
    button.setAttribute('aria-selected', String(button.dataset.tab === tab));
  }
  if (!profile) {
    const p = document.createElement('p'); p.className='empty';
    p.textContent = failed ? '暂时没有连接上模型。点击下方按钮重试。' : '正在请鲸鱼娘过来…'; target.append(p);
    if (failed) target.append(makeButton('重新加载','重新加载桌宠',() => { loading=null; start(); }));
    positionPanel();return;
  }
  if (tab === 'settings') {
    const row = document.createElement('div'); row.className='row';
    const label=document.createElement('label');label.textContent='大小'; label.htmlFor='pet-size';
    const slider = document.createElement('input');slider.type='range';slider.id='pet-size';slider.min=180;slider.max=520;slider.step=10;slider.value=state.size;slider.dataset.size='';
    const output=document.createElement('output');output.textContent=`${state.size}px`;
    slider.addEventListener('input',()=>changeSize(Number(slider.value)-state.size));row.append(label,slider,output);target.append(row);
    for (const [setting,text] of [['tracking','目光跟随页面内的鼠标'],['deskInput','按住模型时动笔／挤番茄酱']]) {
      const label=document.createElement('label');label.className='setting';
      const input=document.createElement('input');input.type='checkbox';input.checked=state[setting];input.dataset.setting=setting;
      input.addEventListener('change',()=>{state[setting]=input.checked;persist();});label.append(input,document.createTextNode(text));target.append(label);
    }
    const reset=makeButton('恢复位置与大小','恢复位置与大小',()=>{
      state.x=null;state.y=null;state.size=Number(config?.size)||300;layout();persist();renderChoices();
    });reset.className='reset';target.append(reset);
  } else {
    const choices=document.createElement('div');choices.className='choices';
    if (tab==='actions') {
      profile.motions.forEach((motion,index)=>{
        const filename=motion.File.split('/').pop().replace('.motion3.json','');
        const title=names[filename] || filename;
        const button=makeButton(title,`播放${title}`,async()=>{
          button.disabled=true;
          try {
            if(filename==='番茄酱') {state.active.add('蛋包饭');runtime.refreshShape();}
            const ok=await runtime.playAction(index);
            if(!ok) toast('动作正在准备，请稍后再试');
            else toast(title.includes('自拍')?'自拍动作；可以先播放「开盖」':title);
          } catch(error) {console.error('[Live2D pet]',error);toast('这个动作暂时没准备好');}
          finally {button.disabled=false;}
        });choices.append(button);
      });
    } else {
      for (const entry of profile.expressions) {
        const isFace=faces.has(entry.Name)||faceExtras.has(entry.Name);
        if ((tab==='face')!==isFace) continue;
        const button=makeButton(entry.Name,entry.Name,()=>toggleExpression(entry.Name));
        button.setAttribute('aria-pressed',String(state.active.has(entry.Name)));choices.append(button);
      }
    }
    target.append(choices);
  }
  const clear=makeButton('恢复默认造型','恢复默认造型',()=>{
    state.active.clear();runtime.reset();renderChoices();toast('恢复默认啦');
  });clear.className='reset';target.append(clear);
  positionPanel();
}

function loadCore() {
  if (window.Live2DCubismCore) return Promise.resolve();
  return new Promise((resolve,reject)=>{
    const core=document.createElement('script');
    core.src='https://cubism.live2d.com/sdk-web/core/05/live2dcubismcore.min.js';
    core.crossOrigin='anonymous';core.async=true;
    const timeout=setTimeout(()=>{core.remove();reject(new Error('Cubism Core connection timed out'));},20000);
    core.onload=()=>{clearTimeout(timeout);resolve();};
    core.onerror=()=>{clearTimeout(timeout);core.remove();reject(new Error('Cubism Core could not be loaded'));};
    document.head.append(core);
  });
}
async function start() {
  if (loading) return loading;
  failed=false;
  loading=(async()=>{
    try {
      toast('鲸鱼娘正在来你的小站…',25000);
      const response=await fetch(new URL('pet-config.json',base));
      if(!response.ok)throw new Error(`Pet config: ${response.status}`);
      config=await response.json();
      const modelURL=new URL(config.model,base);
      const profileResponse=await fetch(new URL(config.profile,base));
      if(!profileResponse.ok)throw new Error(`Pet profile: ${profileResponse.status}`);
      const candidate=await profileResponse.json();
      await loadCore();
      const {createPet}=await import(new URL('runtime.js',base).href);
      runtime=await createPet(root.querySelector('.view'),modelURL,candidate,state);
      profile=candidate;host.dataset.ready='true';
      layout();visibility();renderChoices();
      toast('拖动我换位置 · 滚轮缩放 · 右键换装',4500);
    } catch(error) {
      failed=true;loading=null;runtime?.destroy();runtime=null;profile=null;
      host.dataset.ready='error';console.error('[Live2D pet]',error);
      toast('鲸鱼娘暂时没连上，点「⋯」重试',8000);renderChoices();
    }
  })();
  return loading;
}

function mount() {
  if(document.getElementById('rotching-live2d-pet'))return;
  host=document.createElement('aside');host.id='rotching-live2d-pet';host.setAttribute('aria-label','DS 鲸鱼娘桌宠');
  root=host.attachShadow({mode:'open'});
  root.innerHTML=`<style>${css}</style><div class="pet"><div class="view" aria-label="可拖动的 Live2D 模型"></div><div class="bar"></div><div class="hint" role="status" aria-live="polite" hidden></div></div><section class="panel" aria-label="桌宠设置" hidden><div class="heading"><strong>鲸鱼娘的小角落</strong></div><div class="tabs" role="tablist" aria-label="桌宠菜单"></div><div data-content></div><p class="fine">模型制作：<a href="https://space.bilibili.com/11272072" target="_blank" rel="noopener noreferrer">氵六青</a><br>形象：上善无形、ZipZipPin · <a href="https://creativecommons.org/licenses/by-nc-sa/4.0/deed.zh" target="_blank" rel="noopener noreferrer">CC BY-NC-SA 4.0</a><br><a class="credits" target="_blank" rel="noopener noreferrer">模型与运行库说明</a></p></section>`;
  root.querySelector('.credits').href=new URL('CREDITS.md',base).href;
  const bar=root.querySelector('.bar');
  const menu=makeButton('⋯','打开桌宠菜单',()=>{
    const panel=root.querySelector('.panel');panel.hidden=!panel.hidden;
    menu.setAttribute('aria-expanded',String(!panel.hidden));layout();
    if(!panel.hidden)renderChoices();
  });menu.dataset.menu='';menu.setAttribute('aria-expanded','false');
  bar.append(makeButton('−','缩小桌宠',()=>changeSize(-20)),menu,makeButton('+','放大桌宠',()=>changeSize(20)),makeButton('⌄','收起桌宠',()=>{state.hidden=true;visibility();}));
  root.querySelector('.heading').append(makeButton('×','关闭桌宠菜单',closePanel));
  const tabs=root.querySelector('.tabs');
  for(const [id,text] of [['face','表情'],['accessory','配件'],['actions','动作'],['settings','设置']]){
    const button=makeButton(text,text,()=>{tab=id;renderChoices();});button.dataset.tab=id;button.setAttribute('role','tab');tabs.append(button);
  }
  const wake=makeButton('🐳','叫回鲸鱼娘',()=>{state.hidden=false;visibility();layout();start();});wake.className='wake';root.append(wake);
  document.body.append(host);layout();visibility();renderChoices();
  const view=root.querySelector('.view');let drag;
  view.addEventListener('pointerdown',event=>{
    if(event.button!==0)return;
    const rect=host.getBoundingClientRect();drag={id:event.pointerId,x:event.clientX,y:event.clientY,left:rect.left,top:rect.top,moved:false};state.pressing=true;
    view.setPointerCapture(event.pointerId);
  });
  view.addEventListener('pointermove',event=>{
    if(!drag || drag.id!==event.pointerId)return;
    if(Math.hypot(event.clientX-drag.x,event.clientY-drag.y)>5)drag.moved=true;
    if(drag.moved){state.x=drag.left+event.clientX-drag.x;state.y=drag.top+event.clientY-drag.y;layout();}
  });
  const endDrag=()=>{if(drag){drag=null;state.pressing=false;persist();}};
  view.addEventListener('pointerup',endDrag);view.addEventListener('pointercancel',endDrag);view.addEventListener('lostpointercapture',endDrag);
  view.addEventListener('contextmenu',event=>{event.preventDefault();menu.click();});
  view.addEventListener('wheel',event=>{event.preventDefault();changeSize(event.deltaY<0?20:-20);},{passive:false});
  document.addEventListener('pointermove',event=>{if(event.pointerType!=='touch')state.pointer={x:event.clientX,y:event.clientY};},{passive:true});
  document.documentElement.addEventListener('pointerleave',()=>{state.pointer=null;});
  window.addEventListener('blur',()=>{state.pointer=null;endDrag();});
  window.addEventListener('resize',()=>{layout();persist();});
  document.addEventListener('visibilitychange',()=>runtime?.setVisible(!state.hidden&&!document.hidden));
  document.addEventListener('pointerdown',event=>{if(!event.composedPath().includes(host))closePanel();},{passive:true});
  root.addEventListener('keydown',event=>{if(event.key==='Escape')closePanel();});
  if(!state.hidden)start();
}
if(document.readyState==='loading')document.addEventListener('DOMContentLoaded',mount,{once:true});else mount();
