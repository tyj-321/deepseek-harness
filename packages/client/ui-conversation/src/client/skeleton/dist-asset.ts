/**
 * Resolve a file in the web frontend dist root.
 *
 * Relative `src` follows the current client route and 404s. The document icon
 * is always authored at that root (`/iscai-dsh/favicon-32.png`), so it is a
 * stable base. Invalid icon hrefs must not throw — a throw here whitescreens
 * the conversation column.
 * @param file - basename under the dist root, e.g. `moren.png`.
 * @returns an href the browser can fetch from any client route.
 */
export function distAsset(file: string): string {
  const fallback = `/iscai-dsh/${file}`
  try {
    const href = document.querySelector('link[rel="icon"][href]')?.getAttribute('href')
    if (href === undefined || href === null || href === '') return fallback
    return new URL(file, new URL(href, document.baseURI)).href
  } catch {
    return fallback
  }
}
