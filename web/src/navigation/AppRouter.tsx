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
              CS
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
