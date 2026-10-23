import { IconCalendar, IconClipboard, IconMapPin, IconCoffee } from './ui'
import { ANGLISS_WEBSITE } from '../lib/constants'

// The signed-out layout: a green banner with the cafe's details, then whatever
// the visitor needs to do underneath. Shared by the welcome screen, ticket
// entry and team sign-in.
export default function PublicShell({ children }) {
  return (
    <div className="auth-shell">
      <header className="auth-hero">
        <div className="hero-inner">
          <div className="hero-art">
            <img src="/logo-white.png" alt="Footscray Repair Cafe, Angliss Neighbourhood House" />
          </div>

          <div className="hero-copy">
            <p className="hero-eyebrow">Footscray Repair Cafe</p>
            <h1>Don&rsquo;t throw it away — repair it together.</h1>
            <p className="lede">
              A free community repair service. Bring a broken household item along on the second
              Saturday of each month, and our volunteer repairers will work with you to bring it
              back to life.
            </p>
            <div className="facts">
              <div className="fact"><IconCalendar /><span>Second Saturday of each month, 11am – 1.30pm</span></div>
              <div className="fact"><IconClipboard /><span>Bookings close at 6pm on the Wednesday before each session</span></div>
              <div className="fact"><IconCoffee /><span>One item per visit — enjoy a free cuppa while you wait</span></div>
              <div className="fact"><IconMapPin /><span>Angliss Neighbourhood House, 2/11 Vipont St, Footscray</span></div>
            </div>
            <a className="hero-link" href={ANGLISS_WEBSITE} target="_blank" rel="noopener noreferrer">
              Angliss Neighbourhood House
            </a>
            <div className="hero-foot">
              Supported by the Maribyrnong City Council Community Grants Program.
            </div>
          </div>
        </div>
      </header>

      <main className="auth-panel">
        <div className="auth-card">{children}</div>
      </main>
    </div>
  )
}
