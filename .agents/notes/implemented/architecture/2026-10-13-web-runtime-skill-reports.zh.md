# Agent Note: Web运行时交付技能报表

Status: implemented

[English](2026-10-13-web-runtime-skill-reports.md) | 中文

## 问题

可选技能广场缺失或版本过旧时，生成的报表链接仍无法访问。Web应用与技能导入运行的环境必须具备报表交付能力。

## 决策

[Web运行时](../../../../packages/bundle/web-app/src/index.ts)通过effect注册并持有报表路由。[处理器](../../../../packages/bundle/web-app/src/reports.ts)只交付共享Harness主目录中发布的HTML。可选技能广场插件不再注册此路由。[同源链接决策](2026-10-13-same-origin-report-links.zh.md)继续规定Markdown导航和CSV下载行为。

## 考虑过的替代方案

要求安装技能广场会使基础报表交付依赖无关界面。另起预览监听端口需要逐个部署配置网络，且链接具有不同生命周期。

## 影响

Web profile无需安装技能广场或工具箱即可交付报表。包含同一路由的旧技能广场构建产物需要更新，避免重复注册。源码更新需要重新构建运行产物；技能与宿主仍须共享报表目录。现有Loader组合检查覆盖无技能广场时HTML交付、HEAD、方法拒绝以及查询快照不可访问。
