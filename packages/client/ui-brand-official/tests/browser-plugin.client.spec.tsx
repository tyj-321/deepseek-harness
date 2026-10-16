// @vitest-environment jsdom
import { Context } from '@deepseek-ai/cordis'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanup, render } from '@testing-library/react'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { apply, inject } from '../src/client/index.ts'
import { HeroBrandMark, OfficialBrandMark, OfficialBrandName } from '../src/client/Brand.tsx'

afterEach(() => {
  cleanup()
  vi.unstubAllEnvs()
})

const HOLES = [
  'sidebar.brand.mark',
  'sidebar.brand.name',
  'conversation.hero.brand.mark',
] as const

async function bench(declare = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const slots = ctx.get('slots') as SlotRegistry
  const declareHoles = () => slots.register({
    name: 'root',
    children: Object.fromEntries(HOLES.map(name => [name, { kind: 'single', scope: 'root' }])),
  } as never, () => null)
  const disposeHoles = declare ? declareHoles() : undefined
  return { ctx, slots, declareHoles, disposeHoles }
}

describe('official browser-brand plugin', () => {
  it('declares only the slot service it uses', () => {
    expect(inject).toEqual(['slots'])
  })

  it('leaves every slot empty outside the official build profile', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'local')
    const subject = await bench()
    await subject.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(subject.slots.entries(hole)).toHaveLength(0)
  })

  it('fills declarations before or after apply and removes every occupant on teardown', async () => {
    vi.stubEnv('DSH_CLIENT_BUILD_PROFILE', 'official')
    const before = await bench()
    const fiber = before.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(1)

    before.disposeHoles?.()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(0)
    before.declareHoles()
    await Promise.resolve()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(1)

    await fiber.dispose()
    for (const hole of HOLES) expect(before.slots.entries(hole)).toHaveLength(0)

    const after = await bench(false)
    await after.ctx.plugin({ inject: [...inject], apply }).await()
    for (const hole of HOLES) expect(after.slots.entries(hole)).toHaveLength(0)
    after.declareHoles()
    await Promise.resolve()
    for (const hole of HOLES) expect(after.slots.entries(hole)).toHaveLength(1)
  })

  it('renders the product name and the robot mascot at both requested mark sizes', () => {
    const name = render(<OfficialBrandName />)
    expect(name.container.textContent).toBe('ISC 智能助手')
    name.unmount()

    const mark = render(<OfficialBrandMark size={34} className="hero-mark" />)
    const img = mark.container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('/iscai-dsh/moren.png')
    expect(img?.getAttribute('width')).toBe('34')
    expect(img?.getAttribute('class')).toBe('hero-mark')
    mark.rerender(<OfficialBrandMark size={24} />)
    expect(mark.container.querySelector('img')?.getAttribute('width')).toBe('24')
  })

  it('renders the hero mascot image at the requested size', () => {
    const view = render(<HeroBrandMark size={128} className="hero-mascot" />)
    const img = view.container.querySelector('img')
    expect(img?.getAttribute('src')).toBe('/iscai-dsh/moren.png')
    expect(img?.getAttribute('width')).toBe('128')
    expect(img?.getAttribute('class')).toBe('hero-mascot')
  })

  it('resolves the hero mascot against the document icon base path', () => {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.setAttribute('href', 'https://example.test/iscai-dsh/favicon-32.png')
    document.head.append(link)
    const view = render(<HeroBrandMark size={128} />)
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe(
      'https://example.test/iscai-dsh/moren.png',
    )
    link.remove()
  })

  it('falls back to the product dist path when the icon href is empty', () => {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.setAttribute('href', '')
    document.head.append(link)
    const view = render(<HeroBrandMark size={128} />)
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe('/iscai-dsh/moren.png')
    link.remove()
  })

  it('falls back to the product dist path when the icon href is not a URL', () => {
    const link = document.createElement('link')
    link.rel = 'icon'
    link.setAttribute('href', 'http://[')
    document.head.append(link)
    const view = render(<HeroBrandMark size={128} />)
    expect(view.container.querySelector('img')?.getAttribute('src')).toBe('/iscai-dsh/moren.png')
    link.remove()
  })
})
