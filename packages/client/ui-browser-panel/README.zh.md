# @deepseek-ai/dsh-client-ui-browser-panel

[English](README.md) | 中文

内嵌浏览器面板插件：桌面壳的最右浏览器列、聊天内链接点击统一路由到的 `browserPanel` 服务，以及切换该列的侧边栏底部触发按钮。面板占用布局的 `browser` 槽位——与工具详情列并排的真实网格列，而非浮层——因此不会遮挡对话内容，列宽通过与详情列相同的拖拽手柄调整（约定范围 400–1200px，默认 560）。

在 Electron 桌面壳中，页面通过 `<webview>` 来宾页面渲染（桌面应用已启用 `webviewTag`），禁止 iframe 嵌入的网站也能加载；来宾页面的 `new-window` 事件会被拦截并改为在面板内导航，而不是弹出新窗口。在纯 Web 部署中，面板降级为带沙箱的 `<iframe>`，当网站拒绝嵌入时提供外部浏览器打开的入口。头部包含地址栏（回车导航，裸域名自动补 `https://`）、刷新、外部打开按钮（存在桌面 preload 桥时走桥接）和关闭按钮。

`browserPanel` 服务（`ctx.browserPanel`）是跨插件门面：发布可观察的 `{ open, url }` 快照以及 `open(url)` / `close()` 操作，并通过 `ctx.layout`（`openBrowser` / `closeBrowser`）驱动列的开关。[ui-conversation](../ui-conversation/README.zh.md) 通过 `ctx.get` 读取它——遵循客户端 bundle 纯净门禁，绝不做值导入——并把聊天 Markdown 与 web 工具卡片中的所有 http(s) 链接路由到它；未组合该插件时回退到系统浏览器。

`/client` 导出为插件主体（`apply`/`inject`）、服务门面（`IBrowserPanel`、`BrowserPanelController`）与语言键类型；面板与触发按钮组件保持在槽位注册之后，为包内私有。

## 模型体验

无，面板渲染的只是模型结果所链接的网页；此处不产生任何模型请求。

#### KV 缓存影响

无；本包既不组装也不发送 Provider 请求。

## 已知限制与延后工作

- **Web 部署的嵌入是尽力而为** —— `<iframe>` 降级无法加载发送 `X-Frame-Options`/`frame-ancestors` 的网站；加载失败浮层会提供外部浏览器打开入口。
- **窄视口会自动收起该列** —— 让步链会先压缩再派生出零宽度以保证中间列可读；窗口重新拉宽后恢复偏好宽度。
