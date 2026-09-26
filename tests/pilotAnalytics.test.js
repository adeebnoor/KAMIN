import { describe, expect, it } from 'vitest'
import { PILOT_ANALYTICS_ENABLED, PILOT_EVENT_NAMES, submitPilotFeedback, trackPilotEvent } from '../src/utils/pilotAnalytics.js'

describe('pilot analytics privacy boundary',()=>{
  it('is disabled in the public default build',()=>{
    expect(PILOT_ANALYTICS_ENABLED).toBe(false)
  })

  it('allows only predefined content-free funnel events',()=>{
    expect(PILOT_EVENT_NAMES).toEqual(expect.arrayContaining(['landing','sample_report_viewed','upload_started','upload_completed','profile_completed','profile_returned_to']))
    expect(()=>trackPilotEvent('transcript_contents')).toThrow('PILOT_EVENT_NOT_ALLOWED')
  })

  it('requires separate explicit feedback consent',async()=>{
    await expect(submitPilotFeedback({text:'Useful pilot note',consent:false})).rejects.toThrow('FEEDBACK_CONSENT_REQUIRED')
  })
})
