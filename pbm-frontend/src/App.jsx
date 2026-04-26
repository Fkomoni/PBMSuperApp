import { useState, lazy, Suspense } from 'react'
import Login from './pages/Login'
import { Sidebar, Topbar, PAGE_TITLES } from './components/Shell'
import { Toast } from './components/ui'

// Lazy-load all pages to keep initial bundle small
const Dashboard      = lazy(() => import('./pages/Dashboard'))
const Enrollees      = lazy(() => import('./pages/Enrollees'))
const AcuteInbox     = lazy(() => import('./pages/AcuteInbox'))
const RefillPlanner  = lazy(() => import('./pages/RefillPlanner'))
const Pharmacy       = lazy(() => import('./pages/Pharmacy'))
const TariffUpdate   = lazy(() => import('./pages/TariffUpdate'))
const CreateDeliveries = lazy(() => import('./pages/CreateDeliveries'))
const Pack           = lazy(() => import('./pages/Pack'))
const Pending        = lazy(() => import('./pages/Pending'))
const Logistics      = lazy(() => import('./pages/Logistics'))
const Riders         = lazy(() => import('./pages/Riders'))
const Tracking       = lazy(() => import('./pages/Tracking'))
const RiderOTP       = lazy(() => import('./pages/RiderOTP'))
const Stock          = lazy(() => import('./pages/Stock'))
const Claims         = lazy(() => import('./pages/Claims'))
const Payouts        = lazy(() => import('./pages/Payouts'))
const AuditTrail     = lazy(() => import('./pages/AuditTrail'))
const BrandWarnings  = lazy(() => import('./pages/BrandWarnings'))
const Reports        = lazy(() => import('./pages/Reports'))
const MemberApp      = lazy(() => import('./pages/MemberApp'))
const MemberRequests = lazy(() => import('./pages/MemberRequests'))
const BulkUpload     = lazy(() => import('./pages/BulkUpload'))
const ExclusionBills = lazy(() => import('./pages/ExclusionBills'))
const ClinicSupply   = lazy(() => import('./pages/ClinicSupply'))

function PageLoader() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', color: 'var(--lw-muted)', gap: 10 }}>
      <div style={{ width: 20, height: 20, border: '2px solid var(--lw-grey-line)', borderTopColor: 'var(--lw-red)', borderRadius: '50%', animation: 'spin .7s linear infinite' }} />
      Loading…
    </div>
  )
}

export default function App() {
  const [user, setUser] = useState(() => {
    try { return JSON.parse(localStorage.getItem('pbm_user')) } catch { return null }
  })
  const [page, setPage] = useState('dashboard')
  const [toast, setToast] = useState(null)

  const showToast = (msg, kind = 'success') => setToast({ msg, kind })

  const handleLogin = (u) => setUser(u)
  const handleLogout = () => {
    localStorage.removeItem('pbm_token')
    localStorage.removeItem('pbm_user')
    setUser(null)
  }

  if (!user) return <Login onLogin={handleLogin} />

  const [title, crumb] = PAGE_TITLES[page] || ['PBM Portal', '']

  const pageProps = { setToast: showToast, role: user.role }

  return (
    <div className="app">
      <Sidebar active={page} onNavigate={setPage} role={user.role} />
      <div className="main">
        <Topbar title={title} crumb={crumb} user={user} onLogout={handleLogout} />
        <Suspense fallback={<PageLoader />}>
          {page === 'dashboard'         && <Dashboard {...pageProps} onNavigate={setPage} />}
          {page === 'enrollees-lagos'   && <Enrollees {...pageProps} region="lagos" />}
          {page === 'enrollees-outside' && <Enrollees {...pageProps} region="outside" />}
          {page === 'member-requests'   && <MemberRequests {...pageProps} />}
          {page === 'refill-planner'    && <RefillPlanner {...pageProps} />}
          {page === 'acute-lagos'       && <AcuteInbox {...pageProps} bucket="lagos" />}
          {page === 'acute-outside'     && <AcuteInbox {...pageProps} bucket="outside" />}
          {page === 'pharmacy'          && <Pharmacy {...pageProps} />}
          {page === 'tariff-update'     && <TariffUpdate {...pageProps} />}
          {page === 'deliveries'        && <CreateDeliveries {...pageProps} />}
          {page === 'pack'              && <Pack {...pageProps} />}
          {page === 'pending'           && <Pending {...pageProps} />}
          {page === 'logistics'         && <Logistics {...pageProps} />}
          {page === 'riders'            && <Riders {...pageProps} />}
          {page === 'tracking'          && <Tracking {...pageProps} />}
          {page === 'rider-otp'         && <RiderOTP {...pageProps} />}
          {page === 'stock'             && <Stock {...pageProps} />}
          {page === 'claims'            && <Claims {...pageProps} />}
          {page === 'payouts'           && <Payouts {...pageProps} />}
          {page === 'audit'             && <AuditTrail {...pageProps} />}
          {page === 'brand-warnings'    && <BrandWarnings {...pageProps} />}
          {page === 'reports'           && <Reports {...pageProps} />}
          {page === 'member-app'        && <MemberApp {...pageProps} />}
          {page === 'bulk-upload'       && <BulkUpload {...pageProps} />}
          {page === 'exclusion-bills'   && <ExclusionBills {...pageProps} />}
          {page === 'clinic-supply'     && <ClinicSupply {...pageProps} />}
        </Suspense>
      </div>
      {toast && <Toast message={toast.msg} kind={toast.kind} onClose={() => setToast(null)} />}
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    </div>
  )
}
