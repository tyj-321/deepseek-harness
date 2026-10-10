// @vitest-environment jsdom
// Branch tails the acceptance specs do not reach: the node-half apply
// without a settings service and AssistantMarkdown reasoning/unknown block arms.

import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { cleanup, render } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { apply as nodeApply } from '../src/index.ts'
import { AssistantMarkdown, type AssistantMarkdownProps } from '../src/client/chat/AssistantMarkdown.tsx'
import { zh } from '../src/client/locales.ts'

// Mirrors the real lookup chain (conversation namespace, then common).
const t: AssistantMarkdownProps['t'] = makeTranslate(zh, commonZh)
const renderMessageImages: AssistantMarkdownProps['renderMessageImages'] = () => null

afterEach(cleanup)

describe('tails', () => {
  it('node-half apply tolerates a Host without settings', () => {
    expect(() => { nodeApply(new Context()) }).not.toThrow()
  })

  it('AssistantMarkdown renders reasoning as a Think row and unknown blocks as JSON fallback', () => {
    const view = render(
      <AssistantMarkdown
        t={t}
        blocks={[
          { kind: 'reasoning', text: 'thinking hard\nsecond line' },
          { kind: 'tool-call', callId: 'c', name: 'bash', argsRaw: '{}' },
          { kind: 'other', block: { type: 'mystery' } },
        ]}
        streaming
        renderMessageImages={renderMessageImages}
      />,
    )
    expect(view.getByText('Think')).toBeTruthy()
    expect(view.getByText('thinking hard')).toBeTruthy()
    expect(view.getByText(/未知内容块/)).toBeTruthy()
    const stopped = render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'text', text: 'partial words' }]}
        streaming={false}
        interrupted
        renderMessageImages={renderMessageImages}
      />,
    )
    expect(stopped.getByText('已停止')).toBeTruthy()
  })

  it('AssistantMarkdown skips the root shell when only tool-call heads remain', () => {
    // Tool heads are drawn by ChatView's tool groups; an empty root between
    // groups is layout noise (no text, no pulse, no interrupted marker).
    const empty = render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'tool-call', callId: 'c', name: 'todo_write', argsRaw: '{}' }]}
        streaming={false}
        renderMessageImages={renderMessageImages}
      />,
    )
    expect(empty.container.firstChild).toBeNull()
    const blank = render(
      <AssistantMarkdown t={t} blocks={[]} streaming={false} renderMessageImages={renderMessageImages} />,
    )
    expect(blank.container.firstChild).toBeNull()
  })

  it('auto-opens complete http(s) URLs only for a live assistant reply', () => {
    const openUrl = vi.fn<(url: string) => void>()
    render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'text', text: 'history https://old.example/app' }]}
        streaming={false}
        renderMessageImages={renderMessageImages}
        openUrl={openUrl}
      />,
    )
    expect(openUrl).not.toHaveBeenCalled()

    const live = render(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'text', text: 'open https://live.example/pa' }]}
        streaming
        renderMessageImages={renderMessageImages}
        openUrl={openUrl}
      />,
    )
    expect(openUrl).not.toHaveBeenCalled()
    live.rerender(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'text', text: 'open https://live.example/page now' }]}
        streaming
        renderMessageImages={renderMessageImages}
        openUrl={openUrl}
      />,
    )
    expect(openUrl).toHaveBeenCalledTimes(1)
    expect(openUrl).toHaveBeenCalledWith('https://live.example/page')
    live.rerender(
      <AssistantMarkdown
        t={t}
        blocks={[{ kind: 'text', text: 'open https://live.example/page now' }]}
        streaming={false}
        renderMessageImages={renderMessageImages}
        openUrl={openUrl}
      />,
    )
    expect(openUrl).toHaveBeenCalledTimes(1)
  })

  it('opens a tail URL when the live stream settles and ignores reasoning URLs', () => {
    const openUrl = vi.fn<(url: string) => void>()
    const view = render(
      <AssistantMarkdown
        t={t}
        blocks={[
          { kind: 'reasoning', text: 'maybe https://think.example' },
          { kind: 'text', text: 'https://done.example/home' },
        ]}
        streaming
        renderMessageImages={renderMessageImages}
        openUrl={openUrl}
      />,
    )
    expect(openUrl).not.toHaveBeenCalled()
    view.rerender(
      <AssistantMarkdown
        t={t}
        blocks={[
          { kind: 'reasoning', text: 'maybe https://think.example' },
          { kind: 'text', text: 'https://done.example/home' },
        ]}
        streaming={false}
        renderMessageImages={renderMessageImages}
        openUrl={openUrl}
      />,
    )
    expect(openUrl).toHaveBeenCalledTimes(1)
    expect(openUrl).toHaveBeenCalledWith('https://done.example/home')
  })

})
