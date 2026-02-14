/**
 * Settings Layout Route
 *
 * Parent route for all settings pages. Provides the sidebar navigation
 * and common layout structure.
 */

import { createFileRoute, Outlet } from '@tanstack/react-router';
import { SettingsSidebar } from '@/components/settings/SettingsSidebar';

export const Route = createFileRoute('/settings')({
  component: SettingsLayoutRoute,
});

function SettingsLayoutRoute() {
  return (
    <div className="h-screen bg-[#F5F5F0] flex">
      {/* Sidebar */}
      <SettingsSidebar />

      {/* Main Content */}
      <main className="flex-1 overflow-auto">
        <div className="max-w-4xl mx-auto px-8 py-8">
          <Outlet />
        </div>
      </main>
    </div>
  );
}
