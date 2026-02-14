/**
 * Facebook Lead Ads Webhook Test Script
 *
 * Tests the Facebook Lead Generation webhook endpoint
 * Usage: node scripts/test-facebook-webhook.js [url]
 *
 * Example:
 *   node scripts/test-facebook-webhook.js http://localhost:3000
 *   node scripts/test-facebook-webhook.js https://your-app.workers.dev
 */

const crypto = require('crypto');

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:3000';
const APP_SECRET = process.env.FACEBOOK_APP_SECRET || 'dev-facebook-app-secret';
const VERIFY_TOKEN = process.env.FACEBOOK_VERIFY_TOKEN || 'dev-facebook-verify-token';
const WEBHOOK_PATH = '/api/webhooks/facebook';
const WEBHOOK_URL = `${BASE_URL}${WEBHOOK_PATH}`;

// Sample Facebook webhook payload
const payload = {
  object: 'page',
  entry: [
    {
      id: 'page_123456',
      time: Math.floor(Date.now() / 1000),
      changes: [
        {
          field: 'leadgen',
          value: {
            ad_id: '123456789',
            form_id: '987654321',
            leadgen_id: `lead_${Date.now()}`,
            created_time: Math.floor(Date.now() / 1000),
            page_id: 'page_123456',
            adgroup_id: '456789123'
          }
        }
      ]
    }
  ]
};

/**
 * Generate HMAC-SHA256 signature for Facebook webhook
 */
function generateSignature(payloadString, appSecret) {
  const hmac = crypto.createHmac('sha256', appSecret);
  hmac.update(payloadString);
  const signature = hmac.digest('hex');
  return `sha256=${signature}`;
}

/**
 * Test webhook verification (GET request)
 */
async function testVerification() {
  console.log('\n🧪 Testing Facebook Webhook Verification (GET)');
  console.log('='.repeat(50));

  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': VERIFY_TOKEN,
    'hub.challenge': 'test_challenge_12345'
  });

  const url = `${WEBHOOK_URL}?${params}`;

  console.log(`\n📍 Target URL: ${url}`);
  console.log(`🔑 Verify Token: ${VERIFY_TOKEN}`);

  try {
    const response = await fetch(url, {
      method: 'GET'
    });

    const responseText = await response.text();

    console.log(`\n📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📝 Response: ${responseText}`);

    if (response.status === 200 && responseText === 'test_challenge_12345') {
      console.log('\n✅ VERIFICATION PASSED');
      return true;
    } else {
      console.log('\n❌ VERIFICATION FAILED');
      return false;
    }
  } catch (error) {
    console.error('\n❌ VERIFICATION REQUEST FAILED');
    console.error(`  Error: ${error.message}`);
    return false;
  }
}

/**
 * Send test webhook request (POST)
 */
async function testWebhook() {
  console.log('\n🧪 Facebook Lead Ads Webhook Test (POST)');
  console.log('='.repeat(50));
  console.log(`\n📍 Target URL: ${WEBHOOK_URL}`);
  console.log(`🔑 Using App Secret: ${APP_SECRET.substring(0, 3)}...`);

  // Convert payload to JSON string
  const payloadString = JSON.stringify(payload);
  console.log(`\n📦 Payload Size: ${payloadString.length} bytes`);
  console.log(`📋 Entry Count: ${payload.entry.length}`);
  console.log(`👤 Leadgen ID: ${payload.entry[0].changes[0].value.leadgen_id}`);

  // Generate signature
  const signature = generateSignature(payloadString, APP_SECRET);
  console.log(`\n🔒 Signature: ${signature.substring(0, 25)}...`);

  // Prepare request
  const headers = {
    'Content-Type': 'application/json',
    'X-Hub-Signature-256': signature,
    'User-Agent': 'Facebook-Webhook-Test/1.0'
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
      console.log(`✓ Lead webhook processed successfully`);
      if (responseData.results) {
        responseData.results.forEach((result, index) => {
          console.log(`  - Lead ${index + 1}: ${result.status} (ID: ${result.lead_id || result.leadgen_id})`);
          if (result.error) {
            console.log(`    Error: ${result.error}`);
          }
        });
      }
      return true;
    } else {
      console.log('\n❌ TEST FAILED');
      if (responseData?.error) {
        console.log(`  Error: ${responseData.error}`);
      }
      return false;
    }

  } catch (error) {
    console.error('\n❌ REQUEST FAILED');
    console.error(`  Error: ${error.message}`);
    if (error.cause) {
      console.error(`  Cause: ${error.cause}`);
    }
    return false;
  }
}

/**
 * Test with invalid signature
 */
async function testInvalidSignature() {
  console.log('\n🧪 Testing Invalid Signature');
  console.log('='.repeat(50));

  const payloadString = JSON.stringify(payload);
  const invalidSignature = 'sha256=invalid_signature_test_12345';

  console.log(`\n📤 Sending request with invalid signature...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Hub-Signature-256': invalidSignature
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
 * Test with missing signature
 */
async function testMissingSignature() {
  console.log('\n🧪 Testing Missing Signature');
  console.log('='.repeat(50));

  const payloadString = JSON.stringify(payload);

  console.log(`\n📤 Sending request without signature...`);

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: payloadString
    });

    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    if (response.status === 401) {
      console.log('✅ Correctly rejected missing signature');
      return true;
    } else {
      console.log('❌ Should have rejected missing signature');
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
  console.log('\n🚀 Starting Facebook Webhook Tests\n');

  const testMode = process.env.TEST_MODE || 'basic';

  if (testMode === 'full') {
    // Run all tests
    console.log('Running full test suite...\n');

    const results = {
      verification: await testVerification(),
      webhook: await testWebhook(),
      invalidSignature: await testInvalidSignature(),
      missingSignature: await testMissingSignature()
    };

    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`✓ Verification: ${results.verification ? 'PASSED' : 'FAILED'}`);
    console.log(`✓ Webhook POST: ${results.webhook ? 'PASSED' : 'FAILED'}`);
    console.log(`✓ Invalid Signature: ${results.invalidSignature ? 'PASSED' : 'FAILED'}`);
    console.log(`✓ Missing Signature: ${results.missingSignature ? 'PASSED' : 'FAILED'}`);

    const allPassed = Object.values(results).every(result => result);
    if (allPassed) {
      console.log('\n✅ All tests passed\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed\n');
      process.exit(1);
    }
  } else {
    // Run basic tests only
    const verifyPassed = await testVerification();
    const webhookPassed = await testWebhook();

    if (verifyPassed && webhookPassed) {
      console.log('\n✅ Basic tests passed\n');
      process.exit(0);
    } else {
      console.log('\n❌ Some tests failed\n');
      process.exit(1);
    }
  }
}

// Run tests
main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
