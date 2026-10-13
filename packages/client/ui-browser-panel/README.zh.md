# @deepseek-ai/dsh-client-ui-browser-panel

[English](README.md) | 中文

内嵌浏览器面板插件：桌面壳的最右浏览器列、聊天内链接点击统一路由到的 `browserPanel` 服务，以及切换该列的侧边栏底部触发按钮。面板占用布局的 `browser` 槽位——与工具详情列并排的真实网格列，而非浮层——因此不会遮挡对话内容，列宽通过与详情列相同的拖拽手柄调整（约定范围 400–1200px，默认 560）。

在 Electron 桌面壳中，页面渲染在主进程的 `WebContentsView` 里——一个覆盖在面板主体区域上的顶层 WebContents，因此目标站点的 `frame-ancestors` CSP 对它不适用，禁止被 iframe 嵌入的内网平台也能加载。组件测量主体占位区域的矩形并通过 preload 桥上报，主进程据此摆放该视图。来宾页面的 `new-window` 事件会被拦截并改为在面板内导航，而不是弹出新窗口；关闭面板只是隐藏视图而不销毁 WebContents，cookie 与登录态跨开关保留。在纯 Web 部署中，面板降级为带沙箱的 `<iframe>`，当网站拒绝嵌入时提供外部浏览器打开的入口。头部包含地址栏（回车导航，裸域名自动补 `https://`）、刷新、外部打开按钮（存在桌面 preload 桥时走桥接）和关闭按钮。

`browserPanel` 服务（`ctx.browserPanel`）是跨插件门面：发布可观察的 `{ open, url }` 快照以及 `open(url)` / `close()` 操作，并通过 `ctx.layout`（`openBrowser` / `closeBrowser`）驱动列的开关。[ui-conversation](../ui-conversation/README.zh.md) 通过 `ctx.get` 读取它——遵循客户端 bundle 纯净门禁，绝不做值导入——并把聊天 Markdown 与 web 工具卡片中的所有 http(s) 链接路由到它；未组合该插件时回退到系统浏览器。正在生成的助手回复里一旦出现完整的 http(s) URL，也会无需点击就在面板中打开该地址；历史消息以及仍在流式尾部增长的 URL 不会自动打开。

`/client` 导出为插件主体（`apply`/`inject`）、服务门面（`IBrowserPanel`、`BrowserPanelController`）与语言键类型；面板与触发按钮组件保持在槽位注册之后，为包内私有。

Web iframe允许下载以支持静态页面导出CSV；页面响应可以施加更严格的沙箱限制。

## 模型体验

无，面板渲染的只是模型结果所链接的网页；此处不产生任何模型请求。

#### KV 缓存影响

无；本包既不组装也不发送 Provider 请求。

## 已知限制与延后工作

- **Web 部署的嵌入是尽力而为** —— `<iframe>` 降级无法加载发送 `X-Frame-Options`/`frame-ancestors` 的网站；加载失败浮层会提供外部浏览器打开入口。桌面壳（WebContentsView）没有此限制。
- **窄视口会自动收起该列** —— 让步链会先压缩再派生出零宽度以保证中间列可读；窗口重新拉宽后恢复偏好宽度。
