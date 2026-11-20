// Task 69 · the new interface (src/ui2) is the default; the old one stays one release behind ?ui=old (Task 70 deletes
// it). The specs written for the old interface run on it from this one place: they import `test` and `expect` from
// here instead of '@playwright/test', and every page of their browser context opens the old interface.
//
// How: `?ui=old` leaves 'kamin-ui' = 'old' on the device (src/uiSwitch.js) and every later visit opens the old
// interface. The fixture puts that value into localStorage before any page script runs, on every page the test
// opens, so no address in those specs changes (e2e/history.spec.js compares addresses) and a spec that clears the
// device's storage still gets the old interface on its next page. "Delete everything" keeps 'kamin-ui' anyway
// (src/utils/dataControl.js, KEPT_INTERFACE_KEYS). e2e/next-shell.spec.js checks that ?ui=old itself does the same.
//
// The specs of the new interface (e2e/next-*.spec.js) import from '@playwright/test' and open the default.
// e2e/keep-features.spec.js runs every row on both interfaces, so it calls useOldInterface() for its 'old' runs.
import { test as base, expect } from '@playwright/test'
import { UI_KEY } from '../src/uiSwitch.js'

export const OLD_UI = Object.freeze({ key: UI_KEY, value: 'old' })

// Every page of `context` opens the old interface (as after ?ui=old).
export async function useOldInterface(context) {
  await context.addInitScript(({ key, value }) => {
    try { localStorage.setItem(key, value) } catch { /* about:blank and opaque origins have no storage */ }
  }, OLD_UI)
}

// `kaminUi`: 'old' (the default here) or 'new'. A block of an old spec that checks the new interface says
// test.use({ kaminUi: 'new' }) (e2e/page-length.spec.js: the new views' budgets).
export const test = base.extend({
  kaminUi: ['old', { option: true }],
  context: async ({ context, kaminUi }, use) => {
    if (kaminUi === 'old') await useOldInterface(context)
    await use(context)
  },
})
export { expect }
