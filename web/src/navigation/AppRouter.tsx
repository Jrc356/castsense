import { HashRouter, NavLink, Route, Routes } from 'react-router-dom'
import { CaptureScreen, ErrorScreen, HomeScreen, ResultsScreen, SettingsScreen } from '../screens'

export function AppRouter(): React.JSX.Element {
  const navClass = ({ isActive }: { isActive: boolean }) => (isActive ? 'active' : '')

  return (
    <HashRouter>
      <div className="app-shell">
        <header className="topbar">
          <div className="brand">
            <span className="brand-mark" aria-hidden="true">
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none" width="100%" height="100%">
                <defs>
                  <linearGradient id="brand-rod" x1="5" y1="27" x2="26" y2="7" gradientUnits="userSpaceOnUse">
                    <stop offset="0%" stopColor="#c26b2f"/>
                    <stop offset="100%" stopColor="#3db8c8"/>
                  </linearGradient>
                </defs>
                <path d="M5 27Q13 18 26 7" stroke="url(#brand-rod)" strokeWidth="2.2" strokeLinecap="round"/>
                <path d="M26 7C31 11 28 21 21 27" stroke="#9dd4dc" strokeWidth="0.85" strokeLinecap="round" opacity="0.75"/>
                <circle cx="21" cy="27" r="1.6" fill="#e07a35"/>
                <g stroke="#f4e0c0" strokeWidth="0.85" strokeLinecap="round">
                  <line x1="21" y1="24.3" x2="21" y2="23.4"/>
                  <line x1="23.3" y1="25.4" x2="24.0" y2="24.8"/>
                  <line x1="18.7" y1="25.4" x2="18.0" y2="24.8"/>
                  <line x1="23.8" y1="27.0" x2="24.7" y2="27.0"/>
                  <line x1="18.2" y1="27.0" x2="17.3" y2="27.0"/>
                </g>
              </svg>
            </span>
            <div>
              <h1>CastSense</h1>
              <p>Water-read tactical assistant</p>
            </div>
          </div>
          <nav>
            <NavLink to="/" className={navClass}>Home</NavLink>
            <NavLink to="/capture" className={navClass}>Capture</NavLink>
            <NavLink to="/results" className={navClass}>Results</NavLink>
            <NavLink to="/settings" className={navClass}>Settings</NavLink>
          </nav>
        </header>

        <Routes>
          <Route path="/" element={<HomeScreen />} />
          <Route path="/capture" element={<CaptureScreen />} />
          <Route path="/results" element={<ResultsScreen />} />
          <Route path="/settings" element={<SettingsScreen />} />
          <Route path="/error" element={<ErrorScreen />} />
        </Routes>
      </div>
    </HashRouter>
  )
}
