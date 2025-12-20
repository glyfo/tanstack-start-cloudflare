#!/usr/bin/env node

import WebSocket from 'ws';

async function testChat() {
  const sessionId = 'test-' + Date.now();
  const ws = new WebSocket(`ws://localhost:3000/agents/ChatAgent/${sessionId}`);

  ws.on('open', () => {
    console.log('✓ WebSocket connected');
    
    // Send a test message
    const message = {
      type: 'chat',
      content: 'Hello, what is 2+2?',
      userId: 'test-user'
    };
    
    console.log('→ Sending:', JSON.stringify(message));
    ws.send(JSON.stringify(message));
  });

  ws.on('message', (data) => {
    try {
      const parsed = JSON.parse(data.toString());
      console.log(`← Received [${parsed.type}]:`, JSON.stringify(parsed).substring(0, 200));
    } catch (e) {
      console.log('← Received (raw):', data.toString().substring(0, 200));
    }
  });

  ws.on('error', (error) => {
    console.error('✗ Error:', error.message);
  });

  ws.on('close', () => {
    console.log('✓ WebSocket closed');
    process.exit(0);
  });

  // Close after 30 seconds
  setTimeout(() => {
    console.log('\n⏱ Timeout - closing connection');
    ws.close();
  }, 30000);
}

testChat();
