/**
 * Admin - Customer Detail Page
 */

import { createFileRoute } from '@tanstack/react-router';
import { CustomerProfileView } from '@/components/admin/CustomerProfileView';

export const Route = createFileRoute('/admin/customers/$customerId')({
  component: CustomerDetailPage,
});

function CustomerDetailPage() {
  const { customerId } = Route.useParams();

  return <CustomerProfileView customerId={customerId} />;
}
