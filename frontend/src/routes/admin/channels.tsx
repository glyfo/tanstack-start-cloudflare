/**
 * Admin - Channels Page
 */

import { createFileRoute } from '@tanstack/react-router';
import { ChannelDashboard } from '@/components/admin/ChannelDashboard';

export const Route = createFileRoute('/admin/channels')({
  component: ChannelsPage,
});

function ChannelsPage() {
  return <ChannelDashboard />;
}
