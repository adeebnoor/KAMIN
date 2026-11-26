// A capability's name in the student's language (Task 65; moved here from components/StepCard.jsx in Task 79 so that
// My plan's roadmap can name capabilities without importing step 4's card). StepCard.jsx re-exports it unchanged.
import { skills as catalog } from '../data.js'

const SKILLS = Object.values(catalog)
export const capabilityName = (id, lang) => SKILLS.find(skill => skill.id === id)?.labels[lang] || (id === 'cyber' ? { ar: 'الأمن السيبراني', en: 'Cybersecurity' }[lang] : id)
