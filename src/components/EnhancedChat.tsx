/**
 * Enhanced Chat component with WebSocket support
 * Features:
 * - Persistent WebSocket connection
 * - Real-time message streaming
 * - Task scheduling
 * - Session persistence
 * - Multi-connection support
 */

import { useState, useEffect, useRef, useCallback } from 'react';
import { ChatMessages } from './ChatMessages';
import { ChatInput } from './ChatInput';
import { TypingIndicator } from './TypingIndicator';

interface Message {
  id: string;
  role: 'user' | 'assistant' | 'tool';
  content: string;
  timestamp: number;
}

interface ChatProps {
  sessionId?: string;
  userId?: string;
  durableObjectUrl?: string;
}

export default function EnhancedChat({
  sessionId: initialSessionId,
  userId = 'user-' + Math.random().toString(36).slice(2),
  durableObjectUrl = '/api/agent',
}: ChatProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState(initialSessionId);
  const [isConnected, setIsConnected] = useState(false);
  const wsRef = useRef<WebSocket | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  /**
   * Connect to Durable Object via WebSocket
   */
  const connectWebSocket = useCallback(() => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      return;
    }

    try {
      const protocol = window.location.protocol === 'https:' ? 'wss' : 'ws';
      const url = `${protocol}://${window.location.host}${durableObjectUrl}/ws`;

      const ws = new WebSocket(url);

      ws.addEventListener('open', () => {
        console.log('WebSocket connected');
        setIsConnected(true);

        // Create session if needed
        if (!sessionId) {
          ws.send(
            JSON.stringify({
              action: 'create_session',
              userId,
            })
          );
        }

        // Request session data if we have a sessionId
        if (sessionId) {
          ws.send(
            JSON.stringify({
              action: 'get_session',
              sessionId,
            })
          );
        }
      });

      ws.addEventListener('message', (event) => {
        try {
          const data = JSON.parse(event.data);
          handleWebSocketMessage(data);
        } catch (error) {
          console.error('Failed to parse WebSocket message:', error);
        }
      });

      ws.addEventListener('close', () => {
        console.log('WebSocket disconnected');
        setIsConnected(false);
        // Attempt to reconnect after 3 seconds
        reconnectTimeoutRef.current = setTimeout(() => {
          connectWebSocket();
        }, 3000);
      });

      ws.addEventListener('error', (error) => {
        console.error('WebSocket error:', error);
      });

      wsRef.current = ws;
    } catch (error) {
      console.error('Failed to connect WebSocket:', error);
    }
  }, [sessionId, userId, durableObjectUrl]);

  /**
   * Handle messages from WebSocket
   */
  const handleWebSocketMessage = (data: any) => {
    switch (data.type) {
      case 'session_created':
        setSessionId(data.sessionId);
        console.log('Session created:', data.sessionId);
        break;

      case 'session_data':
        if (data.session?.messages) {
          setMessages(data.session.messages);
        }
        break;

      case 'message':
        setMessages((prev) => [...prev, data.message]);
        setLoading(false);
        break;

      case 'message_update':
        setMessages((prev) => [...prev, data.message]);
        break;

      case 'task_scheduled':
        console.log('Task scheduled:', data.taskId);
        // Optionally show notification
        break;

      case 'task_completed':
        console.log('Task completed:', data.taskId, data.result);
        // Show completion notification
        break;

      case 'task_failed':
        console.error('Task failed:', data.taskId, data.error);
        // Show error notification
        break;

      case 'error':
        console.error('WebSocket error:', data.message);
        setLoading(false);
        break;

      default:
        console.warn('Unknown message type:', data.type);
    }
  };

  /**
   * Send message via WebSocket
   */
  const handleSendMessage = useCallback(
    (content: string) => {
      if (!isConnected || !sessionId || !wsRef.current) {
        console.error('WebSocket not ready');
        return;
      }

      // Add user message optimistically
      const userMessage: Message = {
        id: `msg_${Date.now()}`,
        role: 'user',
        content,
        timestamp: Date.now(),
      };

      setMessages((prev) => [...prev, userMessage]);
      setLoading(true);

      // Send to Durable Object
      wsRef.current.send(
        JSON.stringify({
          action: 'send_message',
          sessionId,
          payload: {
            message: content,
          },
        })
      );
    },
    [isConnected, sessionId]
  );

  /**
   * Schedule a task
   */
  const scheduleTask = useCallback(
    (taskType: string, delayMs: number = 0, config?: any) => {
      if (!isConnected || !sessionId || !wsRef.current) {
        console.error('WebSocket not ready');
        return;
      }

      wsRef.current.send(
        JSON.stringify({
          action: 'schedule_task',
          sessionId,
          payload: {
            taskType,
            scheduledFor: Date.now() + delayMs,
            config,
          },
        })
      );
    },
    [isConnected, sessionId]
  );

  /**
   * Connect on mount
   */
  useEffect(() => {
    connectWebSocket();

    return () => {
      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
      }
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.close();
      }
    };
  }, [connectWebSocket]);

  return (
    <div className="flex flex-col h-screen bg-white">
      {/* Header */}
      <div className="bg-linear-to-r from-blue-600 to-blue-800 text-white p-4 shadow-lg">
        <div className="max-w-4xl mx-auto flex justify-between items-center">
          <div>
            <h1 className="text-2xl font-bold">AI Agent Chat</h1>
            <p className="text-blue-100 text-sm">
              Powered by Cloudflare Agents & Durable Objects
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div
              className={`w-3 h-3 rounded-full ${isConnected ? 'bg-green-400' : 'bg-red-400'}`}
            />
            <span className="text-sm">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
        </div>
      </div>

      {/* Session Info */}
      {sessionId && (
        <div className="bg-blue-50 border-b border-blue-200 px-4 py-2">
          <p className="text-xs text-gray-600">
            Session: <code className="font-mono text-blue-700">{sessionId}</code>
          </p>
        </div>
      )}

      {/* Messages */}
      <div className="flex-1 overflow-y-auto">
        <ChatMessages messages={messages.filter(m => m.role !== 'tool')} />
        {loading && <TypingIndicator />}
      </div>

      {/* Input */}
      <div className="border-t border-gray-200 bg-white">
        <ChatInput
          onSendMessage={handleSendMessage}
          disabled={!isConnected}
          placeholder={
            isConnected ? 'Type your message...' : 'Connecting...'
          }
        />

        {/* Quick Actions */}
        <div className="bg-gray-50 border-t border-gray-200 px-4 py-3 flex gap-2">
          <button
            onClick={() => scheduleTask('cleanup', 1000 * 60)}
            className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            disabled={!isConnected}
          >
            Schedule Cleanup
          </button>
          <button
            onClick={() => scheduleTask('summary', 0)}
            className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            disabled={!isConnected}
          >
            Get Summary
          </button>
          <button
            onClick={() => scheduleTask('export', 2000)}
            className="px-3 py-1 text-xs font-medium bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors"
            disabled={!isConnected}
          >
            Export Session
          </button>
        </div>
      </div>
    </div>
  );
}
