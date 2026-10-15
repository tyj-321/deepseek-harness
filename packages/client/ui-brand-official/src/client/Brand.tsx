import { BrandWordmark, FishLogo } from '@deepseek-ai/dsh-client-ui-primitives'
import type { HeroBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { SidebarBrandMarkOwnerProps } from '@deepseek-ai/dsh-client-ui-sidebar/client'

type OfficialBrandMarkProps = HeroBrandMarkOwnerProps & SidebarBrandMarkOwnerProps

/**
 * Render the official mark with the presentation requested by its host surface.
 * @param props - Host-supplied mark presentation.
 * @returns the official whale mark.
 */
export function OfficialBrandMark({ size, className }: OfficialBrandMarkProps) {
  return <FishLogo size={size} className={className} />
}

/**
 * Render the hero brand mark: the product mascot image (served from the web
 * frontend dist root) at the host-requested square size.
 * @param props - Host-supplied mark presentation.
 * @returns the product mascot mark.
 */
export function HeroBrandMark({ size, className }: HeroBrandMarkOwnerProps) {
  let src = '/iscai-dsh/moren.png'
  try {
    const href = document.querySelector('link[rel="icon"][href]')?.getAttribute('href')
    if (href !== undefined && href !== null && href !== '') {
      src = new URL('moren.png', new URL(href, document.baseURI)).href
    }
  } catch {
    src = '/iscai-dsh/moren.png'
  }
  return <img src={src} alt="" width={size} height={size} className={className} />
}

/**
 * Render the official name artwork without its independently slotted mark.
 * @returns the official name wordmark.
 */
export function OfficialBrandName() {
  return <BrandWordmark includeMark={false} />
}
