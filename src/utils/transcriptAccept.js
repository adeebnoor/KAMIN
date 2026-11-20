// Task 21 · the file types the transcript picker offers (its `accept`). A file dropped on the upload
// area must match them too. Kept apart from transcript.js, which loads only when a file is read.
export const TRANSCRIPT_ACCEPT = '.pdf,image/png,image/jpeg,image/webp,.txt'

export function acceptsTranscriptFile(file, accept = TRANSCRIPT_ACCEPT) {
  if (!file) return false
  const name = String(file.name || '').toLowerCase(), type = String(file.type || '').toLowerCase()
  return accept.split(',').map(s => s.trim().toLowerCase()).some(rule => rule.startsWith('.') ? name.endsWith(rule) : type === rule)
}
