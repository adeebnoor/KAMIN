// Task 79 · loads the roadmap data (src/catalog/roadmaps.json) on demand and keeps it for the page's life, like
// useStepsEngine.js. It is a file of this site (a lazy chunk), never a request to another site; the screen shows a
// skeleton until it is there, and a failed load can be tried again on the next render.
import { useEffect, useState } from 'react'

let data = null
let loading = null
export const loadRoadmaps = () => (loading ||= import('../catalog/roadmaps.json').then(module => (data = module.default || module)).catch(failure => { loading = null; throw failure }))

export function useRoadmaps(wanted = true) {
  const [loaded, setLoaded] = useState(data)
  useEffect(() => {
    if (loaded || !wanted) return undefined
    let live = true
    loadRoadmaps().then(module => { if (live) setLoaded(module) }).catch(() => {})
    return () => { live = false }
  }, [loaded, wanted])
  return loaded
}
