/**
 * Complete http(s) URLs in live assistant prose, used to open the embedded
 * browser panel without a click. Historical messages never call this path;
 * callers skip auto-open unless the node was observed streaming.
 */

const HTTP_URL = /https?:\/\/[^\s<>"'`\]\)]+/gi
const TRAILING_PUNCT = /[.,;:!?。，；：！？]+$/

/** Drop GFM fenced code so example URLs inside fences never auto-open. */
function withoutFencedCode(text: string): string {
  const lines = text.split('\n')
  const out: string[] = []
  let fence: string | null = null
  for (const line of lines) {
    const marker = /^(```|~~~)/.exec(line)?.[1]
    if (fence === null) {
      if (marker !== undefined) {
        fence = marker
        out.push('')
        continue
      }
      out.push(line)
      continue
    }
    if (marker === fence) {
      fence = null
      out.push('')
      continue
    }
    out.push('')
  }
  return out.join('\n')
}

function isHttpUrl(value: string): boolean {
  try {
    new URL(value)
    return true
  } catch {
    return false
  }
}

function isMarkdownImageDestination(text: string, index: number): boolean {
  return /!\[[^\]]*\]\($/.test(text.slice(0, index))
}

/**
 * Latest complete http(s) URL in assistant prose.
 *
 * While `streaming` is true, a match at the very end of the text is still
 * growing and is ignored; a match followed by any later character is final.
 * Fenced-code contents and markdown image destinations are skipped.
 *
 * @param text - Concatenated assistant `text` blocks (not reasoning).
 * @param streaming - Whether the owning node is still receiving tokens.
 * @returns The last complete http(s) URL, or undefined when none is final.
 */
export function latestCompleteHttpUrl(text: string, streaming: boolean): string | undefined {
  const source = withoutFencedCode(text)
  let last: string | undefined
  HTTP_URL.lastIndex = 0
  let match: RegExpExecArray | null
  while ((match = HTTP_URL.exec(source)) !== null) {
    if (isMarkdownImageDestination(source, match.index)) continue
    const url = match[0].replace(TRAILING_PUNCT, '')
    if (!isHttpUrl(url)) continue
    const atStreamTail = streaming && match.index + match[0].length === source.length
    if (atStreamTail) continue
    last = url
  }
  return last
}
