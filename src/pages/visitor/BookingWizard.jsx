import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabaseClient'
import { useAuth } from '../../context/AuthContext'
import { CATEGORIES, CONTACT_METHODS, TIME_SLOTS, SLOT_CAPACITY, DEFAULT_CAFE_ID } from '../../lib/constants'
import { bookableSessionDates, toISODate, formatSessionDate } from '../../lib/dates'
import { Field, ChipGroup, Spinner, IconCamera, IconCheckCircle, IconX } from '../../components/ui'

const STEP_LABELS = ['Your details', 'Your item', 'The problem', 'Book a session']
const MAX_PHOTOS = 3
const MAX_PHOTO_MB = 5

// Mirrors the FRC booking request form, presented in four short steps.
export default function BookingWizard() {
  const { profile, updateProfile } = useAuth()
  const navigate = useNavigate()
  const [step, setStep] = useState(0)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [busyLabel, setBusyLabel] = useState('')
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
    session_date: '',
    preferred_time: '',
    form_feedback: '',
  })
  const set = (key) => (value) => setForm((f) => ({ ...f, [key]: value }))
  const setInput = (key) => (e) => set(key)(e.target.value)

  // live slot availability for upcoming sessions
  const sessionDates = bookableSessionDates(4)
  const [slotsTaken, setSlotsTaken] = useState(null) // { 'date|time': count }
  const loadAvailability = async () => {
    const { data, error: err } = await supabase.rpc('slot_availability', { from_date: toISODate(new Date()) })
    if (err) {
      console.error(err)
      setSlotsTaken({})
      return {}
    }
    const map = {}
    for (const row of data ?? []) map[`${row.session_date}|${row.preferred_time}`] = Number(row.bookings)
    setSlotsTaken(map)
    return map
  }
  useEffect(() => {
    if (step === 3 && slotsTaken === null) loadAvailability()
  }, [step]) // eslint-disable-line react-hooks/exhaustive-deps
  const takenFor = (map, date, time) => map?.[`${date}|${time}`] ?? 0

  // item photos: kept locally until submission, then uploaded to storage
  const [photos, setPhotos] = useState([]) // [{ file, url }]
  const fileInputRef = useRef(null)
  useEffect(() => () => photos.forEach((p) => URL.revokeObjectURL(p.url)), []) // eslint-disable-line react-hooks/exhaustive-deps

  const addPhotos = (fileList) => {
    setError('')
    const incoming = [...fileList]
    const next = [...photos]
    for (const file of incoming) {
      if (next.length >= MAX_PHOTOS) break
      if (!/^image\/(jpeg|png|webp|gif)$/.test(file.type)) {
        setError('Photos must be JPEG, PNG, WebP or GIF files.')
        continue
      }
      if (file.size > MAX_PHOTO_MB * 1024 * 1024) {
        setError(`Each photo must be under ${MAX_PHOTO_MB} MB.`)
        continue
      }
      next.push({ file, url: URL.createObjectURL(file) })
    }
    setPhotos(next)
  }

  const removePhoto = (idx) => {
    URL.revokeObjectURL(photos[idx].url)
    setPhotos(photos.filter((_, i) => i !== idx))
  }

  const uploadPhotos = async () => {
    const urls = []
    for (const { file } of photos) {
      const ext = (file.name.split('.').pop() || 'jpg').toLowerCase()
      const path = `${profile.id}/${crypto.randomUUID()}.${ext}`
      const { error: upErr } = await supabase.storage.from('repair-photos').upload(path, file)
      if (upErr) throw new Error(`Photo upload failed: ${upErr.message}`)
      urls.push(supabase.storage.from('repair-photos').getPublicUrl(path).data.publicUrl)
    }
    return urls
  }

  const validate = () => {
    if (step === 0) {
      if (!form.visitor_name.trim()) return 'Please enter your name.'
      if (!form.email.trim()) return 'Please enter an email address.'
      if (!form.phone.trim()) return 'Please enter a phone number.'
      if (!form.postcode.trim()) return 'Please enter your postcode.'
      if (!form.contact_methods.length) return 'Please select at least one contact method.'
    }
    if (step === 1) {
      if (!form.item.trim()) return 'Please tell us what the item is.'
      if (!form.category) return 'Please select the closest category.'
    }
    if (step === 2) {
      if (!form.problem_description.trim()) return 'Please describe the problem — anything you know helps.'
    }
    if (step === 3) {
      if (!form.session_date) return 'Please choose a session date.'
      if (!form.preferred_time) return 'Please choose an appointment time.'
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
    const problem = validate()
    if (problem) {
      setError(problem)
      return
    }
    setBusy(true)
    setError('')
    try {
      // re-check the chosen slot right before booking, in case it just filled
      setBusyLabel('Checking availability…')
      const fresh = await loadAvailability()
      if (takenFor(fresh, form.session_date, form.preferred_time) >= SLOT_CAPACITY) {
        throw new Error('That time was booked out a moment ago — please choose another slot.')
      }
      setBusyLabel(photos.length ? 'Uploading photos…' : 'Submitting…')
      const photoUrls = await uploadPhotos()
      setBusyLabel('Submitting…')
      const { error: err } = await supabase.from('repair_requests').insert({
        cafe_id: DEFAULT_CAFE_ID,
        visitor_id: profile.id,
        ...form,
        visitor_name: form.visitor_name.trim(),
        photos: photoUrls,
        preferred_dates: [form.session_date],
      })
      if (err) throw err
      // keep the profile up to date for next time
      try {
        await updateProfile({ phone: form.phone, postcode: form.postcode, full_name: form.visitor_name.trim() })
      } catch { /* non-fatal */ }
      setDone(true)
    } catch (e) {
      setError(e.message ?? 'Something went wrong. Please try again.')
      setBusy(false)
    }
  }

  if (done) {
    return (
      <div className="page page-narrow">
        <div className="card done-screen">
          <div className="done-ic"><IconCheckCircle /></div>
          <h2>Booking received</h2>
          <p>
            Thank you, {form.visitor_name.split(' ')[0]}. Your appointment is requested for{' '}
            {formatSessionDate(form.session_date)} at {form.preferred_time}. We&rsquo;ll confirm it by 6pm
            on the Wednesday before the session, and you can track its progress from your home page.
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
          Repair sessions run on the second Saturday of each month at Angliss Neighbourhood House.
          Please bring one item per visit so everyone gets a turn. Bookings close at 6pm on the
          Wednesday before each session.
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
            <Field label="Full name" required>
              <input className="input" value={form.visitor_name} onChange={setInput('visitor_name')} autoComplete="name" />
            </Field>
            <div className="grid-2">
              <Field label="Email address" required>
                <input className="input" type="email" value={form.email} onChange={setInput('email')} autoComplete="email" />
              </Field>
              <Field label="Phone number" required>
                <input className="input" type="tel" value={form.phone} onChange={setInput('phone')} autoComplete="tel" />
              </Field>
            </div>
            <Field label="Postcode" required>
              <input className="input" inputMode="numeric" value={form.postcode} onChange={setInput('postcode')} style={{ maxWidth: 160 }} />
            </Field>
            <Field label="Preferred contact method" required hint="Select all that suit you.">
              <ChipGroup options={CONTACT_METHODS} value={form.contact_methods} onChange={set('contact_methods')} />
            </Field>
            <Field label="Languages other than English spoken at home"
              hint="Where possible, we&rsquo;ll arrange for someone who speaks your preferred language to be on site.">
              <input className="input" value={form.languages} onChange={setInput('languages')} placeholder="For example, Vietnamese or Italian" />
            </Field>
          </>
        )}

        {step === 1 && (
          <>
            <Field label="What is the item to be repaired?" required>
              <input className="input" value={form.item} onChange={setInput('item')} placeholder="For example, a toaster, bicycle or winter coat" />
            </Field>
            <Field label="Category" required>
              <select className="select" value={form.category} onChange={setInput('category')}>
                <option value="">Select a category…</option>
                {CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </Field>
            <Field label="Photos of the item" hint={`Optional, up to ${MAX_PHOTOS} photos. They help our repairers prepare the right tools and parts before you arrive.`}>
              <div className="upload-row">
                {photos.map((p, i) => (
                  <div className="upload-tile" key={p.url}>
                    <img src={p.url} alt={`Item photo ${i + 1}`} />
                    <button type="button" className="rm" onClick={() => removePhoto(i)} aria-label="Remove photo"><IconX /></button>
                  </div>
                ))}
                {photos.length < MAX_PHOTOS && (
                  <button type="button" className="upload-add" onClick={() => fileInputRef.current?.click()}>
                    <span style={{ display: 'grid', placeItems: 'center' }}>
                      <IconCamera />
                      Add photo
                    </span>
                  </button>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                multiple
                hidden
                onChange={(e) => { addPhotos(e.target.files); e.target.value = '' }}
              />
            </Field>
            <Field label="Brand" hint="If known.">
              <input className="input" value={form.brand} onChange={setInput('brand')} />
            </Field>
            <div className="grid-2">
              <Field label="Year of production" hint="An estimate is fine.">
                <input className="input" value={form.year_of_production} onChange={setInput('year_of_production')} placeholder="For example, 2015" />
              </Field>
              <Field label="Model, type or serial number" hint="Often found in the manual, or on the back or underside of the item.">
                <input className="input" value={form.model_serial} onChange={setInput('model_serial')} />
              </Field>
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <Field label="What is the problem that needs to be fixed?" required hint="Describe whatever you know about why it isn&rsquo;t working.">
              <textarea className="textarea" rows={5} value={form.problem_description} onChange={setInput('problem_description')} />
            </Field>
            <Field label="Do you have any parts or materials that could help?" hint="Let us know if you already have spare parts, materials or equipment.">
              <textarea className="textarea" value={form.parts_materials} onChange={setInput('parts_materials')} />
            </Field>
          </>
        )}

        {step === 3 && (
          <>
            <Field label="Choose a session" hint="The cafe runs on the second Saturday of each month, 11am – 1.30pm. Bookings close at 6pm on the Wednesday before each session.">
              <div className="date-cards">
                {sessionDates.map((d) => {
                  const dateObj = new Date(`${d}T00:00:00`)
                  const taken = TIME_SLOTS.reduce((s, t) => s + Math.min(takenFor(slotsTaken, d, t), SLOT_CAPACITY), 0)
                  const total = TIME_SLOTS.length * SLOT_CAPACITY
                  return (
                    <button type="button" key={d} className={`date-card ${form.session_date === d ? 'on' : ''}`}
                      onClick={() => setForm((f) => ({ ...f, session_date: d, preferred_time: '' }))}>
                      <div className="dc-day">{dateObj.toLocaleDateString('en-AU', { weekday: 'long' })}</div>
                      <div className="dc-date">{dateObj.toLocaleDateString('en-AU', { day: 'numeric', month: 'long', year: 'numeric' })}</div>
                      <div className="dc-note">{slotsTaken === null ? ' ' : total - taken > 0 ? `${total - taken} of ${total} appointments free` : 'Fully booked'}</div>
                    </button>
                  )
                })}
              </div>
            </Field>

            {form.session_date && (
              <Field label="Choose an appointment time" hint="Each appointment is half an hour. No new repairs are started after 1.30pm.">
                {slotsTaken === null ? (
                  <div style={{ display: 'grid', placeItems: 'center', padding: 20 }}><Spinner /></div>
                ) : (
                  <div className="slot-grid">
                    {TIME_SLOTS.map((t) => {
                      const taken = takenFor(slotsTaken, form.session_date, t)
                      const left = Math.max(SLOT_CAPACITY - taken, 0)
                      const full = left === 0
                      return (
                        <button type="button" key={t} disabled={full}
                          className={`slot ${form.preferred_time === t ? 'on' : ''}`}
                          onClick={() => set('preferred_time')(t)}>
                          <div className="sl-time">{t}</div>
                          <div className={`sl-avail ${!full && left === 1 ? 'low' : ''}`}>
                            {full ? 'Fully booked' : left === 1 ? 'Last spot available' : `${left} spots available`}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </Field>
            )}

            <Field label="Feedback on this form" hint="Optional — any comments or suggestions help us improve.">
              <textarea className="textarea" value={form.form_feedback} onChange={setInput('form_feedback')} />
            </Field>
          </>
        )}

        <div className="wiz-foot">
          {step > 0 && <button className="btn btn-ghost" onClick={() => { setError(''); setStep((s) => s - 1) }}>← Back</button>}
          <div className="spacer" />
          {step < 3
            ? <button className="btn btn-primary" onClick={next}>Continue →</button>
            : <button className="btn btn-primary btn-lg" onClick={submit} disabled={busy}>{busy ? busyLabel : 'Submit booking'}</button>}
        </div>
      </div>
    </div>
  )
}
