import { NavLink } from 'react-router-dom';
import NotificationBell from '../shared/NotificationBell';

const tabs = [
  { path: '/', label: 'Home', icon: 'H' },
  { path: '/relationships', label: 'Relationships', icon: 'R' },
  { path: '/discover', label: 'Discover', icon: 'D' },
  { path: '/wiki', label: 'Wiki', icon: 'W' },
  { path: '/profile', label: 'Profile', icon: 'P' },
];

export default function Layout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen bg-gray-50 pb-16">
      {/* Top bar with notifications */}
      <div className="bg-white border-b px-4 py-2 flex justify-between items-center max-w-lg mx-auto">
        <NavLink to="/" className="font-bold text-primary-500 text-sm">RC</NavLink>
        <div className="flex items-center gap-3">
          <NavLink to="/coaching" className={({ isActive }) => `text-xs ${isActive ? 'text-primary-500 font-semibold' : 'text-gray-500'}`}>
            Coaching
          </NavLink>
          <NavLink to="/life-stages" className={({ isActive }) => `text-xs ${isActive ? 'text-primary-500 font-semibold' : 'text-gray-500'}`}>
            Life
          </NavLink>
          <NavLink to="/health" className={({ isActive }) => `text-xs ${isActive ? 'text-primary-500 font-semibold' : 'text-gray-500'}`}>
            Health
          </NavLink>
          <NotificationBell />
        </div>
      </div>

      {/* Main content */}
      <main className="max-w-lg mx-auto">{children}</main>

      {/* Bottom tab bar */}
      <nav className="fixed bottom-0 left-0 right-0 bg-white border-t border-gray-200">
        <div className="max-w-lg mx-auto flex">
          {tabs.map((tab) => (
            <NavLink
              key={tab.path}
              to={tab.path}
              end={tab.path === '/'}
              className={({ isActive }) =>
                `flex-1 flex flex-col items-center py-2 text-xs ${
                  isActive ? 'text-primary-500 font-semibold' : 'text-gray-500'
                }`
              }
            >
              <span className="text-lg mb-0.5">{tab.icon}</span>
              <span>{tab.label}</span>
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}
