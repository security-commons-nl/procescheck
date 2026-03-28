import { NavLink } from 'react-router-dom'
import {
  LayoutDashboard, GitBranch, Monitor, Shield, Map, Download, ChevronLeft, ChevronRight, Network,
} from 'lucide-react'
import { useState } from 'react'
import { clsx } from 'clsx'

const NAV = [
  { to: '/dashboard', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/processes', icon: GitBranch, label: 'Processen' },
  { to: '/applications', icon: Monitor, label: 'Applicaties' },
  { to: '/bia', icon: Shield, label: 'BIA & BIV-Classificatie' },
  { to: '/business-context', icon: Map, label: 'Procescontext' },
  { to: '/ketenarchitectuur', icon: Network, label: 'Ketenarchitectuur' },
  { to: '/export', icon: Download, label: 'Export' },
]

export default function Sidebar() {
  const [collapsed, setCollapsed] = useState(false)

  return (
    <aside className={clsx(
      'flex flex-col bg-brand-600 text-white transition-all duration-300 h-full',
      collapsed ? 'w-16' : 'w-56',
    )}>
      <div className="flex items-center justify-between px-4 py-5 border-b border-brand-700">
        {!collapsed && (
          <span className="font-bold text-lg tracking-tight">ProcesCheck</span>
        )}
        <button
          onClick={() => setCollapsed(c => !c)}
          className="ml-auto p-1 rounded hover:bg-brand-700 transition-colors"
        >
          {collapsed ? <ChevronRight size={18} /> : <ChevronLeft size={18} />}
        </button>
      </div>

      <nav className="flex-1 py-4 space-y-1 px-2">
        {NAV.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) => clsx(
              'flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors',
              isActive
                ? 'bg-brand-500 text-white'
                : 'text-blue-100 hover:bg-brand-700 hover:text-white',
            )}
          >
            <Icon size={18} className="shrink-0" />
            {!collapsed && <span>{label}</span>}
          </NavLink>
        ))}
      </nav>

      <div className="px-4 py-3 border-t border-brand-700 text-xs text-blue-200">
        {!collapsed && 'v1.0.0'}
      </div>
    </aside>
  )
}
