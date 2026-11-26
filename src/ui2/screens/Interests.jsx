// Task 64 · step 3 of 4: your interests, as quick chips plus your own words. Loads on its own (lazy, from AppNext.jsx).
// First the interests consent, word for word (src/i18n.js screens.insight.consent, the approved sentence), shown
// once: nothing is saved before it is ticked, and until then the chips and the text box are disabled and say why.
// Then two rows of chips with today's options and ids (src/insight.js: the six interest areas and the six work
// values; Task 78: up to 3 choices per question, a second tap removes one, a 4th does nothing and the hint says so), and "Something else?": a sentence in the student's
// own words (3–500 characters). Add loads the local engine (src/interests/freeText.js, Task 56; a skeleton shows
// while it loads, nothing leaves the browser) and shows a card with the sentence and the chips KAMIN understood,
// each removable; the sentence can be edited or deleted (Undo in the one message, Task 25).
// An interest is a goal signal, never evidence: no capability or level reads it ("Your words guide your
// suggestions; they are never counted as evidence."). Next and "Skip for now" both open step 4.
// The digital-interests paste flow is not here (its own consent and purpose): it stays in the old interface and
// moves to Profile → "More ways to add interests" (Task 66).
import { useEffect, useId, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Check, Plus } from 'lucide-react'
import { copy } from '../../i18n.js'
import { DECLARED_PREFERENCE_SCHEMES } from '../../insight.js'
import { FREE_INTEREST_METHOD, normalizeFreeInterests } from '../../interests/freeInterestState.js'
import { VIEW_TEXT } from '../views.js'
import { fillIn, nextCopy } from '../copy.js'
import StepChip from '../StepChip.jsx'
import Chip from '../Chip.jsx'
import Skeleton from '../Skeleton.jsx'
import FreeInterestCard, { longEnough, MAX_INTEREST } from '../components/FreeInterestCard.jsx'
import { appendFreeInterest, CHIP_QUESTIONS, chosenOf, grantInterests, hasInterests, questionFull, replaceFreeInterest, restoreFreeInterest, tapPreference, toggleFreeChip } from '../interestsState.js'
import '../interests.css'

// The engine loads once, on the first Add or edit, and is kept for the page's life.
let engine = null
const loadEngine = () => (engine ||= import('../../interests/freeText.js').catch(failure => { engine = null; throw failure }))

const QUESTION_WORDS = { careerInterest: 'areas', workValue: 'values' }

export default function Interests({ lang, profile, focusHeading, onNavigate, notify, editMode = false }) {
  const S = copy[lang].screens.insight
  const w = nextCopy(lang).interests
  const id = useId()
  const { state, actions } = profile
  const stateRef = useRef(state)
  stateRef.current = state
  const consent = Boolean(state.consents?.insight)
  const free = normalizeFreeInterests(state.insight?.freeInterests)
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [editing, setEditing] = useState(null)
  const [editError, setEditError] = useState('')
  const heading = useRef(null), chipsRef = useRef(null), boxRef = useRef(null), mainButton = useRef(null)
  const granted = useRef(false), focusMain = useRef(false)
  useEffect(() => { if (focusHeading) heading.current?.focus() }, [focusHeading])
  // Ticking the consent removes the checkbox, so focus goes to the first chip.
  useEffect(() => { if (consent && granted.current) { granted.current = false; chipsRef.current?.querySelector('button')?.focus() } }, [consent])
  useEffect(() => { if (focusMain.current) { focusMain.current = false; (mainButton.current || boxRef.current)?.focus() } })

  const grant = event => { if (!event.target.checked) return; granted.current = true; actions.setState(s => grantInterests(s, S.consentGranted)) }
  const tap = (schemeId, optionId) => {
    // Task 78: a 4th choice changes nothing (the hint says why), so nothing is logged.
    const now = stateRef.current
    if (questionFull(now, schemeId) && !chosenOf(now, schemeId).includes(optionId)) return
    actions.setState(s => tapPreference(s, schemeId, optionId))
    // The old screen's usage-log line (no choice in it).
    actions.log(lang === 'ar' ? 'تحديث تفضيل منظم' : 'Structured preference updated')
  }
  const add = async event => {
    event.preventDefault()
    if (!consent || !longEnough(text) || busy) return
    setBusy(true); setError('')
    try {
      const { addFreeInterest } = await loadEngine()
      // Task 56's checks (length, the 5-interest limit, the consent) and understanding, on the current profile.
      const entry = addFreeInterest(stateRef.current, text, { lang }).insight.freeInterests.at(-1)
      actions.setState(s => appendFreeInterest(s, entry))
      setText('')
    } catch (failure) { setError(String(failure?.message || failure)) } finally { setBusy(false) }
  }
  const saveEdit = async (entry, value) => {
    setBusy(true); setEditError('')
    try {
      const { checkInterestText, understandInterest } = await loadEngine()
      const clean = checkInterestText(value, lang)
      const result = understandInterest(clean, lang)
      actions.setState(s => replaceFreeInterest(s, entry.id, clean, result))
      setEditing(null)
    } catch (failure) { setEditError(failure.message) } finally { setBusy(false) }
  }
  const remove = entry => {
    const index = free.findIndex(e => e.id === entry.id)
    if (editing === entry.id) setEditing(null)
    actions.deleteOne('free-interest', entry.id)
    focusMain.current = true
    notify(w.deleted, { action: { label: w.undo, onClick: () => actions.setState(s => restoreFreeInterest(s, entry, index)) } })
  }
  // Task 66: opened from Profile's Edit, the step's way on is "Back to Profile".
  const toNext = () => onNavigate(editMode ? 'profile' : 'next')
  const Forward = lang === 'ar' ? ArrowLeft : ArrowRight
  const chosen = consent && hasInterests(state)
  const reasonId = `${id}-reason`

  return <section className="ui2-page ui2-interests" aria-labelledby="ui2-page-title" data-view="interests" data-testid="ui2-page">
    {!editMode && <StepChip view="interests" lang={lang} onNavigate={onNavigate}/>}
    <h1 id="ui2-page-title" tabIndex={-1} ref={heading}>{VIEW_TEXT.interests.title[lang]}</h1>
    <p className="ui2-interests-line">{VIEW_TEXT.interests.line[lang]}</p>

    {consent
      ? <p className="ui2-interests-given" data-testid="ui2-interests-consent-given"><Check size={16} aria-hidden="true"/>{w.consentGiven}</p>
      : <label className="ui2-interest-consent" data-testid="ui2-interests-consent">
        <input type="checkbox" checked={false} onChange={grant}/>
        <span>{S.consent}</span>
      </label>}
    {!consent && <p className="ui2-interests-reason" id={reasonId} data-testid="ui2-interests-reason">{w.needConsent}</p>}

    <div ref={chipsRef}>
      {CHIP_QUESTIONS.map(schemeId => {
        const scheme = DECLARED_PREFERENCE_SCHEMES[schemeId]
        const picked = chosenOf(state, schemeId)
        return <fieldset className="ui2-interest-question" key={schemeId} aria-describedby={consent ? `${id}-${schemeId}-hint` : reasonId}>
          <legend>{w[QUESTION_WORDS[schemeId]]}</legend>
          <p className="ui2-interest-hint" id={`${id}-${schemeId}-hint`} aria-live="polite" data-testid={`ui2-interests-hint-${schemeId}`}>{consent && questionFull(state, schemeId) ? w.pickFull : w.pickUpTo}</p>
          <div>{scheme.options.map(option => <Chip key={option.id} data-option={option.id} selected={picked.includes(option.id)} disabled={!consent}
            onClick={() => tap(schemeId, option.id)}>{option.label[lang]}</Chip>)}</div>
        </fieldset>
      })}
    </div>

    <form className="ui2-interest-other" onSubmit={add} noValidate>
      <label htmlFor={`${id}-other`}>{w.other}</label>
      <textarea id={`${id}-other`} ref={boxRef} rows={2} maxLength={MAX_INTEREST} placeholder={w.placeholder} value={text} disabled={!consent}
        onChange={event => { setError(''); setText(event.target.value) }} aria-describedby={`${id}-other-hint ${id}-words${consent ? '' : ` ${reasonId}`}`}/>
      <p className="ui2-interest-hint" id={`${id}-other-hint`}>{w.otherHint}</p>
      <div className="ui2-interest-actions">
        <button type="submit" className="ui2-btn" disabled={!consent || !longEnough(text) || busy}><Plus size={18} aria-hidden="true"/>{w.add}</button>
      </div>
      {error && <p className="ui2-interest-error" role="alert">{error}</p>}
      <p className="ui2-interest-words" id={`${id}-words`} data-testid="ui2-interests-words">{w.words}</p>
    </form>

    {(free.length > 0 || (busy && !editing)) && <div className="ui2-interest-list">
      {free.map(entry => <FreeInterestCard key={entry.id} lang={lang} entry={entry} editing={editing === entry.id} busy={busy} error={editing === entry.id ? editError : ''}
        onToggle={(kind, chipId) => actions.setState(s => toggleFreeChip(s, entry.id, kind, chipId))}
        onEdit={() => { setEditError(''); setEditing(entry.id) }} onCancel={() => setEditing(null)} onSave={value => saveEdit(entry, value)} onDelete={() => remove(entry)}/>)}
      {busy && !editing && <Skeleton lang={lang} lines={2}/>}
    </div>}

    <div className="ui2-interests-actions">
      {chosen || editMode
        ? <button type="button" ref={mainButton} className="ui2-btn ui2-btn-primary" onClick={toNext}>{editMode ? nextCopy(lang).profile.backToProfile : <>{w.next}<Forward size={18} aria-hidden="true"/></>}</button>
        : <button type="button" className="ui2-text-btn" onClick={toNext}>{w.skip}</button>}
    </div>

    <details className="ui2-interests-technical">
      <summary>{w.technical}</summary>
      <p>{S.technical.interests}</p>
      <p dir="ltr">{fillIn(w.method, { method: FREE_INTEREST_METHOD })}</p>
    </details>
  </section>
}
