/**
 * The page's fonts come from Google Fonts in a stylesheet that loads in the background (see index.html), so the page never waits for them.
 * Posters and clips are drawn on a canvas, where a font that has not arrived is silently replaced by a plain one; they call this first.
 */
export async function fontsReady(timeoutMs = 4000): Promise<void> {
  const link = document.querySelector<HTMLLinkElement>('link[href*="fonts.googleapis.com"][media]')
  if (link && link.media !== 'all') {
    await new Promise<void>(resolve => {
      const done = () => { window.clearTimeout(timer); resolve() }
      const timer = window.setTimeout(done, timeoutMs)
      link.addEventListener('load', done, { once: true })
    })
  }
}
