import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Resolve the product mascot URL against the document icon's base path, so a
 * web base-path deployment (the favicon carries it) serves the image from the
 * same root instead of the domain root.
 */
export function mascotUrl(): string {
  try {
    const href = document.querySelector('link[rel="icon"][href]')?.getAttribute('href')
    if (href !== undefined && href !== null && href !== '') {
      return new URL('moren.png', new URL(href, document.baseURI)).href
    }
  } catch {
    // fall through to the product dist path
  }
  return '/iscai-dsh/moren.png'
}

/**
 * Render the official mark with the presentation requested by its host surface.
 * The product robot mascot replaces the upstream whale everywhere the mark
 * appears (sidebar brand row, collapsed rail, hero).
 * @param props - Host-supplied mark presentation.
 * @returns the product mascot mark.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return <img src={mascotUrl()} alt="" width={size} height={size} className={className} />
}

/**
 * Render the hero brand mark: the product mascot image (served from the web
 * frontend dist root) at the host-requested square size.
 * @param props - Host-supplied mark presentation.
 * @returns the product mascot mark.
 */
export function HeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  return <img src={mascotUrl()} alt="" width={size} height={size} className={className} />
}

/**
 * Render the product name as plain text (the sidebar brand-name seat styles
 * it); the upstream wordmark svg is retired with the whale.
 * @returns the product name.
 */
export function OfficialBrandName() {
  return <>ISC 智能助手</>
}
