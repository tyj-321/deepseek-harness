import { describe, expect, it } from 'vitest'
import { latestCompleteHttpUrl } from '../src/client/chat/auto-open-url.ts'

describe('latestCompleteHttpUrl', () => {
  it('returns undefined when the prose has no http(s) URL', () => {
    expect(latestCompleteHttpUrl('no link here', false)).toBeUndefined()
    expect(latestCompleteHttpUrl('see mailto:ops@example.com', false)).toBeUndefined()
  })

  it('returns a settled bare URL, including one at the end of the text', () => {
    expect(latestCompleteHttpUrl('open https://example.com/app', false))
      .toBe('https://example.com/app')
    expect(latestCompleteHttpUrl('https://example.com', false)).toBe('https://example.com')
    expect(latestCompleteHttpUrl('http://intranet.local/app', false)).toBe('http://intranet.local/app')
  })

  it('ignores a URL still growing at the streaming tail', () => {
    expect(latestCompleteHttpUrl('open https://example.com/pa', true)).toBeUndefined()
    expect(latestCompleteHttpUrl('open https://example.com/page now', true))
      .toBe('https://example.com/page')
  })

  it('strips trailing sentence punctuation from the match', () => {
    expect(latestCompleteHttpUrl('see https://example.com.', false)).toBe('https://example.com')
    expect(latestCompleteHttpUrl('见 https://example.com。', false)).toBe('https://example.com')
  })

  it('returns the latest complete URL when several are present', () => {
    expect(latestCompleteHttpUrl(
      'overview https://a.example/x then https://b.example/y',
      false,
    )).toBe('https://b.example/y')
  })

  it('skips fenced-code example URLs, including an unclosed streaming fence', () => {
    expect(latestCompleteHttpUrl('```\ncurl https://api.example/v1\n```', false))
      .toBeUndefined()
    expect(latestCompleteHttpUrl('~~~bash\nhttps://api.example/v1\n~~~', false))
      .toBeUndefined()
    expect(latestCompleteHttpUrl('prose https://ok.example\n```\nhttps://code.example', true))
      .toBe('https://ok.example')
    expect(latestCompleteHttpUrl('```\n~~~\nhttps://no.example\n```', false)).toBeUndefined()
  })

  it('skips markdown image destinations but keeps ordinary links', () => {
    expect(latestCompleteHttpUrl('![alt](https://cdn.example/pic.png)', false))
      .toBeUndefined()
    expect(latestCompleteHttpUrl('[open](https://app.example/home)', false))
      .toBe('https://app.example/home')
  })

  it('ignores a match that is not a parseable http(s) URL after punctuation trim', () => {
    expect(latestCompleteHttpUrl('https://.', false)).toBeUndefined()
  })
})
