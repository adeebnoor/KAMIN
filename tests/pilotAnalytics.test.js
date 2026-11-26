import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { PILOT_ANALYTICS_ENABLED, PILOT_EVENT_NAMES, trackPilotEvent } from '../src/utils/pilotAnalytics.js'
// Task 44: the form, the file and withdrawal moved to src/pilot/studyFile.js (out of the startup bundle).
import { saveStudyFeedback } from '../src/pilot/studyFile.js'
import { COUNT_EVENTS } from '../src/pilot/studyCounts.js'

const code = file => readFileSync(file, 'utf8').replace(/^\s*\/\/.*$/gm, '')

describe('pilot analytics privacy boundary',()=>{
  it('is disabled in the public default build',()=>{
    expect(PILOT_ANALYTICS_ENABLED).toBe(false)
  })

  it('allows only predefined content-free funnel events',()=>{
    expect(PILOT_EVENT_NAMES).toEqual(expect.arrayContaining(['landing','sample_report_viewed','upload_started','upload_completed','profile_completed','profile_returned_to']))
    expect(()=>trackPilotEvent('transcript_contents')).toThrow('PILOT_EVENT_NOT_ALLOWED')
  })

  // Task 18: submitPilotFeedback (which could POST) was replaced by the local study queue. Feedback
  // still needs its own explicit consent: the study consent, separate from using Kamin.
  it('requires separate explicit feedback consent',()=>{
    const empty={getItem:()=>null,setItem(){},removeItem(){}}
    expect(()=>saveStudyFeedback({comment:'Useful pilot note'},{storage:empty})).toThrow('STUDY_CONSENT_REQUIRED')
  })

  // Task 44: the suggestion counts and the study file load with the screens; the startup bundle keeps only the
  // record, the funnel events and clearing (228 KiB budget).
  it('the count events and the study file stay out of the startup modules', () => {
    for (const name of COUNT_EVENTS) expect(PILOT_EVENT_NAMES).not.toContain(name)
    for (const file of ['src/utils/pilotAnalytics.js', 'src/main.jsx', 'src/state/useKaminProfile.js', 'src/ui2/AppNext.jsx', 'src/components/privacy/DeleteSection.jsx'])
      expect(code(file), file).not.toMatch(/pilot\/study(File|Counts)/)
    expect(code('src/components/PilotStudy.jsx')).toContain("from '../pilot/studyFile.js'")
    for (const file of ['src/ui2/screens/Projects.jsx', 'src/ui2/screens/NextSteps.jsx', 'src/ui2/screens/Plan.jsx'])
      expect(code(file), file).toContain("from '../../pilot/studyCounts.js'")
    for (const file of ['src/pilot/studyFile.js', 'src/pilot/studyCounts.js'])
      expect(code(file), file).not.toMatch(/ENDPOINT|fetch\s*\(|sendBeacon|XMLHttpRequest/)
  })
})
