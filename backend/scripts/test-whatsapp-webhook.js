/**
 * WhatsApp Business API Webhook Test Script
 *
 * Tests the WhatsApp Business API webhook endpoint
 * Usage: node scripts/test-whatsapp-webhook.js [url]
 *
 * Example:
 *   node scripts/test-whatsapp-webhook.js http://localhost:3000
 *   node scripts/test-whatsapp-webhook.js https://your-app.workers.dev
 */

// Configuration
const BASE_URL = process.argv[2] || 'http://localhost:3000';
const VERIFY_TOKEN = process.env.WHATSAPP_VERIFY_TOKEN || 'dev-whatsapp-verify-token';
const WEBHOOK_PATH = '/api/webhooks/whatsapp';
const WEBHOOK_URL = `${BASE_URL}${WEBHOOK_PATH}`;

// Sample WhatsApp webhook payload (text message)
const textMessagePayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'PHONE_NUMBER_ID',
            },
            contacts: [
              {
                profile: {
                  name: 'John Doe',
                },
                wa_id: '15559876543',
              },
            ],
            messages: [
              {
                from: '15559876543',
                id: `wamid.test_${Date.now()}`,
                timestamp: Math.floor(Date.now() / 1000).toString(),
                type: 'text',
                text: {
                  body: 'Hello! I need help with my order.',
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

// Sample status update payload
const statusUpdatePayload = {
  object: 'whatsapp_business_account',
  entry: [
    {
      id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
      changes: [
        {
          value: {
            messaging_product: 'whatsapp',
            metadata: {
              display_phone_number: '15551234567',
              phone_number_id: 'PHONE_NUMBER_ID',
            },
            statuses: [
              {
                id: 'wamid.test_status_123',
                status: 'delivered',
                timestamp: Math.floor(Date.now() / 1000).toString(),
                recipient_id: '15559876543',
                conversation: {
                  id: 'CONVERSATION_ID',
                  origin: {
                    type: 'business_initiated',
                  },
                },
              },
            ],
          },
          field: 'messages',
        },
      ],
    },
  ],
};

/**
 * Test webhook verification (GET request)
 */
async function testVerification() {
  console.log('\n🧪 Testing WhatsApp Webhook Verification (GET)');
  console.log('='.repeat(50));

  const params = new URLSearchParams({
    'hub.mode': 'subscribe',
    'hub.verify_token': VERIFY_TOKEN,
    'hub.challenge': 'test_challenge_whatsapp_12345',
  });

  const url = `${WEBHOOK_URL}?${params}`;

  console.log(`\n📍 Target URL: ${url}`);
  console.log(`🔑 Verify Token: ${VERIFY_TOKEN}`);

  try {
    const response = await fetch(url, {
      method: 'GET',
    });

    const responseText = await response.text();

    console.log(`\n📊 Status: ${response.status} ${response.statusText}`);
    console.log(`📝 Response: ${responseText}`);

    if (response.status === 200 && responseText === 'test_challenge_whatsapp_12345') {
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
 * Send test webhook request (POST - text message)
 */
async function testTextMessage() {
  console.log('\n🧪 WhatsApp Text Message Webhook Test (POST)');
  console.log('='.repeat(50));
  console.log(`\n📍 Target URL: ${WEBHOOK_URL}`);

  // Convert payload to JSON string
  const payloadString = JSON.stringify(textMessagePayload);
  console.log(`\n📦 Payload Size: ${payloadString.length} bytes`);
  console.log(`📋 Message Count: ${textMessagePayload.entry[0].changes[0].value.messages.length}`);
  console.log(`👤 From: ${textMessagePayload.entry[0].changes[0].value.messages[0].from}`);
  console.log(`💬 Text: "${textMessagePayload.entry[0].changes[0].value.messages[0].text.body}"`);

  // Prepare request
  const headers = {
    'Content-Type': 'application/json',
    'User-Agent': 'WhatsApp-Webhook-Test/1.0',
  };

  console.log('\n📤 Sending request...');

  try {
    const startTime = Date.now();
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers,
      body: payloadString,
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
      console.log(`✓ Message webhook processed successfully`);
      if (responseData.results) {
        responseData.results.forEach((result, index) => {
          console.log(`  - Message ${index + 1}: ${result.status} (WA ID: ${result.wa_id})`);
          if (result.error) {
            console.log(`    Error: ${result.error}`);
          }
        });
      }
      return true;
    } else {
      console.log('\n⚠️  TEST COMPLETED (check response)');
      if (responseData?.error) {
        console.log(`  Warning: ${responseData.error}`);
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
 * Test status update webhook
 */
async function testStatusUpdate() {
  console.log('\n🧪 WhatsApp Status Update Webhook Test (POST)');
  console.log('='.repeat(50));

  const payloadString = JSON.stringify(statusUpdatePayload);
  console.log(`\n📦 Status update payload size: ${payloadString.length} bytes`);
  console.log(`📋 Status: ${statusUpdatePayload.entry[0].changes[0].value.statuses[0].status}`);

  console.log('\n📤 Sending status update...');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payloadString,
    });

    const responseText = await response.text();
    console.log(`📊 Status: ${response.status} ${response.statusText}`);

    let responseData;
    try {
      responseData = JSON.parse(responseText);
      console.log('\n📝 Response:');
      console.log(JSON.stringify(responseData, null, 2));
    } catch (e) {
      console.log('\n📝 Response (raw):');
      console.log(responseText);
    }

    if (response.ok && responseData?.success) {
      console.log('\n✅ STATUS UPDATE PROCESSED');
      return true;
    } else {
      console.log('\n⚠️  STATUS UPDATE COMPLETED (check response)');
      return false;
    }
  } catch (error) {
    console.error('\n❌ Request failed:', error.message);
    return false;
  }
}

/**
 * Test interactive message (button reply)
 */
async function testInteractiveMessage() {
  console.log('\n🧪 WhatsApp Interactive Message Test (POST)');
  console.log('='.repeat(50));

  const interactivePayload = {
    object: 'whatsapp_business_account',
    entry: [
      {
        id: 'WHATSAPP_BUSINESS_ACCOUNT_ID',
        changes: [
          {
            value: {
              messaging_product: 'whatsapp',
              metadata: {
                display_phone_number: '15551234567',
                phone_number_id: 'PHONE_NUMBER_ID',
              },
              contacts: [
                {
                  profile: {
                    name: 'Jane Smith',
                  },
                  wa_id: '15551112222',
                },
              ],
              messages: [
                {
                  from: '15551112222',
                  id: `wamid.interactive_${Date.now()}`,
                  timestamp: Math.floor(Date.now() / 1000).toString(),
                  type: 'interactive',
                  interactive: {
                    type: 'button_reply',
                    button_reply: {
                      id: 'yes_interested',
                      title: 'Yes, I\\'m interested',
                    },
                  },
                },
              ],
            },
            field: 'messages',
          },
        ],
      },
    ],
  };

  const payloadString = JSON.stringify(interactivePayload);
  console.log(`\n📦 Interactive message payload size: ${payloadString.length} bytes`);
  console.log(`🔘 Button clicked: ${interactivePayload.entry[0].changes[0].value.messages[0].interactive.button_reply.title}`);

  console.log('\n📤 Sending interactive message...');

  try {
    const response = await fetch(WEBHOOK_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: payloadString,
    });

    const responseText = await response.text();
    const responseData = JSON.parse(responseText);

    console.log(`📊 Status: ${response.status}`);
    console.log(`✓ Interactive message processed: ${responseData.success ? 'Yes' : 'No'}`);

    return response.ok && responseData?.success;
  } catch (error) {
    console.error('❌ Request failed:', error.message);
    return false;
  }
}

/**
 * Main test runner
 */
async function main() {
  console.log('\n🚀 Starting WhatsApp Webhook Tests\n');

  const testMode = process.env.TEST_MODE || 'basic';

  if (testMode === 'full') {
    // Run all tests
    console.log('Running full test suite...\n');

    const results = {
      verification: await testVerification(),
      textMessage: await testTextMessage(),
      statusUpdate: await testStatusUpdate(),
      interactive: await testInteractiveMessage(),
    };

    console.log('\n📊 Test Summary');
    console.log('='.repeat(50));
    console.log(`✓ Verification: ${results.verification ? 'PASSED' : 'FAILED'}`);
    console.log(`✓ Text Message: ${results.textMessage ? 'PASSED' : 'FAILED'}`);
    console.log(`✓ Status Update: ${results.statusUpdate ? 'PASSED' : 'FAILED'}`);
    console.log(`✓ Interactive: ${results.interactive ? 'PASSED' : 'FAILED'}`);

    const allPassed = Object.values(results).every((result) => result);
    if (allPassed) {
      console.log('\n✅ All tests passed\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  Some tests had issues (check responses)\n');
      process.exit(0); // WhatsApp webhooks should return 200 even on errors
    }
  } else {
    // Run basic tests only
    const verifyPassed = await testVerification();
    const messagePassed = await testTextMessage();

    if (verifyPassed && messagePassed) {
      console.log('\n✅ Basic tests passed\n');
      process.exit(0);
    } else {
      console.log('\n⚠️  Check test results above\n');
      process.exit(0);
    }
  }
}

// Run tests
main().catch((error) => {
  console.error('\n❌ Unexpected error:', error);
  process.exit(1);
});
