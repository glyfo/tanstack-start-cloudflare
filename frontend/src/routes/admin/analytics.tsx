/**
 * Admin - Analytics Page
 */

import { createFileRoute } from '@tanstack/react-router';
import { AnalyticsDashboard } from '@/components/admin/AnalyticsDashboard';

export const Route = createFileRoute('/admin/analytics')({
  component: AnalyticsPage,
});

function AnalyticsPage() {
  return <AnalyticsDashboard />;
}
