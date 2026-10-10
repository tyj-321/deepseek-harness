# Agent Note: Auto-open live assistant URLs in the embedded browser panel

Status: implemented

[English](2026-10-10-auto-open-assistant-url-in-browser-panel.md) | 中文

## Problem

聊天 Markdown 里被点击的 http(s) 链接已经通过 `openUrl` 路由到右侧内嵌浏览器面板（`@deepseek-ai/dsh-client-ui-browser-panel`）。但当助手回复把 URL 本身当作要访问的结果返回时，面板仍保持关闭，直到用户找到并点击该链接；典型的「这就是那个页面」一轮在模型已经给出目的地之后，还要多一次手势。

## Decision

`AssistantMarkdown` 观察正在生成的助手 `text` 块，并通过同一条注入的 `openUrl` 回调，在面板中打开最新的完整 http(s) URL。

节点只有在被观察到 `streaming: true` 之后才算 live。已经完整的历史消息在挂载时不会自动打开，因此翻看更早的轮次或重新打开会话都不会弹出面板。仍在接收 token 时，累积文本最末尾的匹配视为仍在增长并被忽略；后面还有任意字符的匹配，或流式结束后（含被中断的一轮）剩下的匹配，视为最终结果。围栏代码的内容与 Markdown 图片目标会被跳过，避免示例 `curl` URL 和 `![alt](…)` 资源去导航面板。不扫描 reasoning 块。以最新的完整 URL 为准；同一条回复里后出现的 URL 会替换先前的，同一 URL 不会打开两次。

## Alternatives considered

**对每条已结算的助手消息都自动打开，包括历史。** 否决：重新打开会话或滚入更早的页面会立刻加载旧轮次里碰巧包含的 URL，抢走该列并让读者感到意外。

**等整条回复结算后再打开。** 否决：后面已有正文跟上的 URL 已经完整，拖到最后一个 token 会给常见的「先给页面、再解释」形式增加延迟。

**解析 markdown AST，而不是扫描正文。** 否决：流式路径上未写完的 `[label](https://…` 尾巴还不是 link 节点，而扫描只需要 http(s) 目标、不需要渲染结构。围栏与图片排除已经覆盖 AST 会丢掉的那些误报。

**同样自动打开用户气泡里的 URL。** 否决：「对话返回了 URL」指的是助手回复，不是提出请求的提示词。

## Consequences

正在生成的助手回复一旦给出完整的 http(s) URL，就会无需点击打开浏览器列，沿用已有的 `browserPanel.open` / 系统浏览器回退。代价是一套偏保守的完整性启发式：内容只有一条 URL 的回复会等到流式结束才打开，未闭合围栏里的 URL 永远不会打开。

## Testing

`auto-open-url.client.spec.ts` 钉住抽取：已结算 vs 流式尾部、标点裁剪、多条取最新、围栏代码（已闭合与未闭合）、图片目标，以及非 http 协议。`coverage-tails.client.spec.tsx` 驱动 `AssistantMarkdown` 覆盖跳过历史、live 完整、不重复打开、在尾部结算，以及忽略 reasoning。`chat-view.client.spec.tsx` 检查组装后的聊天路径：历史助手 URL 保持关闭，随后流式 partial 在 URL 完整时打开一次。
