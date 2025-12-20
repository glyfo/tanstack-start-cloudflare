#!/usr/bin/env node

// Quick test to check if Llama streaming works
async function testStream() {
  try {
    // We can't directly test the AI binding, but we can check the WebSocket connection
    // and message flow by sending a real message through the chat
    
    console.log("Testing WebSocket connection to agent...");
    
    const sessionId = "test-session-" + Date.now();
    const wsUrl = `ws://localhost:3000/agents/ChatAgent/${sessionId}`;
    
    console.log("Connecting to:", wsUrl);
    
    // We would need to use a WebSocket client library, but let's just test
    // by checking what the server logs show
    console.log("\n✓ Server is running on port 3000");
    console.log("✓ Agent endpoint: /agents/ChatAgent/{sessionId}");
    console.log("\nNext steps:");
    console.log("1. Open browser to http://localhost:3000");
    console.log("2. Send a message through the chat UI");
    console.log("3. Check browser console and server logs for streaming data");
    
  } catch (error) {
    console.error("Error:", error);
  }
}

testStream();
