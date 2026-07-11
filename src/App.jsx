import { Routes, Route, Navigate, Link } from 'react-router-dom'
import { useAuth } from './context/AuthContext'
import { Splash, BrandLogo, BrandMarkFallback, initialsOf } from './components/ui'
import AuthPage from './pages/AuthPage'
import RoleSelectPage from './pages/RoleSelectPage'
import VisitorHome from './pages/visitor/VisitorHome'
import BookingWizard from './pages/visitor/BookingWizard'
import VolunteerApplyPage from './pages/visitor/VolunteerApplyPage'
import VolunteerDashboard from './pages/volunteer/VolunteerDashboard'

function TopBar() {
  const { profile, signOut } = useAuth()
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
  const { session, profile, loading } = useAuth()

  if (loading) return <Splash />
  if (!session) return <AuthPage />
  if (!profile || !profile.role) return <RoleSelectPage />

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
