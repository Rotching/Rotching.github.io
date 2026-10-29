# 小站的 Live2D 鲸鱼娘

博客页面通过 `_layouts/default.html` 中的 `_includes/live2d-pet.html` 接入桌宠。
独立预览页面为 `/assets/live2d-pet/demo.html`。

## 使用

- 在页面内移动鼠标：眼睛、头部随光标转动，保留模型物理效果及自动眨眼。
- 左键或触摸拖动模型：移动位置。
- 在模型上滚动鼠标滚轮，或点击下方 `− / +`：调整大小。
- 右键模型或点击 `⋯`：打开表情、配件、动作和设置。
- 配件可以叠加；主要面部表情互斥，避免多种眼睛状态冲突。
- 点击 `⌄` 收起，右下角 `🐳` 可以叫回。收起时停止渲染，刷新后也不会加载模型，直到再次展开。
- 位置、大小、鼠控开关记在访客自己的浏览器中。设置页可恢复位置和大小；“恢复默认造型”清除表情、配件与动作姿态。

网页只能追踪当前页面内的光标。离开页面或切到别的窗口后回到中立视线；不能追踪 Windows 桌面，也不能作为跨网站悬浮窗。
此版本没有聊天、后端或 API 密钥。浏览器需要支持 WebGL；模型加载失败时，可以从菜单重试。

## 全站默认大小和开关

编辑 `_config.yml`：

```yaml
live2d_pet:
  enabled: true
  size: 300
```

大小以像素为单位，访客自己调整的大小优先于默认值。设 `enabled: false` 后重新部署即可全站关闭。

## 替换自己的模型

1. 准备可运行的 Live2D Cubism 模型：`.model3.json`、`.moc3`、纹理图片，以及模型引用的物理、表情、动作文件。单张 AI 图片不能直接替换这些文件，需要先拆图、绑定并导出 Cubism 模型。
2. 将整个模型目录放进 `assets/live2d-pet/models/你的模型/`，保留所有相对路径和文件名大小写。
3. 修改 `assets/live2d-pet/pet-config.json` 的 `model`，指向新的 `.model3.json`。
4. 根据新模型生成或修改 `profile.json`。`expressions` 对应模型 `FileReferences.Expressions`，`motions` 对应 `FileReferences.Motions.Action`。没有表情或动作时用空数组。自定义动作若使用其他组名，需要改为 `Action`，或同步修改 `tools/live2d/runtime.js` 中的组名。
5. `pointer_mappings` 是鼠控参数映射。通用模型通常有 `ParamAngleX/Y/Z`、`ParamEyeBallX/Y`；各参数的正负范围应按自己的模型设置。不存在的参数会跳过。当前鲸鱼娘还保留了画笔和蛋包饭的专用映射。
6. 更新菜单署名及 `assets/live2d-pet/CREDITS.md` 中的作者、模型许可，然后部署。若浏览器保留了旧位置或大小，点“恢复位置与大小”。

例如没有配件和动作的普通模型，可以使用：

```json
{
  "name": "我的模型",
  "eye_open": 1,
  "pointer_mappings": [
    {"id":"ParamAngleX","axis":"x","minimum":-30,"maximum":30,"smoothing":30},
    {"id":"ParamAngleY","axis":"y","minimum":-30,"maximum":30,"smoothing":30},
    {"id":"ParamEyeBallX","axis":"x","minimum":-1,"maximum":1,"smoothing":0},
    {"id":"ParamEyeBallY","axis":"y","minimum":-1,"maximum":1,"smoothing":0}
  ],
  "expressions": [],
  "motions": []
}
```

## 修改网页播放器

预编译的播放器及模型都在 `assets/live2d-pet/`，GitHub Pages 部署不需要 Node，也不需要 Godot。
源码在 `tools/live2d/`。只有修改源码时才需要重新构建：

```sh
cd tools/live2d
npm ci
npm run build
```

把源码和生成的 `assets/live2d-pet/pet.js`、`runtime.js`、许可证注释一起提交。修改播放器后，可以同步递增 `_includes/live2d-pet.html` 的 `?v=`，便于浏览器更新。
在仓库根目录启动 `python -m http.server 8787`，访问 `http://localhost:8787/assets/live2d-pet/demo.html`，即可单独测试桌宠；不能直接双击 HTML 使用 `file://` 打开。

播放器通过 Shadow DOM 隔离博客样式，模型/Core 延迟加载，渲染限制为 30 FPS，页面隐藏时暂停。Core 由 Live2D 官方域名加载，因此首次打开需要网络；本仓库不分发 Core 文件。

## 模型署名

当前模型制作：B站 **@氵六青（11272072）**；形象版权所有 **@上善无形、@ZipZipPin**。
模型采用 **CC BY-NC-SA 4.0**。原作者完整使用须知在 `assets/live2d-pet/licenses/DS-model-notice.txt`；网页菜单也保留了署名和许可入口。

博客原模板遗留的 `CNAME`（`huangxuan.me`）已移除，`_config.yml` 的站点地址已设为 `https://rotching.github.io`。
