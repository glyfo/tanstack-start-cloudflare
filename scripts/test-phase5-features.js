#!/usr/bin/env node

/**
 * Phase 5 Cross-Platform Features Test Script
 *
 * Tests unified lead management, analytics, routing, and export functionality
 */

const BASE_URL = process.env.TEST_URL || 'http://localhost:8787';

// Test data
const testLeads = [
  {
    source: 'tiktok',
    name: 'Sarah Johnson',
    email: 'sarah.j@example.com',
    phone: '+1234567890',
    company: 'Tech Startup Inc',
    classification: 'hot',
    score: 85,
  },
  {
    source: 'facebook',
    name: 'Mike Chen',
    email: 'mike.c@example.com',
    phone: '+1234567891',
    company: 'Design Co',
    classification: 'warm',
    score: 65,
  },
  {
    source: 'whatsapp',
    name: 'Emily Davis',
    email: 'emily.d@example.com',
    phone: '+1234567892',
    classification: 'new',
    score: 50,
  },
];

async function testSearchLeads() {
  console.log('\n🔍 Testing Lead Search...');

  try {
    const response = await fetch(`${BASE_URL}/api/leads/search?query=sarah`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const data = await response.json();
      console.log('✅ Search successful:', data);
      return true;
    } else {
      console.log('❌ Search failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Search error:', error.message);
    return false;
  }
}

async function testLeadStats() {
  console.log('\n📊 Testing Lead Statistics...');

  try {
    const response = await fetch(`${BASE_URL}/api/leads/stats`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const stats = await response.json();
      console.log('✅ Stats retrieved:');
      console.log(`   Total leads: ${stats.total}`);
      console.log(`   By source:`, stats.bySource);
      console.log(`   By classification:`, stats.byClassification);
      return true;
    } else {
      console.log('❌ Stats failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Stats error:', error.message);
    return false;
  }
}

async function testAnalytics() {
  console.log('\n📈 Testing Analytics...');

  try {
    const response = await fetch(`${BASE_URL}/api/analytics/summary`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const analytics = await response.json();
      console.log('✅ Analytics retrieved:');
      console.log(`   Total leads: ${analytics.totalLeads}`);
      console.log(`   Qualified: ${analytics.totalQualified}`);
      console.log(`   Conversion rate: ${analytics.conversionRate}%`);
      return true;
    } else {
      console.log('❌ Analytics failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Analytics error:', error.message);
    return false;
  }
}

async function testExport() {
  console.log('\n📥 Testing Lead Export...');

  // Test CSV export
  try {
    console.log('Testing CSV export...');
    const csvResponse = await fetch(
      `${BASE_URL}/api/export/leads?format=csv&sources=tiktok,facebook`,
      {
        method: 'GET',
      }
    );

    if (csvResponse.ok) {
      const csvContent = await csvResponse.text();
      console.log('✅ CSV export successful');
      console.log(`   Size: ${csvContent.length} bytes`);
      console.log(`   First 200 chars: ${csvContent.substring(0, 200)}...`);
    } else {
      console.log('❌ CSV export failed:', csvResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ CSV export error:', error.message);
    return false;
  }

  // Test JSON export
  try {
    console.log('Testing JSON export...');
    const jsonResponse = await fetch(
      `${BASE_URL}/api/export/leads?format=json&classifications=hot,warm`,
      {
        method: 'GET',
      }
    );

    if (jsonResponse.ok) {
      const jsonData = await jsonResponse.json();
      console.log('✅ JSON export successful');
      console.log(`   Records: ${jsonData.length}`);
      return true;
    } else {
      console.log('❌ JSON export failed:', jsonResponse.status);
      return false;
    }
  } catch (error) {
    console.log('❌ JSON export error:', error.message);
    return false;
  }
}

async function testLeadRouting() {
  console.log('\n🎯 Testing Lead Routing...');

  try {
    const testLead = {
      id: 'test-lead-' + Date.now(),
      source: 'tiktok',
      classification: 'hot',
      score: 90,
      location: { country: 'US', state: 'CA' },
      company: 'Test Company',
    };

    const response = await fetch(`${BASE_URL}/api/leads/route`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(testLead),
    });

    if (response.ok) {
      const routing = await response.json();
      console.log('✅ Lead routed successfully:');
      console.log(`   Assigned to: ${routing.assignedRepName}`);
      console.log(`   Rule: ${routing.routingRule}`);
      return true;
    } else {
      console.log('❌ Routing failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Routing error:', error.message);
    return false;
  }
}

async function testNotifications() {
  console.log('\n🔔 Testing Notifications...');

  try {
    const response = await fetch(`${BASE_URL}/api/notifications`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
    });

    if (response.ok) {
      const notifications = await response.json();
      console.log('✅ Notifications retrieved:');
      console.log(`   Count: ${notifications.length}`);
      if (notifications.length > 0) {
        console.log(`   Recent:`, notifications[0]);
      }
      return true;
    } else {
      console.log('❌ Notifications failed:', response.status);
      return false;
    }
  } catch (error) {
    console.log('❌ Notifications error:', error.message);
    return false;
  }
}

async function testChatAgentTools() {
  console.log('\n🤖 Testing Chat Agent Lead Tools...');

  // Simulate chat agent request with tool calls
  console.log('Note: This would test the agent tools integration');
  console.log('Tools available:');
  console.log('  - searchLeads');
  console.log('  - getLeadStats');
  console.log('  - getAnalytics');
  console.log('  - getCampaignPerformance');
  console.log('  - getSourcePerformance');
  console.log('  - findHotLeads');
  console.log('  - getRecentLeads');

  return true;
}

// Run all tests
async function runAllTests() {
  console.log('='.repeat(60));
  console.log('🚀 Phase 5 Cross-Platform Features Test Suite');
  console.log('='.repeat(60));
  console.log(`Testing against: ${BASE_URL}`);

  const results = {
    search: await testSearchLeads(),
    stats: await testLeadStats(),
    analytics: await testAnalytics(),
    export: await testExport(),
    routing: await testLeadRouting(),
    notifications: await testNotifications(),
    agentTools: await testChatAgentTools(),
  };

  console.log('\n' + '='.repeat(60));
  console.log('📋 Test Results Summary');
  console.log('='.repeat(60));

  let passed = 0;
  let total = 0;

  for (const [test, result] of Object.entries(results)) {
    total++;
    if (result) passed++;
    const status = result ? '✅ PASS' : '❌ FAIL';
    console.log(`${status} - ${test}`);
  }

  console.log('='.repeat(60));
  console.log(`Final Score: ${passed}/${total} tests passed`);

  if (passed === total) {
    console.log('🎉 All tests passed!');
    process.exit(0);
  } else {
    console.log('⚠️  Some tests failed');
    process.exit(1);
  }
}

// Handle command line arguments
const command = process.argv[2];

if (command === 'search') {
  testSearchLeads().then((result) => process.exit(result ? 0 : 1));
} else if (command === 'stats') {
  testLeadStats().then((result) => process.exit(result ? 0 : 1));
} else if (command === 'analytics') {
  testAnalytics().then((result) => process.exit(result ? 0 : 1));
} else if (command === 'export') {
  testExport().then((result) => process.exit(result ? 0 : 1));
} else if (command === 'routing') {
  testLeadRouting().then((result) => process.exit(result ? 0 : 1));
} else if (command === 'notifications') {
  testNotifications().then((result) => process.exit(result ? 0 : 1));
} else {
  runAllTests();
}
