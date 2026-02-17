/**
 * Admin - Customers List Page
 */

import { useState } from 'react';
import { Search, User } from 'lucide-react';
import { createFileRoute, Link } from '@tanstack/react-router';

export const Route = createFileRoute('/admin/customers')({
  component: CustomersPage,
});

function CustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  const handleSearch = async () => {
    if (!searchQuery.trim()) return;

    setLoading(true);
    try {
      const response = await fetch(
        `/api/customer-identity/search?q=${encodeURIComponent(searchQuery)}&orgId=default-org`
      );
      const data = await response.json();
      setCustomers(data || []);
    } catch (error) {
      console.error('Error searching customers:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-stone-900">Customers</h1>
        <p className="text-sm text-stone-500 mt-1">
          Search and view customer profiles
        </p>
      </div>

      {/* Search */}
      <div className="flex gap-2">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-stone-400" />
          <input
            type="text"
            placeholder="Search by name, email, or phone..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
            className="w-full pl-10 pr-4 py-3 border border-stone-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-sky-500"
          />
        </div>
        <button
          onClick={handleSearch}
          disabled={loading}
          className="px-6 py-3 bg-sky-500 text-white rounded-lg font-medium hover:bg-sky-600 disabled:opacity-50 transition-colors"
        >
          {loading ? 'Searching...' : 'Search'}
        </button>
      </div>

      {/* Results */}
      {customers.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {customers.map(customer => (
            <Link
              key={customer.customerId}
              to={`/admin/customers/${customer.customerId}`}
              className="bg-white rounded-xl border border-stone-200 p-4 hover:shadow-md transition-shadow"
            >
              <div className="flex items-start gap-3">
                <div className="w-12 h-12 rounded-full bg-gradient-to-br from-sky-400 to-purple-500 flex items-center justify-center text-white font-bold">
                  {customer.displayName?.[0]?.toUpperCase() || <User className="w-6 h-6" />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-stone-900 truncate">
                    {customer.displayName || 'Unknown'}
                  </div>
                  <div className="text-sm text-stone-600 truncate">
                    {customer.primaryEmail || customer.primaryPhone || customer.customerId}
                  </div>
                  <div className="text-xs text-stone-500 mt-1">
                    {customer.identities?.length || 0} channels • {customer.totalMessages || 0} messages
                  </div>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
