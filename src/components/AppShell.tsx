import { BriefcaseBusiness, CalendarDays, Library, ShoppingBasket, SlidersHorizontal } from 'lucide-react'
import { Link, NavLink, Outlet, useLocation } from 'react-router'
import mark from '../assets/mark.svg'

const destinations = [
  { label: 'Recipe Box', to: '/recipes', Icon: BriefcaseBusiness },
  { label: 'Cookbooks', to: '/cookbooks', Icon: Library },
  { label: 'Planner', to: '/planner', Icon: CalendarDays },
  { label: 'Groceries', to: '/groceries', Icon: ShoppingBasket },
]

export function AppShell({ immersive = false }: { immersive?: boolean }) {
  const { pathname } = useLocation()
  const shell = pathname === '/settings' ? 'app-shell settings-shell' : 'app-shell'
  return (
    <div className={immersive ? 'immersive-shell' : shell}>
      <a className="skip-link" href="#main-content" onClick={(event) => {
        event.preventDefault()
        document.getElementById('main-content')?.focus()
      }}>Skip to content</a>
      {!immersive && <aside className="app-rail">
        <Link to="/recipes" className="brand">
          <img src={mark} alt="" width="36" height="36" />
          <span>Recipe Mix</span>
        </Link>
        <nav className="primary-nav" aria-label="Main navigation">
          {destinations.map(({ label, to, Icon }) => (
            <NavLink key={to} to={to} className="nav-item">
              <span className="nav-icon"><Icon aria-hidden="true" size={20} /></span>
              {label}
            </NavLink>
          ))}
        </nav>
        <div className="rail-footer">
          <NavLink to="/settings" className="nav-item settings-link">
            <SlidersHorizontal aria-hidden="true" size={18} /> Settings
          </NavLink>
          <p>Saved on this device. No account needed.</p>
        </div>
      </aside>}
      <main id="main-content" className={immersive ? 'immersive-page' : 'page'} tabIndex={-1}>
        <Outlet />
      </main>
    </div>
  )
}
