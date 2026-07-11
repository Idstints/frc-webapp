import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { SKILLS, AVAILABILITY_OPTIONS, INTERESTED_REPAIRS, HEARD_ABOUT } from '../../lib/constants'
import { Field, ChipGroup } from '../../components/ui'

const STEP_LABELS = ['About you', 'Your skills', 'A few extras']

// Mirrors the "Join the Footscray Repair Cafe Team!" form in three steps.
export default function VolunteerApplyPage() {
  const { profile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)

  const [form, setForm] = useState({
    name: profile?.full_name ?? '',
    suburb: profile?.suburb ?? '',
    email: profile?.email ?? '',
    mobile: profile?.phone ?? '',
    skills: [],
    availability: null,
    donate_resources: '',
    interested_repairs: [],
    comments: '',
    heard_about: [],
  })
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setInput = (key) => (e) => set(key)(e.target.value)

  const next = () => {
    if (step === 0) {
      if (!form.name.trim()) return setError('Please tell us your name.')
      if (!form.suburb.trim()) return setError('Which suburb are you in?')
      if (!form.email.trim()) return setError('Please add an email — just write "none" if you don\'t use it.')
      if (!form.mobile.trim()) return setError('Please add a mobile — just write "none" if you don\'t have one.')
    }
    setError('')
    setStep((s) => s + 1)
  }

  const submit = async () => {
    setBusy(true)
    setError('')
    const { error: err } = await supabase.from('volunteer_applications').insert({
      user_id: profile.id,
      ...form,
      name: form.name.trim(),
    })
    if (err) {
      setError(err.message)
      setBusy(false)
      return
    }
    setDone(true)
  }

  if (done) {
    return (
      <div className="page page-narrow">
        <div className="card done-screen">
          <div className="big">💚</div>
          <h2>Thanks for putting your hand up!</h2>
          <p>
            The team at Angliss Neighbourhood House will be in touch soon. Once you&rsquo;re on board,
            your account will be switched over to the volunteer dashboard.
          </p>
          <button className="btn btn-primary btn-lg" onClick={() => navigate('/')}>Back home</button>
        </div>
      </div>
    )
  }

  return (
    <div className="page page-narrow">
      <div className="wizard-head">
        <Link to="/" style={{ fontSize: 13, textDecoration: 'none', fontWeight: 600 }}>← Back</Link>
        <h1 style={{ marginTop: 10 }}>Join the repair team!</h1>
        <p>
          Once a month, locals bring in their broken household items and our friendly volunteers help fix
          them — sharing skills, saving money and avoiding waste over a free cuppa. We&rsquo;d love you
          involved as a handy repairer, or as part of our welcome team on the day.
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
            <div className="grid-2">
              <Field label="Name" required>
                <input className="input" value={form.name} onChange={setInput('name')} autoComplete="name" />
              </Field>
              <Field label="Suburb" required>
                <input className="input" value={form.suburb} onChange={setInput('suburb')} placeholder="e.g. Footscray" />
              </Field>
            </div>
            <Field label="Email" required hint="Just say &ldquo;none&rdquo; if you don&rsquo;t use email.">
              <input className="input" value={form.email} onChange={setInput('email')} autoComplete="email" />
            </Field>
            <Field label="Mobile phone" required hint="Just say &ldquo;none&rdquo; if you don&rsquo;t have a mobile number.">
              <input className="input" value={form.mobile} onChange={setInput('mobile')} autoComplete="tel" />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="What repair skills can you offer?" hint="Pick as many as you like — or none, welcome-team helpers are gold too!">
              <ChipGroup options={SKILLS} value={form.skills} onChange={set('skills')} />
            </Field>
            <Field label="Are you available to volunteer at Angliss Neighbourhood House?" hint="Once a month at most.">
              <ChipGroup single options={AVAILABILITY_OPTIONS} value={form.availability} onChange={set('availability')} />
            </Field>
            <Field label="Any tools, equipment or resources you could donate?">
              <textarea className="textarea" value={form.donate_resources} onChange={setInput('donate_resources')} />
            </Field>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="As a visitor, what might you want repaired yourself?">
              <ChipGroup options={INTERESTED_REPAIRS} value={form.interested_repairs} onChange={set('interested_repairs')} />
            </Field>
            <Field label="Any other comments or thoughts?">
              <textarea className="textarea" value={form.comments} onChange={setInput('comments')} />
            </Field>
            <Field label="Finally — how did you hear about Footscray Repair Cafe?">
              <ChipGroup options={HEARD_ABOUT} value={form.heard_about} onChange={set('heard_about')} />
            </Field>
          </>
        )}

        <div className="wiz-foot">
          {step > 0 && <button className="btn btn-ghost" onClick={() => { setError(''); setStep((s) => s - 1) }}>← Back</button>}
          <div className="spacer" />
          {step < 2
            ? <button className="btn btn-primary" onClick={next}>Continue →</button>
            : <button className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>{busy ? 'Sending…' : 'Send my application'}</button>}
        </div>
      </div>
    </div>
  )
}
