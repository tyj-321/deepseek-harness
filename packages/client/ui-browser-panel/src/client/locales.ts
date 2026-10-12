/** `browserPanel` namespace dictionaries. */

/** Dictionary namespace owned by this plugin. */
export const NS = 'browserPanel'

/** Simplified Chinese dictionary (the key-set source of truth). */
export const zh = {
  'panel.title': '预览面板',
  'panel.close': '关闭预览面板',
  'panel.refresh': '刷新页面',
  'panel.openExternal': '在外部浏览器打开',
  'panel.fullscreen': '全屏查看',
  'panel.exitFullscreen': '退出全屏',
  'panel.addressPlaceholder': '输入网址，回车访问',
  'panel.loading': '加载中…',
  'panel.loadFailed': '页面加载失败',
  'panel.loadFailedDetail': '该页面无法在内嵌浏览器中打开',
  'panel.empty': '点击聊天中的链接，或输入网址开始浏览',
  'sidebar.open': '打开预览面板',
} satisfies Record<string, string>

/** The browserPanel namespace key union. */
export type BrowserPanelKey = keyof typeof zh

/** English dictionary, checked complete against the zh key set. */
export const en = {
  'panel.title': 'Preview',
  'panel.close': 'Close preview panel',
  'panel.refresh': 'Reload page',
  'panel.openExternal': 'Open in external browser',
  'panel.fullscreen': 'View fullscreen',
  'panel.exitFullscreen': 'Exit fullscreen',
  'panel.addressPlaceholder': 'Enter a URL and press Enter',
  'panel.loading': 'Loading…',
  'panel.loadFailed': 'Page failed to load',
  'panel.loadFailedDetail': 'This page cannot be opened in the embedded browser',
  'panel.empty': 'Click a link in the chat, or enter a URL to start browsing',
  'sidebar.open': 'Open preview panel',
} satisfies Record<BrowserPanelKey, string>
