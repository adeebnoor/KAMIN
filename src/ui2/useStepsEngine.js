// Task 65 · loads src/ui2/stepsEngine.js on demand (the feed and the learning list) and keeps it for the page's life.
// The screen shows its skeleton until it is there; a failed load can be tried again on the next render.
import { useEffect, useState } from 'react'

let engine = null
let loading = null
export const loadStepsEngine = () => (loading ||= import('./stepsEngine.js').then(module => (engine = module)).catch(failure => { loading = null; throw failure }))

export function useStepsEngine() {
  const [loaded, setLoaded] = useState(engine)
  useEffect(() => {
    if (loaded) return undefined
    let live = true
    loadStepsEngine().then(module => { if (live) setLoaded(module) }).catch(() => {})
    return () => { live = false }
  }, [loaded])
  return loaded
}
