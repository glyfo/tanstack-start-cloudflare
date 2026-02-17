/**
 * Admin Dashboard - Main Layout
 */

import { createFileRoute, Link, Outlet } from '@tanstack/react-router';
import { LayoutDashboard, Users, MessageSquare, Settings, Link2, BarChart3 } from 'lucide-react';

export const Route = createFileRoute('/admin/')({
  component: AdminLayout,
});

function AdminLayout() {
  const navItems = [
    { href: '/admin/analytics', icon: BarChart3, label: 'Analytics' },
    { href: '/admin/channels', icon: MessageSquare, label: 'Channels' },
    { href: '/admin/customers', icon: Users, label: 'Customers' },
    { href: '/admin/pairing', icon: Link2, label: 'Pairing Requests' },
    { href: '/admin/settings', icon: Settings, label: 'Settings' },
  ];

  return (
    <div className="min-h-screen bg-[#F5F5F0]">
      {/* Navigation */}
      <nav className="bg-white border-b border-stone-200">
        <div className="max-w-7xl mx-auto px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <LayoutDashboard className="w-6 h-6 text-sky-500" />
              <h1 className="text-xl font-bold text-stone-900">Admin Dashboard</h1>
            </div>

            <div className="flex items-center gap-1">
              {navItems.map(item => {
                const Icon = item.icon;
                return (
                  <Link
                    key={item.href}
                    to={item.href}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium text-stone-600 hover:bg-stone-50 hover:text-stone-900 transition-colors"
                  >
                    <Icon className="w-4 h-4" />
                    {item.label}
                  </Link>
                );
              })}
            </div>
          </div>
        </div>
      </nav>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-6 py-8">
        <Outlet />
      </main>
    </div>
  );
}
