import { Routes, Route, NavLink } from 'react-router-dom'
import {
  LayoutDashboard, Factory, Wrench, ClipboardList, Bot,
  AlertTriangle, Package, BarChart3, Settings as SettingsIcon,
} from 'lucide-react'
import { LiquidGlass, ParticleBackground, FPSGuard } from '@sohumsuthar/liquid-glass'
import { useLiquidGlassEffects } from '@sohumsuthar/liquid-glass/hooks'

import { PageHeaderProvider, useCurrentHeader } from './PageHeaderContext.jsx'
import ThemeToggle, { useTheme } from './ThemeToggle.jsx'

import Dashboard from './pages/Dashboard.jsx'
import Machines from './pages/Machines.jsx'
import MachineDetail from './pages/MachineDetail.jsx'
import Maintenance from './pages/Maintenance.jsx'
import WorkOrders from './pages/WorkOrders.jsx'
import AIAssistant from './pages/AIAssistant.jsx'
import Alerts from './pages/Alerts.jsx'
import SpareParts from './pages/SpareParts.jsx'
import Reports from './pages/Reports.jsx'
import SettingsPage from './pages/Settings.jsx'

const NAV = [
  { to: '/', label: 'Dashboard', icon: LayoutDashboard, end: true },
  { to: '/machines', label: 'Machines', icon: Factory },
  { to: '/maintenance', label: 'Maintenance', icon: Wrench },
  { to: '/work-orders', label: 'Work Orders', icon: ClipboardList },
  { to: '/ai-assistant', label: 'AI Assistant', icon: Bot },
  { to: '/alerts', label: 'Alerts', icon: AlertTriangle },
  { to: '/spare-parts', label: 'Spare Parts', icon: Package },
  { to: '/reports', label: 'Reports', icon: BarChart3 },
  { to: '/settings', label: 'Settings', icon: SettingsIcon },
]

function Topbar({ theme, setTheme }) {
  const { title, actions } = useCurrentHeader()
  return (
    <LiquidGlass lens variant="regular" className="topbar-glass">
      <div className="topbar-inner">
        <div className="topbar-title">{title}</div>
        <div className="topbar-actions">
          {actions}
          <ThemeToggle theme={theme} setTheme={setTheme} />
        </div>
      </div>
    </LiquidGlass>
  )
}

function Sidebar() {
  return (
    <LiquidGlass lens macro variant="regular" className="sidebar-glass">
      <div className="sidebar-inner">
        <div className="brand">
          <span className="brand-status-dot" />
          <div>
            <div className="brand-mark">MAINTAIN AI</div>
            <div className="brand-sub">predictive maintenance</div>
          </div>
        </div>
        <nav className="nav-group">
          {NAV.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}
            >
              <Icon size={16} strokeWidth={1.75} />
              {label}
            </NavLink>
          ))}
        </nav>
      </div>
    </LiquidGlass>
  )
}

export default function App() {
  useLiquidGlassEffects({ reveal: false, scroll: false })
  const [theme, setTheme] = useTheme()

  return (
    <PageHeaderProvider>
      <ParticleBackground />
      <FPSGuard />
      <div className="app-shell">
        <Sidebar />
        <div className="main">
          <Topbar theme={theme} setTheme={setTheme} />
          <div className="content">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/machines" element={<Machines />} />
              <Route path="/machines/:id" element={<MachineDetail />} />
              <Route path="/maintenance" element={<Maintenance />} />
              <Route path="/work-orders" element={<WorkOrders />} />
              <Route path="/ai-assistant" element={<AIAssistant />} />
              <Route path="/alerts" element={<Alerts />} />
              <Route path="/spare-parts" element={<SpareParts />} />
              <Route path="/reports" element={<Reports />} />
              <Route path="/settings" element={<SettingsPage />} />
            </Routes>
          </div>
        </div>
      </div>
    </PageHeaderProvider>
  )
}
