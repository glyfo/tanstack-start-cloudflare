/**
 * Admin - Pairing Requests Page
 */

import { createFileRoute } from '@tanstack/react-router';
import { PairingRequestsPanel } from '@/components/admin/PairingRequestsPanel';

export const Route = createFileRoute('/admin/pairing')({
  component: PairingPage,
});

function PairingPage() {
  return <PairingRequestsPanel />;
}
