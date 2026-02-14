/**
 * Settings Sidebar - Navigation component for settings pages
 */

import { Link, useLocation } from '@tanstack/react-router';

interface NavItem {
  label: string;
  href: string;
  icon: React.ReactNode;
  description: string;
}

const navItems: NavItem[] = [
  {
    label: 'Connections',
    href: '/settings/connections',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1"
        />
      </svg>
    ),
    description: 'Social media accounts',
  },
  {
    label: 'Webhooks',
    href: '/settings/webhooks',
    icon: (
      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M10 20l4-16m4 4l4 4-4 4M6 16l-4-4 4-4"
        />
      </svg>
    ),
    description: 'Webhook endpoints',
  },
];

export function SettingsSidebar() {
  const location = useLocation();
  const currentPath = location.pathname;

  return (
    <aside className="w-72 bg-white border-r border-stone-200 h-full flex flex-col">
      {/* Header */}
      <div className="p-5 border-b border-stone-200">
        <Link to="/chat" className="inline-flex items-center gap-2 text-stone-500 hover:text-stone-900 transition-colors cursor-pointer group">
          <svg className="w-4 h-4 group-hover:-translate-x-0.5 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
          </svg>
          <span className="text-sm font-medium">Back to Chat</span>
        </Link>
      </div>

      {/* Title */}
      <div className="px-5 pt-6 pb-4">
        <h1 className="text-xl font-bold text-stone-900">Settings</h1>
        <p className="text-sm text-stone-500 mt-1">Manage integrations</p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3">
        <ul className="space-y-1">
          {navItems.map((item) => {
            const isActive = currentPath === item.href || currentPath.startsWith(item.href + '/');
            return (
              <li key={item.href}>
                <Link
                  to={item.href}
                  className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-all cursor-pointer ${
                    isActive
                      ? 'bg-stone-900 text-white shadow-sm'
                      : 'text-stone-600 hover:bg-stone-100 hover:text-stone-900'
                  }`}
                >
                  <span className={isActive ? 'text-white' : 'text-stone-400'}>{item.icon}</span>
                  <div className="flex-1 min-w-0">
                    <span className="block text-sm font-medium">{item.label}</span>
                    <span className={`block text-xs mt-0.5 ${isActive ? 'text-stone-300' : 'text-stone-400'}`}>
                      {item.description}
                    </span>
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {/* Footer */}
      <div className="p-5 border-t border-stone-100">
        <p className="text-[11px] text-stone-400">
          Tokens encrypted with AES-256-GCM
        </p>
      </div>
    </aside>
  );
}
