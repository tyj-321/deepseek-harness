# Agent Note: Windows 插件路径参数

Status: implemented

[English](2026-10-13-windows-plugin-path-arguments.md) | 中文

## 问题

Windows 通过 cmd.exe 调用 pnpm 命令垫片。Node 将 shell 参数用空格连接而不加引号，因此含空格或命令分隔符的插件路径可能作为多个参数传给 pnpm。

## 决策

[插件启动器](../../../../apps/cli/src/plugin.ts)先把本地路径参数定位到调用目录，再为含空白或 cmd.exe 分隔符的 shell 参数加引号。POSIX 继续不经 shell 传递参数数组。只有 pnpm 成功后才协调 profile 的插件列表。

## 考虑过的替代方案

改变安装目录会排除已有的合法插件路径。对 POSIX 参数应用 Windows 引号会让引号成为包路径的一部分。

## 影响

即使插件目录含空格和与号，本地 link 参数仍作为一个 pnpm 参数传递。构建版 CLI 的验收测试通过 profile 命令安装和删除这类本地插件包。
