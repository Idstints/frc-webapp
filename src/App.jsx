import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Splash, BrandLogo, BrandMarkFallback, initialsOf } from './components/ui'
import AuthPage from './pages/AuthPage'
import WelcomePage from './pages/WelcomePage'
import TicketEntryPage from './pages/TicketEntryPage'
import RoleSelectPage from './pages/RoleSelectPage'
import PendingApprovalPage from './pages/PendingApprovalPage'
import VisitorHome from './pages/visitor/VisitorHome'
import BookingWizard from './pages/visitor/BookingWizard'
import VolunteerApplyPage from './pages/visitor/VolunteerApplyPage'
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard'

function TopBar() {
  const { profile, signOut } = useAuth()
  const isVisitor = profile?.role !== 'volunteer'
  return (
    <header className="topbar">
      <div className="topbar-inner">
        <Link to="/" className="brand">
          <BrandLogo height={42} />
          <BrandMarkFallback />
          <div>
            <div className="brand-name">Footscray Repair Cafe</div>
            <div className="brand-sub">Angliss Neighbourhood House</div>
          </div>
        </Link>
        <div className="topbar-spacer" />
        {isVisitor && profile?.person_code && (
          <div className="topbar-code" title="Your visitor number — the first half of every ticket you hold">
            <span className="tc-label">Your number</span>
            <span className="tc-value">{profile.person_code}</span>
          </div>
        )}
        <div className="user-chip">
          <div className="avatar">{initialsOf(profile?.full_name)}</div>
          <div className="who">
            <div className="name">{profile?.full_name || 'Welcome'}</div>
            <div className="role">{profile?.role === 'volunteer' ? 'Volunteer' : 'Visitor'}</div>
          </div>
          <button className="btn btn-ghost btn-sm" onClick={signOut}>Sign out</button>
        </div>
      </div>
    </header>
  )
}

export default function App() {
  const { session, profile, loading, profileLoading } = useAuth()

  if (loading) return <Splash />

  // Signed out: visitors use a ticket number, the team signs in as before.
  if (!session) {
    return (
      <Routes>
        <Route path="/" element={<WelcomePage />} />
        <Route path="/ticket" element={<TicketEntryPage />} />
        <Route path="/t/:code" element={<TicketEntryPage />} />
        <Route path="/book" element={<BookingWizard />} />
        <Route path="/team" element={<AuthPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    )
  }

  // Don't offer the role picker while the profile is still on its way — a
  // visitor who just got a ticket number would see it flash past.
  if (!profile && profileLoading) return <Splash />
  if (!profile || !profile.role) return <RoleSelectPage />
  if (profile.role === 'volunteer' && !profile.approved) {
    return (
      <>
        <TopBar />
        <PendingApprovalPage />
      </>
    )
  }

  return (
    <>
      <TopBar />
      {profile.role === 'volunteer' ? (
        <Routes>
          <Route path="/" element={<VolunteerDashboard />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      ) : (
        <Routes>
          <Route path="/" element={<VisitorHome />} />
          <Route path="/book" element={<BookingWizard />} />
          <Route path="/volunteer-apply" element={<VolunteerApplyPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      )}
    </>
  )
}
