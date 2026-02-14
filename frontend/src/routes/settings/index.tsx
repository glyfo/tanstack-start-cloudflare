/**
 * Settings Index Route
 *
 * Redirects to the connections page by default.
 */

import { createFileRoute, redirect } from '@tanstack/react-router';

export const Route = createFileRoute('/settings/')({
  beforeLoad: () => {
    throw redirect({ to: '/settings/connections' });
  },
});
