import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { CATEGORIES, CONTACT_METHODS, TIME_SLOTS, DEFAULT_CAFE_ID } from '../../lib/constants'
import { upcomingSessionDates, formatSessionDate } from '../../lib/dates'
import { Field, ChipGroup } from '../../components/ui'

const STEP_LABELS = ['About you', 'Your item', 'The problem', 'Book a session']

// Mirrors the FRC Booking Request form, broken into four friendly steps.
export default function BookingWizard() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const [form, setForm] = useState({
    visitor_name: profile?.full_name ?? '',
    email: profile?.email ?? '',
    phone: profile?.phone ?? '',
    postcode: profile?.postcode ?? '',
    contact_methods: [],
    languages: '',
    item: '',
    category: '',
    brand: '',
    year_of_production: '',
    model_serial: '',
    problem_description: '',
    parts_materials: '',
    preferred_dates: [],
    preferred_time: '',
    form_feedback: '',
  })
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setInput = (key) => (e) => set(key)(e.target.value)

  const sessionDates = upcomingSessionDates(4)

  const validate = () => {
    if (step === 0) {
      if (!form.visitor_name.trim()) return 'Please tell us your name.'
      if (!form.email.trim()) return 'Please add an email address.'
      if (!form.phone.trim()) return 'Please add a phone number.'
      if (!form.postcode.trim()) return 'Please add your postcode.'
      if (!form.contact_methods.length) return 'Pick at least one way we can contact you.'
    }
    if (step === 1) {
      if (!form.item.trim()) return 'What is the item to be repaired?'
      if (!form.category) return 'Pick the closest category.'
    }
    if (step === 2) {
      if (!form.problem_description.trim()) return 'Tell us what needs fixing — whatever you know helps!'
    }
    return ''
  }

  const next = () => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setError('')
    setStep((s) => s + 1)
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('repair_requests').insert({
      cafe_id: DEFAULT_CAFE_ID,
      visitor_id: profile.id,
      ...form,
      visitor_name: form.visitor_name.trim(),
      session_date: form.preferred_dates[0] ?? null,
    })
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    // quietly keep the profile up to date for next time
    try {
      await updateProfile({ phone: form.phone, postcode: form.postcode, full_name: form.visitor_name.trim() })
    } catch { /* non-fatal */ }
    setDone(true)
  }

  if (done) {
    return (
      <div className="page page-narrow">
        <div className="card done-screen">
          <div className="big">🎉</div>
          <h2>Booking received!</h2>
          <p>
            Thanks {form.visitor_name.split(' ')[0]}! We&rsquo;ll confirm your appointment by 6pm on the
            Wednesday before the session. You can watch its progress from your home page.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/')}>Back to my repairs</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page page-narrow">
      <div className="wizard-head">
        <Link to="/" style={{ fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
        <h1 style={{ marginTop: 10 }}>Book a repair</h1>
        <p>
          Repair sessions run on the second Saturday of the month at Angliss Neighbourhood House.
          Please bring just one item so everyone gets a turn. Bookings close 6pm the Wednesday before.
        </p>
      </div>

      <div className="wiz-progress" aria-hidden="true">
        {STEP_LABELS.map((l, i) => <div key={l} className={`wp ${i <= step ? 'on' : ''}`} />)}
      </div>

      <div className="card card-pad">
        <div className="wiz-step-label">Step {step + 1} of {STEP_LABELS.length} — {STEP_LABELS[step]}</div>
        {error && <div className="form-error">{error}</div>}

        {step === 0 && (
          <>
            <Field label="Your name" required>
              <input className="input" value={form.visitor_name} onChange={setInput('visitor_name')} autoComplete="name" />
            </Field>
            <div className="grid-2">
              <Field label="Your email address" required>
                <input className="input" type="email" value={form.email} onChange={setInput('email')} autoComplete="email" />
              </Field>
              <Field label="Your phone number" required>
                <input className="input" type="tel" value={form.phone} onChange={setInput('phone')} autoComplete="tel" />
              </Field>
            </div>
            <Field label="Your postcode" required>
              <input className="input" inputMode="numeric" value={form.postcode} onChange={setInput('postcode')} style={{ maxWidth: 160 }} />
            </Field>
            <Field label="What is the best way to contact you?" required hint="Pick whatever suits you best.">
              <ChipGroup options={CONTACT_METHODS} value={form.contact_methods} onChange={set('contact_methods')} />
            </Field>
            <Field label="Languages other than English spoken at home"
              hint="Where possible we&rsquo;ll try to have someone who speaks your preferred language on site.">
              <input className="input" value={form.languages} onChange={setInput('languages')} placeholder="e.g. Vietnamese, Italian" />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="What is the item to be repaired?" required>
              <input className="input" value={form.item} onChange={setInput('item')} placeholder="e.g. Toaster, bike, winter coat" />
            </Field>
            <Field label="Category" required>
              <select className="select" value={form.category} onChange={setInput('category')}>
                <option value="">Choose a category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Brand name" hint="If you know it.">
              <input className="input" value={form.brand} onChange={setInput('brand')} />
            </Field>
            <div className="grid-2">
              <Field label="Year of production" hint="Just roughly — make a guess if you can!">
                <input className="input" value={form.year_of_production} onChange={setInput('year_of_production')} placeholder="e.g. 2015" />
              </Field>
              <Field label="Model, type or serial number" hint="Check the manual, or the back or underside of the item.">
                <input className="input" value={form.model_serial} onChange={setInput('model_serial')} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="What is the problem that needs to be fixed?" required hint="Describe whatever you know about why it isn&rsquo;t working!">
              <textarea className="textarea" rows={5} value={form.problem_description} onChange={setInput('problem_description')} />
            </Field>
            <Field label="What parts or materials do you have to help fix it?" hint="Let us know if you already have parts, materials or equipment.">
              <textarea className="textarea" value={form.parts_materials} onChange={setInput('parts_materials')} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Which dates could you visit?" hint="Sessions are the second Saturday of each month.">
              <ChipGroup options={sessionDates} value={form.preferred_dates} onChange={set('preferred_dates')} />
              <div className="hint" style={{ marginTop: 6 }}>
                {form.preferred_dates.length
                  ? form.preferred_dates.map(formatSessionDate).join(' · ')
                  : 'Tap all the dates that work for you.'}
              </div>
            </Field>
            <Field label="What time would you like to book in?"
              hint="Things may get busy — we can&rsquo;t guarantee an exact time, but we&rsquo;ll do our best. No new repairs after 1.30pm.">
              <ChipGroup single options={TIME_SLOTS} value={form.preferred_time} onChange={set('preferred_time')} />
            </Field>
            <Field label="How easy was this form to use?" hint="Optional — any comments or suggestions help us improve.">
              <textarea className="textarea" value={form.form_feedback} onChange={setInput('form_feedback')} />
            </Field>
          </>
        )}

        <div className="wiz-foot">
          {step > 0 && <button className="btn btn-ghost" onClick={() => { setError(''); setStep((s) => s - 1) }}>← Back</button>}
          <div className="spacer" />
          {step < 3
            ? <button className="btn btn-primary" onClick={next}>Continue →</button>
            : <button className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Submit booking'}</button>}
        </div>
      </div>
    </div>
  )
}
