import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom'
import CommandNav from './components/CommandNav'
import PageTransition from './components/PageTransition'
import ErrorBoundary from './components/ErrorBoundary'
import Overview from './pages/Overview'
import Incidents from './pages/Incidents'
import Logs from './pages/Logs'
import Settings from './pages/Settings'
import BootLoader from './components/BootLoader'

// three.js + globe are heavy: load them only when the Attack Map is opened
const AttackMap = lazy(() => import('./pages/AttackMap'))

const mapBootLines = ['loading globe engine', 'resolving attack sources', 'tracing routes to target']

function AnimatedRoutes() {
  const location = useLocation()
  return (
    // Enter-only transition: an exit animation under AnimatePresence(mode="wait") could stall
    // and leave the old page stuck at opacity 0 when leaving a page mid-load.
    <PageTransition key={location.pathname}>
        <ErrorBoundary key={location.pathname}>
        <Suspense fallback={<BootLoader lines={mapBootLines} />}>
        <Routes location={location}>
          <Route path="/" element={<Overview />} />
          <Route path="/incidents" element={<Incidents />} />
          <Route path="/attack-map" element={<AttackMap />} />
          <Route path="/logs" element={<Logs />} />
          <Route path="/settings" element={<Settings />} />
        </Routes>
        </Suspense>
        </ErrorBoundary>
      </PageTransition>
  )
}

export default function App() {
  return (
    <BrowserRouter>
      <a
        href="#main"
        className="sr-only-live focus:fixed focus:left-2 focus:top-2 focus:z-50 focus:h-auto focus:w-auto focus:bg-accent focus:px-3 focus:py-2 focus:text-bg"
      >
        Skip to content
      </a>
      <CommandNav />
      <main id="main" className="pb-24 md:pb-10">
        <AnimatedRoutes />
      </main>
    </BrowserRouter>
  )
}
