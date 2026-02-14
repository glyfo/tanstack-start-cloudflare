import { useRef } from "react";
import type { Connection } from "agents";

/**
 * useToolExecution Hook
 *
 * Handles client-side tool execution (time, location, device) and
 * tool invocation with timeout handling.
 */

interface PendingToolInvoke {
  resolve: (result: any) => void;
  reject: (error: Error) => void;
  timeout: ReturnType<typeof setTimeout>;
}

export function useToolExecution(connection: Connection | null) {
  const pendingToolInvokes = useRef<Map<string, PendingToolInvoke>>(new Map());
  const connectionRef = useRef(connection);

  // Keep connection ref up to date
  connectionRef.current = connection;

  /**
   * Execute client-side tools (time, location, device)
   */
  const executeClientTool = (executionId: string, toolId: string, params: Record<string, any>) => {
    console.log(`[ChatEngine] Executing client tool: ${toolId}`, params);

    let result: any = null;

    switch (toolId) {
      case "client.getTime": {
        const now = new Date();
        const format = params.format || "12h";

        result = {
          localTime: format === "12h"
            ? now.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })
            : now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit", hour12: false }),
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          utcTime: now.toUTCString(),
          timestamp: now.getTime(),
        };
        break;
      }

      case "client.getLocation": {
        result = {
          timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
          locale: navigator.language,
        };
        break;
      }

      case "client.getDevice": {
        result = {
          platform: navigator.platform,
          language: navigator.language,
          userAgent: navigator.userAgent,
        };
        break;
      }

      default:
        console.error(`[ChatEngine] Unknown client tool: ${toolId}`);
        result = { error: `Unknown tool: ${toolId}` };
    }

    // Send result back to server
    if (connectionRef.current) {
      connectionRef.current.send(JSON.stringify({
        type: "tool-result",
        executionId,
        toolId,
        result,
      }));
    }
  };

  /**
   * Invoke a tool and wait for result (MCP Apps pattern)
   */
  const invokeTool = (toolId: string, params: Record<string, any>): Promise<any> => {
    return new Promise((resolve, reject) => {
      const invokeId = Math.random().toString(36).slice(2);
      const TIMEOUT_MS = 30000; // 30 seconds

      const timeout = setTimeout(() => {
        pendingToolInvokes.current.delete(invokeId);
        reject(new Error(`Tool invocation timeout: ${toolId}`));
      }, TIMEOUT_MS);

      pendingToolInvokes.current.set(invokeId, { resolve, reject, timeout });

      if (connectionRef.current) {
        connectionRef.current.send(JSON.stringify({
          type: "tool-invoke",
          invokeId,
          toolId,
          params,
        }));
      } else {
        clearTimeout(timeout);
        pendingToolInvokes.current.delete(invokeId);
        reject(new Error("Not connected"));
      }
    });
  };

  /**
   * Handle tool invoke result from server
   */
  const handleToolInvokeResult = (invokeId: string, result: any) => {
    const pending = pendingToolInvokes.current.get(invokeId);
    if (pending) {
      clearTimeout(pending.timeout);
      pendingToolInvokes.current.delete(invokeId);
      pending.resolve(result);
    }
  };

  /**
   * Update context (send UI state to agent)
   */
  const updateContext = (key: string, value: any) => {
    if (connectionRef.current) {
      connectionRef.current.send(JSON.stringify({
        type: "context-update",
        key,
        value,
      }));
    }
  };

  /**
   * Clear all pending tool invokes (on disconnect)
   */
  const clearPendingToolInvokes = () => {
    pendingToolInvokes.current.forEach((pending) => {
      clearTimeout(pending.timeout);
      pending.reject(new Error("Connection closed"));
    });
    pendingToolInvokes.current.clear();
  };

  return {
    executeClientTool,
    invokeTool,
    handleToolInvokeResult,
    updateContext,
    clearPendingToolInvokes,
  };
}
