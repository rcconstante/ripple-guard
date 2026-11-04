import { view } from '@forge/bridge'

/**
 * Follows the Jira light/dark theme. Forge sets `data-color-mode` on <html>;
 * shadcn/ui tokens switch on the `.dark` class, so mirror one onto the other.
 */
export async function enableForgeTheme(): Promise<void> {
  const root = document.documentElement
  const sync = () => root.classList.toggle('dark', root.dataset.colorMode === 'dark')

  new MutationObserver(sync).observe(root, {
    attributes: true,
    attributeFilter: ['data-color-mode'],
  })

  try {
    await view.theme.enable()
  } catch {
    // Not inside an Atlassian product (for example, plain `vite` in a browser).
  }
  sync()
}
