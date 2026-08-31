import { BrandLogo, IconCalendar, IconClipboard, IconMapPin, IconCoffee } from './ui'

// The signed-out layout: cafe details on the left, whatever the visitor needs
// to do on the right. Shared by the welcome screen, ticket entry and team sign-in.
export default function PublicShell({ children }) {
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
        <div className="auth-card">{children}</div>
      </div>
    </div>
  )
}
