import { Connection } from "agents";

interface ConnectionMetadata {
  connectedAt: number;
  lastMessageAt: number;
  messageCount: number;
}

export class ChatConnectionManager {
  private connections = new Map<Connection, ConnectionMetadata>();
  private static readonly MAX_CONNECTIONS = 5;
  private static readonly MAX_MESSAGE_SIZE = 100 * 1024; // 100KB

  constructor() {}

  /**
   * Accept a new connection if within limits
   */
  accept(connection: Connection): boolean {
    const currentCount = this.connections.size;
    
    if (currentCount >= ChatConnectionManager.MAX_CONNECTIONS) {
      console.warn(`[ChatConnectionManager] Connection limit reached: ${currentCount}/${ChatConnectionManager.MAX_CONNECTIONS}`);
      connection.send(JSON.stringify({
        type: "error",
        message: "Maximum connections exceeded. Please close other tabs.",
        code: "MAX_CONNECTIONS_EXCEEDED",
        maxConnections: ChatConnectionManager.MAX_CONNECTIONS
      }));
      connection.close(1008, "Too many connections");
      return false;
    }

    this.connections.set(connection, {
      connectedAt: Date.now(),
      lastMessageAt: Date.now(),
      messageCount: 0
    });

    console.log(`[ChatConnectionManager] Connection accepted. ID: ${connection.id}, Total: ${this.connections.size}`);
    return true;
  }

  /**
   * Handle connection closure
   */
  remove(connection: Connection) {
    if (this.connections.delete(connection)) {
      console.log(`[ChatConnectionManager] Connection removed. ID: ${connection.id}, Remaining: ${this.connections.size}`);
    }
  }

  /**
   * Get all active connections
   */
  getConnections(): IterableIterator<Connection> {
    return this.connections.keys();
  }

  /**
   * Get first available connection (useful for default responses)
   */
  getFirstConnection(): Connection | undefined {
    return this.connections.keys().next().value;
  }

  /**
   * Broadcast message to all connections
   */
  broadcast(message: any) {
    const data = typeof message === "string" ? message : JSON.stringify(message);
    for (const [connection] of this.connections) {
      try {
        connection.send(data);
      } catch (error) {
        console.error(`[ChatConnectionManager] Failed to broadcast to ${connection.id}:`, error);
      }
    }
  }

  /**
   * Send message to specific connection
   */
  send(connection: Connection, message: any) {
    try {
      const data = typeof message === "string" ? message : JSON.stringify(message);
      connection.send(data);
    } catch (error) {
      console.error(`[ChatConnectionManager] Failed to send to ${connection.id}:`, error);
    }
  }

  /**
   * Validate incoming message size
   */
  validateMessageSize(data: string | unknown): boolean {
    if (typeof data === "string" && data.length > ChatConnectionManager.MAX_MESSAGE_SIZE) {
      return false;
    }
    return true;
  }

  /**
   * Get current connection count
   */
  getConnectionCount(): number {
    return this.connections.size;
  }
}
