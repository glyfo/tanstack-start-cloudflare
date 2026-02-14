/**
 * TikTok Webhook Test Script
 *
 * Tests the TikTok Lead Generation webhook endpoint
 * Usage: node scripts/test-tiktok-webhook.js [url]
 *
 * Example:
 *   node scripts/test-tiktok-webhook.js http://localhost:3000
 *   node scripts/test-tiktok-webhook.js https://your-app.workers.dev
 */

const crypto = require('crypto');

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:3000';
const WEBHOOK_SECRET = process.env.TIKTOK_WEBHOOK_SECRET || 'dev-secret';
const WEBHOOK_PATH = '/api/webhooks/tiktok';
const WEBHOOK_URL = `${BASE_URL}${WEBHOOK_PATH}`;

// Sample TikTok webhook payload
const payload = {
  event: 'lead.create',
  timestamp: Math.floor(Date.now() / 1000),
  page_id: 'page_123456',
  page_name: 'Test Business Page',
  leads: [
    {
      event_id: `test_event_${Date.now()}`,
      event_time: Math.floor(Date.now() / 1000),
      event_type: 'FORM_SUBMIT',
      form_id: 'form_789',
      form_name: 'Contact Form - Free Demo',
      ad_id: 'ad_456',
      ad_name: 'Winter Campaign Ad 1',
      campaign_id: 'campaign_123',
      campaign_name: 'Q1 2026 Lead Gen Campaign',
      creative_id: 'creative_999',
      page_id: 'page_123456',
      page_name: 'Test Business Page',
      user_details: {
        name: 'John Doe',
        email: 'john.doe@example.com',
        phone: '+1-555-123-4567',
        company: 'Acme Corp',
        city: 'San Francisco',
        state: 'CA',
        country: 'USA',
        zip: '94105',
        custom_fields: {
          budget_range: '$10k-$50k',
          timeline: '1-3 months',
          problem: 'Need better CRM solution',
          role: 'VP of Sales'
        }
      }
    }
  ]
};

/**
 * Generate HMAC-SHA256 signature for TikTok webhook
 */
function generateSignature(payloadString, secret) {
  const hmac = crypto.createHmac('sha256', secret);
  hmac.update(payloadString);
  return hmac.digest('base64');
}

/**
 * Send test webhook request
 */
async function testWebhook() {
  console.log('\n🧪 TikTok Webhook Test');
  console.log('='.repeat(50));
  console.log(`\n📍 Target URL: ${WEBHOOK_URL}`);
  console.log(`🔑 Using Secret: ${WEBHOOK_SECRET.substring(0, 3)}...`);

  // Convert payload to JSON string
  const payloadString = JSON.stringify(payload);
  console.log(`\n📦 Payload Size: ${payloadString.length} bytes`);
  console.log(`📋 Lead Count: ${payload.leads.length}`);
  console.log(`👤 Test Lead: ${payload.leads[0].user_details.name} (${payload.leads[0].user_details.email})`);

  // Generate signature
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);
  console.log(`\n🔒 Signature: ${signature.substring(0, 20)}...`);

  // Prepare request
  const headers = {
    'Content-Type': 'application/json',
    'X-TikTok-Signature': signature,
    'User-Agent': 'TikTok-Webhook-Test/1.0'
  };

  console.log('\n📤 Sending request...');

  try {
    const startTime = Date.now();
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: payloadString
    });

    const duration = Date.now() - startTime;
    const responseText = await response.text();

    console.log(`\n✅ Response received (${duration}ms)`);
    console.log(`📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📄 Content-Type: ${response.headers.get('content-type')}`);

    // Parse response if JSON
    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('\n📝 Response Body:');
      console.log(JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.log('\n📝 Response Body (raw):');
      console.log(responseText);
    }

    // Verify success
    if (response.ok && responseData?.success) {
      console.log('\n✅ TEST PASSED');
      console.log(`✓ Lead processed successfully`);
      if (responseData.results) {
        responseData.results.forEach((result, index) => {
          console.log(`  - Lead ${index + 1}: ${result.status} (ID: ${result.lead_id})`);
        });
      }
      process.exit(0);
    } else {
      console.log('\n❌ TEST FAILED');
      if (responseData?.error) {
        console.log(`  Error: ${responseData.error}`);
      }
      process.exit(1);
    }

  } catch (error) {
    console.error('\n❌ REQUEST FAILED');
    console.error(`  Error: ${error.message}`);
    if (error.cause) {
      console.error(`  Cause: ${error.cause}`);
    }
    process.exit(1);
  }
}

/**
 * Test with invalid signature
 */
async function testInvalidSignature() {
  console.log('\n🧪 Testing Invalid Signature');
  console.log('='.repeat(50));

  const payloadString = JSON.stringify(payload);
  const invalidSignature = 'invalid_signature_test_12345';

  console.log(`\n📤 Sending request with invalid signature...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TikTok-Signature': invalidSignature
      },
      body: payloadString
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.status === 401) {
      console.log('✅ Correctly rejected invalid signature');
      return true;
    } else {
      console.log('❌ Should have rejected invalid signature');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

/**
 * Test with duplicate lead
 */
async function testDuplicateLead() {
  console.log('\n🧪 Testing Duplicate Lead Detection');
  console.log('='.repeat(50));

  // Send same lead twice
  console.log('\n📤 Sending first lead...');
  await testWebhook();

  console.log('\n📤 Sending duplicate lead...');
  const payloadString = JSON.stringify(payload);
  const signature = generateSignature(payloadString, WEBHOOK_SECRET);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-TikTok-Signature': signature
      },
      body: payloadString
    });

    const responseData = await response.json();

    if (responseData.results?.[0]?.status === 'duplicate') {
      console.log('✅ Correctly detected duplicate lead');
      return true;
    } else {
      console.log('⚠️  Duplicate not detected (may be expected if dedup window expired)');
      return false;
    }
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n🚀 Starting TikTok Webhook Tests\n');

  const testMode = process.env.TEST_MODE || 'basic';

  if (testMode === 'full') {
    // Run all tests
    console.log('Running full test suite...\n');

    // Test 1: Valid webhook
    await testWebhook();

    // Test 2: Invalid signature
    const invalidSigResult = await testInvalidSignature();

    // Test 3: Duplicate detection (optional)
    if (process.env.TEST_DUPLICATE === 'true') {
      await testDuplicateLead();
    }

    console.log('\n✅ All tests completed\n');
  } else {
    // Run basic test only
    await testWebhook();
  }
}

// Run tests
main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
