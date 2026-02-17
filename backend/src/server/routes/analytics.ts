/**
 * Analytics API Routes
 *
 * Provides aggregated analytics data for the admin dashboard
 */

import type { Env } from '../types/env';

export async function handleAnalyticsRequest(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const range = url.searchParams.get('range') || '7d';

  try {
    // Get channel gateway DO for stats
    const channelGatewayId = env.CHANNEL_GATEWAY.idFromName('default');
    const channelGateway = env.CHANNEL_GATEWAY.get(channelGatewayId);

    // Fetch stats from ChannelGateway
    const statsResponse = await channelGateway.fetch(
      new Request('https://fake-host/stats', {
        method: 'GET',
      })
    );

    if (!statsResponse.ok) {
      throw new Error('Failed to fetch channel stats');
    }

    const stats = await statsResponse.json();

    // Get customer identity DO for customer count
    const customerIdentityId = env.CUSTOMER_IDENTITY.idFromName('default');
    const customerIdentity = env.CUSTOMER_IDENTITY.get(customerIdentityId);

    const customerResponse = await customerIdentity.fetch(
      new Request('https://fake-host/customers', {
        method: 'GET',
      })
    );

    const customerData = await customerResponse.json();
    const customers = customerData.customers || [];

    // Aggregate analytics data
    const analytics = {
      totalMessages: stats.reduce((sum: number, ch: any) => sum + (ch.messageCount || 0), 0),
      totalCustomers: customers.length,
      activeConversations: stats.reduce((sum: number, ch: any) => sum + (ch.activeConversations || 0), 0),
      avgResponseTime: calculateAvgResponseTime(stats),
      channelStats: stats.map((ch: any) => ({
        channel: ch.channel,
        messageCount: ch.messageCount || 0,
        activeConversations: ch.activeConversations || 0,
        avgResponseTime: ch.avgResponseTime || 0,
      })),
      messagesByHour: generateHourlyData(range),
      topCustomers: getTopCustomers(customers, 10),
    };

    return new Response(JSON.stringify(analytics), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Analytics error:', error);
    return new Response(
      JSON.stringify({
        error: 'Failed to fetch analytics',
        message: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      }
    );
  }
}

function calculateAvgResponseTime(stats: any[]): number {
  const times = stats
    .map((ch: any) => ch.avgResponseTime || 0)
    .filter((t: number) => t > 0);

  if (times.length === 0) return 0;
  return times.reduce((sum: number, t: number) => sum + t, 0) / times.length;
}

function generateHourlyData(range: string): Array<{ hour: number; count: number }> {
  // Generate mock hourly data for the last 24 hours
  // In production, this would query actual message timestamps
  const hours = 24;
  const data: Array<{ hour: number; count: number }> = [];

  for (let i = 0; i < hours; i++) {
    data.push({
      hour: i,
      count: Math.floor(Math.random() * 50) + 10, // Mock data
    });
  }

  return data;
}

function getTopCustomers(
  customers: any[],
  limit: number
): Array<{ id: string; name: string; messageCount: number }> {
  // Sort customers by message count and return top N
  return customers
    .map((c: any) => ({
      id: c.customerId,
      name: c.name || c.email || c.phone || 'Unknown',
      messageCount: c.messageCount || 0,
    }))
    .sort((a, b) => b.messageCount - a.messageCount)
    .slice(0, limit);
}
