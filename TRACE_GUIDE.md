# Chat Message Flow - Trace Guide

## Overview

This guide shows you how to trace a message through the entire chat system, from user input to server response.

## Message Journey

```
┌─────────────────────────────────────────────────────────────────┐
│                    USER SENDS MESSAGE                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 1️⃣  CHAT INPUT (Client)                                          │
│    [ChatInput] Input changed → Form submitted                    │
│    ✅ Logs: input value, length, submission status              │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 2️⃣  SEND MESSAGE (Client)                                        │
│    [ChatEngine] 📤 SENDING MESSAGE                               │
│    [Chat:xxxxx] ✅ CHAT MESSAGE SENT / FIELD VALUE SENT         │
│    ✅ Logs: message type, content length                         │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 3️⃣  WEBSOCKET SEND (Client)                                     │
│    [Chat:xxxxx] 📤 WEBSOCKET SEND                               │
│    ✅ Logs: type, payload size, connection state                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    [NETWORK]
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 4️⃣  SERVER MESSAGE RECEIVED (Server)                             │
│    [Server:xxxxx] 📨 MESSAGE RECEIVED                            │
│    [Server:xxxxx] 🔍 PARSED MESSAGE                              │
│    [Server:xxxxx] 💾 MESSAGE STORED                              │
│    ✅ Logs: message type, content, session info                 │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 5️⃣  INTENT DETECTION (Server)                                    │
│    [Server:xxxxx] 🔎 DETECTING INTENT                            │
│    [Server:xxxxx] 🎯 INTENT DETECTED                             │
│    ✅ Logs: domain, intent, routing decision                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
            ┌────────────┴──────────────┐
            │                           │
            ▼                           ▼
   ┌─────────────────┐       ┌─────────────────┐
   │ WORKFLOW FOUND  │       │ NO WORKFLOW     │
   │ 🚀 Execute      │       │ 💬 Conversation │
   └────────┬────────┘       └────────┬────────┘
            │                          │
            ▼                          ▼
   ┌──────────────────────┐   ┌──────────────────────┐
   │ 6️⃣  WORKFLOW SKILL    │   │ 6️⃣  CONVERSATION SKILL│
   │ [Server:xxxxx]       │   │ [Server:xxxxx]       │
   │ 🚀 EXECUTING WORKFLOW│   │ 💬 EXECUTING CONV    │
   │ 📤 WORKFLOW RESULT   │   │ ✅ RESPONSE RECEIVED │
   │                      │   │                      │
   │ Processes form data  │   │ Generates response   │
   └────────┬─────────────┘   └────────┬─────────────┘
            │                          │
            └────────────┬─────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 7️⃣  RESPONSE READY (Server)                                      │
│    [Server:xxxxx] ✅ PROCESSING COMPLETE                         │
│    ✅ Logs: total processing duration                            │
└────────────────────────┬────────────────────────────────────────┘
                         │
                    [NETWORK]
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 8️⃣  WEBSOCKET MESSAGE RECEIVED (Client)                          │
│    [Chat:xxxxx] 📨 WEBSOCKET MESSAGE RECEIVED                    │
│    ✅ Logs: message type, payload size, keys                     │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 9️⃣  UPDATE STATE (Client)                                        │
│    [useChatState] Adding message                                 │
│    [useChatState] Added new message                              │
│    ✅ Logs: message ID, role, content length, total count       │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────────┐
│ 🔟  RENDER MESSAGES (Client)                                     │
│    [ChatMessages] Rendering                                      │
│    [ChatMessages] Rendering message N                            │
│    ✅ Logs: total messages, loading state, errors                │
└────────────────────────┬────────────────────────────────────────┘
                         │
                         ▼
                  ✅ MESSAGE VISIBLE
```

## How to Read the Logs

### Browser Console Trace

1. **Open DevTools**: Press `F12` in your browser
2. **Go to Console tab**: Click on "Console"
3. **Type in search box**: `[Chat` or `[Server`

### Understanding Log Entries

Each log entry follows this format:

```
[Chat:xxxxx] 🎯 EVENT_NAME { timestamp, duration, data... }
[Server:xxxxx] 🔍 EVENT_NAME { sessionId, contentLen... }
```

#### Client-Side Prefixes (`[Chat:xxxxx]`)

- `🔗 WEBSOCKET CONNECTION INITIATED` - Starting connection
- `✅ WEBSOCKET CONNECTED` - Connection established
- `📤 WEBSOCKET SEND` - Sending message to server
- `📨 WEBSOCKET MESSAGE RECEIVED` - Receiving response from server
- `❌ PARSE ERROR` - Failed to parse server response
- `❌ WEBSOCKET ERROR` - Connection error

#### Server-Side Prefixes (`[Server:xxxxx]`)

- `📨 MESSAGE RECEIVED` - Server received message
- `🔍 PARSED MESSAGE` - Message parsed successfully
- `💾 MESSAGE STORED` - Message saved to state
- `🔎 DETECTING INTENT` - Analyzing user intent
- `🎯 INTENT DETECTED` - Intent identified
- `🚀 EXECUTING WORKFLOW` - Running workflow
- `💬 EXECUTING CONVERSATION` - Running conversation skill
- `📤 WORKFLOW RESULT` - Workflow returned result
- `✅ PROCESSING COMPLETE` - Message fully processed
- `❌ PROCESSING ERROR` - Error during processing

#### State Prefixes (`[useChatState]`)

- `Adding message` - Adding new message to state
- `Updated existing message` - Updating streaming message
- `Added new message` - Message added successfully

#### Message Prefixes (`[ChatMessages]`)

- `Rendering` - Messages component rendering
- `Rendering message N` - Individual message rendering

#### Input Prefixes (`[ChatInput]`)

- `Input changed` - User typing in input field
- `Form submitted` - User sent message
- `Enter key pressed` - Enter key detected
- `Send button clicked` - Button clicked

## Debugging Common Issues

### Issue: Message Not Appearing

1. **Check ChatInput logs** - Did form submit? Look for "Form submitted"
2. **Check WEBSOCKET SEND** - Did message reach server? Look for "📤 WEBSOCKET SEND"
3. **Check SERVER MESSAGE RECEIVED** - Did server get it? Look for "[Server:xxxxx] 📨 MESSAGE RECEIVED"
4. **Check WEBSOCKET MESSAGE RECEIVED** - Did response come back? Look for "[Chat:xxxxx] 📨 WEBSOCKET MESSAGE RECEIVED"
5. **Check ChatMessages rendering** - Is it in state? Look for "[useChatState] Added new message"

### Issue: WebSocket Not Connecting

1. Check `✅ WEBSOCKET CONNECTED` appears in logs
2. If missing, check for `❌ WEBSOCKET ERROR`
3. Verify server is running (look for server logs)
4. Check network tab for WebSocket connection details

### Issue: Server Processing Fails

1. Look for `[Server:xxxxx] 📨 MESSAGE RECEIVED` - is message reaching server?
2. Check `[Server:xxxxx] 🔍 PARSED MESSAGE` - is JSON valid?
3. Check `[Server:xxxxx] 🎯 INTENT DETECTED` - is intent recognized?
4. Check `[Server:xxxxx] ✅ PROCESSING COMPLETE` - did processing finish?
5. Look for `[Server:xxxxx] ❌ PROCESSING ERROR` - what error occurred?

## Trace Timeline

Use the **timestamp** field in logs to understand timing:

```
[Chat:abc123] 📤 WEBSOCKET SEND { timestamp: "2025-12-26T10:30:00.123Z" }
[Server:xyz789] 📨 MESSAGE RECEIVED { timestamp: "2025-12-26T10:30:00.145Z" } // ~22ms later
[Server:xyz789] ✅ PROCESSING COMPLETE { duration: 145 } // 145ms to process
[Chat:abc123] 📨 WEBSOCKET MESSAGE RECEIVED { timestamp: "2025-12-26T10:30:00.295Z" } // Response came back
```

## Example Successful Flow

```
[Chat:a1b2c3d4] 🔗 WEBSOCKET CONNECTION INITIATED
[Chat:a1b2c3d4] ✅ WEBSOCKET CONNECTED { duration: 42 }
[ChatInput] Input changed { valueLen: 5 }
[ChatInput] Form submitted { inputLen: 5 }
[Chat:a1b2c3d4] 📤 SENDING MESSAGE { contentLen: 5 }
[Chat:a1b2c3d4] ✅ CHAT MESSAGE SENT
[Chat:a1b2c3d4] 📤 WEBSOCKET SEND { type: "chat", payloadSize: 145 }
[Server:x9y8z7w6] 📨 MESSAGE RECEIVED { dataSize: 145 }
[Server:x9y8z7w6] 🔍 PARSED MESSAGE { type: "chat", contentLen: 5 }
[Server:x9y8z7w6] 💾 MESSAGE STORED { messageCount: 3 }
[Server:x9y8z7w6] 🔎 DETECTING INTENT { messageLen: 5 }
[Server:x9y8z7w6] 🎯 INTENT DETECTED { domain: null }
[Server:x9y8z7w6] 💬 ROUTING TO CONVERSATION
[Server:x9y8z7w6] 💬 EXECUTING CONVERSATION SKILL
[Server:x9y8z7w6] ✅ CONVERSATION RESPONSE RECEIVED { responseLen: 120 }
[Server:x9y8z7w6] ✅ PROCESSING COMPLETE { duration: 234 }
[Chat:a1b2c3d4] 📨 WEBSOCKET MESSAGE RECEIVED { type: "message_complete" }
[useChatState] Adding message { id: "msg-123", role: "assistant", contentLen: 120 }
[useChatState] Added new message { id: "msg-123", totalMessages: 4 }
[ChatMessages] Rendering { messagesCount: 4, isLoading: false }
[ChatMessages] Rendering message 0: { id: "1", role: "assistant" }
[ChatMessages] Rendering message 1: { id: "msg-abc", role: "user" }
[ChatMessages] Rendering message 2: { id: "msg-123", role: "assistant" }
```

## Tips for Effective Debugging

1. **Use Console Filters**: Search for specific messages or components
2. **Watch Timeline**: Note timestamps to see where delays occur
3. **Check Message IDs**: Each message has unique `xxxxx` to track it through system
4. **Monitor Connection State**: Look for "CONNECTED" before "SEND"
5. **Watch for Errors**: Any "❌" log indicates a problem

---

**Last Updated**: December 26, 2025
