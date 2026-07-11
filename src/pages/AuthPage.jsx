import { useState } from 'react'
import { useAuth } from '../context/AuthContext'
import { Field, BrandLogo, IconCalendar, IconClipboard, IconMapPin, IconCoffee, IconHome, IconWrench } from '../components/ui'

const GoogleIcon = () => (
  <svg width="16" height="16" viewBox="0 0 48 48" aria-hidden="true">
    <path fill="#FFC107" d="M43.6 20.1H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 13 4 4 13 4 24s9 20 20 20 20-9 20-20c0-1.3-.1-2.6-.4-3.9z"/>
    <path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 8 3l5.7-5.7C34.3 6.1 29.4 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/>
    <path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/>
    <path fill="#1976D2" d="M43.6 20.1H42V20H24v8h11.3c-.8 2.3-2.3 4.3-4.1 5.7l6.2 5.2C36.9 39.2 44 34 44 24c0-1.3-.1-2.6-.4-3.9z"/>
  </svg>
)

export default function AuthPage() {
  const { signIn, signUp, signInWithGoogle } = useAuth()
  const [tab, setTab] = useState('signin')
  const [role, setRole] = useState('visitor')
  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [busy, setBusy] = useState(false)

  const submit = async (e) => {
    e.preventDefault()
    setError('')
    setNotice('')
    setBusy(true)
    try {
      if (tab === 'signin') {
        await signIn({ email, password })
      } else {
        if (!fullName.trim()) throw new Error('Please enter your name.')
        const { session } = await signUp({ email, password, fullName: fullName.trim(), role })
        if (!session) {
          setNotice('Almost done — please check your email for a confirmation link, then sign in.')
        }
      }
    } catch (err) {
      setError(err.message ?? 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  const google = async () => {
    setError('')
    try {
      await signInWithGoogle(tab === 'signup' ? role : null)
    } catch (err) {
      setError(err.message ?? 'Google sign-in is not available right now.')
    }
  }

  return (
    <div className="auth-shell">
      <div className="auth-hero">
        <div className="hero-logo">
          <BrandLogo height={52} />
          <div>
            <div className="hl-name">Footscray Repair Cafe</div>
            <div className="hl-sub">Angliss Neighbourhood House</div>
          </div>
        </div>
        <h1>Don&rsquo;t throw it away — repair it together.</h1>
        <p className="lede">
          Footscray Repair Cafe is a free community repair service. Bring a broken household item
          along on the second Saturday of each month, and our volunteer repairers will work with
          you to bring it back to life.
        </p>
        <div className="facts">
          <div className="fact"><IconCalendar /><span>Second Saturday of each month, 11am – 1.30pm</span></div>
          <div className="fact"><IconClipboard /><span>Bookings close at 6pm on the Wednesday before each session</span></div>
          <div className="fact"><IconCoffee /><span>One item per visit — enjoy a free cuppa while you wait</span></div>
          <div className="fact"><IconMapPin /><span>Angliss Neighbourhood House, 2/11 Vipont St, Footscray</span></div>
        </div>
        <div className="hero-foot">
          Supported by the Maribyrnong City Council Community Grants Program.
        </div>
      </div>

      <div className="auth-panel">
        <div className="auth-card">
          <h2 style={{ fontSize: 20, marginBottom: 4 }}>{tab === 'signin' ? 'Welcome back' : 'Create your account'}</h2>
          <p style={{ color: 'var(--ink-2)', fontSize: 13.5, marginBottom: 18 }}>
            {tab === 'signin' ? 'Sign in to manage your repairs.' : 'Book repairs or join the volunteer team — it only takes a minute.'}
          </p>

          <div className="auth-tabs" role="tablist">
            <button role="tab" aria-selected={tab === 'signin'} className={tab === 'signin' ? 'on' : ''} onClick={() => setTab('signin')}>Sign in</button>
            <button role="tab" aria-selected={tab === 'signup'} className={tab === 'signup' ? 'on' : ''} onClick={() => setTab('signup')}>Create account</button>
          </div>

          {error && <div className="form-error">{error}</div>}
          {notice && <div className="form-ok">{notice}</div>}

          <form onSubmit={submit}>
            {tab === 'signup' && (
              <>
                <Field label="I&rsquo;m joining as">
                  <div className="opt-cards">
                    <button type="button" className={`opt-card ${role === 'visitor' ? 'on' : ''}`} onClick={() => setRole('visitor')}>
                      <span className="oc-icon"><IconHome /></span>
                      <span><span className="oc-title">Visitor</span><div className="oc-sub">I have an item that needs repairing</div></span>
                    </button>
                    <button type="button" className={`opt-card ${role === 'volunteer' ? 'on' : ''}`} onClick={() => setRole('volunteer')}>
                      <span className="oc-icon"><IconWrench /></span>
                      <span><span className="oc-title">Volunteer</span><div className="oc-sub">I&rsquo;m part of the repair team</div></span>
                    </button>
                  </div>
                </Field>
                <Field label="Full name">
                  <input className="input" value={fullName} onChange={(e) => setFullName(e.target.value)} autoComplete="name" />
                </Field>
              </>
            )}
            <Field label="Email">
              <input className="input" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} autoComplete="email" />
            </Field>
            <Field label="Password">
              <input className="input" type="password" required minLength={8} value={password} onChange={(e) => setPassword(e.target.value)}
                autoComplete={tab === 'signin' ? 'current-password' : 'new-password'} />
            </Field>
            <button className="btn btn-primary btn-lg btn-block" disabled={busy}>
              {busy ? 'One moment…' : tab === 'signin' ? 'Sign in' : 'Create account'}
            </button>
          </form>

          <div className="divider">or</div>
          <button className="btn btn-secondary btn-block" onClick={google} type="button">
            <GoogleIcon /> Continue with Google
          </button>
        </div>
      </div>
    </div>
  )
}
