# Agent Note：同源报表链接

Status: implemented

[English](2026-10-13-same-origin-report-links.md) | 中文

## 问题

在远程服务器运行的技能不能把服务器的回环地址用作用户浏览器的报表链接。Markdown中以单个斜杠开头的根相对链接需要使用浏览器当前源地址，才能访问已部署的Web服务。

## 决策

[Markdown渲染器](../../../../packages/client/ui-primitives/src/markdown/render.tsx)按当前HTTP(S)页面解析根相对链接，拒绝解析后跨源的目标。非根相对路径、协议相对链接、本地文件链接、不安全协议和相对图片保留原有拒绝行为。解析后的绝对URL使用现有内置浏览器打开能力。[浏览器面板](../../../../packages/client/ui-browser-panel/src/client/BrowserPanel.tsx)允许下载，使静态看板能够导出CSV。

## 考虑过的替代方案

在每份报表中嵌入服务器地址需要逐个环境配置，用户通过其他域名访问DSH时会失效。独立预览服务增加了部署环境可能没有开放的端口。

## 影响

自包含报表使用已部署DSH的当前源地址，无需模型编造主机名或新增监听端口。报表服务插件负责文件读取限制和响应隔离。针对性的Markdown测试验证同源解析、点击路由和协议相对链接拒绝；静态报表的HTTP和浏览器检查验证交付、筛选和CSV导出。
