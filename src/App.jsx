import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { Sidebar } from './components/Sidebar'
import { Topbar } from './components/Topbar'
import Overview from './pages/Overview'
import Incidents from './pages/Incidents'
import AttackMap from './pages/AttackMap'
import Logs from './pages/Logs'
import Settings from './pages/Settings'

function App() {
  return (
    <BrowserRouter>
      <div className="flex min-h-screen bg-bg">
        <Sidebar />
        <div className="flex-1 flex flex-col min-w-0">
          <Topbar />
          <main className="flex-1 p-6 overflow-auto">
            <Routes>
              <Route path="/" element={<Overview />} />
              <Route path="/incidents" element={<Incidents />} />
              <Route path="/attack-map" element={<AttackMap />} />
              <Route path="/logs" element={<Logs />} />
              <Route path="/settings" element={<Settings />} />
            </Routes>
          </main>
        </div>
      </div>
    </BrowserRouter>
  )
}

export default App
