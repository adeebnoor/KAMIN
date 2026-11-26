// Task 09 · navigation helpers for the old interface's four sections. Task 70: the old interface is deleted, and so are
// its helpers (openSection, openTab, openView, openPrivacySection, openAppWindow, loadSample, approveSample, openMatch,
// walkAppViews, APP_VIEWS, …). The specs reach the interface through e2e/roles.js. Only `settle` is shared.

// Wait until the fonts are loaded and the view has stopped changing height (lazy parts are in). Unchanged from the old
// interface's version (it watches .app-content-wrap when there is one), so the page-length numbers measured with it
// stay comparable.
export async function settle(page) {
  await page.evaluate(async () => {
    await document.fonts.ready
    const wrap = document.querySelector('.app-content-wrap')
    for (let i = 0, last = -1, same = 0; i < 40 && same < 3; i++) {
      await new Promise(resolve => setTimeout(resolve, 100))
      const height = wrap ? wrap.scrollHeight : 0
      same = height === last ? same + 1 : 0
      last = height
    }
  })
}
