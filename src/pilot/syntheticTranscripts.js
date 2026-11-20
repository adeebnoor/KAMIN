// Task 18 · the trial's synthetic transcript, loaded from a local fixture shipped with the site.
// Rows carry source 'demo', so the app labels them synthetic everywhere (provenance level "synthetic").
import fixture from './synthetic-transcripts.json' with { type: 'json' }

export const SYNTHETIC_TRANSCRIPTS = fixture.transcripts
export const DEFAULT_SYNTHETIC_ID = fixture.default

export function syntheticTranscript(id = DEFAULT_SYNTHETIC_ID) {
  const record = fixture.transcripts.find(item => item.id === id)
  if (!record) throw new Error('SYNTHETIC_TRANSCRIPT_NOT_FOUND')
  return { id: record.id, college: record.college, collegeRaw: record.collegeRaw ?? null, label: record.label, courses: record.courses.map(course => ({ code: course.code, name: { ...course.name }, grade: course.grade, source: 'demo' })) }
}
