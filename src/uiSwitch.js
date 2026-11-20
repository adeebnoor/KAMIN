// Task 60 · which interface opens. Task 69: the new interface (src/ui2) is the default; the old one stays one
// release behind `?ui=old` (Task 70 deletes it). `?ui=old` opens the old interface and is remembered on this device
// (localStorage 'kamin-ui' = 'old'); `?ui=next` opens the new one and forgets that choice. Anything else (no value,
// an unknown value, the 'next' an earlier `?ui=next` left behind) opens the new interface. The choice is an interface
// preference, not personal data: "delete everything" keeps it, like the language ('kamin-lang', src/utils/dataControl.js).
// This file is in the startup bundle, so it stays tiny; everything in src/ui2 loads with import().
export const UI_KEY = 'kamin-ui'

const deviceStorage = () => { try { return globalThis.localStorage ?? null } catch { return null } }

// Returns 'next' or 'old'. `search` is location.search; `storage` is localStorage (or a stand-in in tests).
export function chooseUi(search = globalThis.location?.search ?? '', storage = deviceStorage()) {
  const asked = new URLSearchParams(search).get('ui')
  try {
    if (asked === 'old') storage?.setItem(UI_KEY, 'old')
    else if (asked === 'next') storage?.removeItem(UI_KEY)
  } catch { /* blocked storage: the address still decides for this page */ }
  if (asked === 'next' || asked === 'old') return asked
  try { return storage?.getItem(UI_KEY) === 'old' ? 'old' : 'next' } catch { return 'next' }
}
