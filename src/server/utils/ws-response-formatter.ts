/**
 * WebSocket Response Formatter
 * Utility for building and sending typed WebSocket responses
 */

import { AgentResponse } from "@/types/chat-types";

export class WsResponseFormatter {
  /**
   * Send welcome response
   */
  static sendWelcome(
    ws: any,
    sessionId: string,
    domains: string[],
    skills: any[]
  ): void {
    const response: AgentResponse = {
      type: "welcome",
      sessionId,
      message:
        "Welcome! I can help you with sales, customer service, or support requests.",
      availableDomains: domains,
      availableSkills: skills,
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send error response
   */
  static sendError(ws: any, message: string): void {
    const response: AgentResponse = {
      type: "error",
      message,
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send skill result
   */
  static sendSkillResult(
    ws: any,
    skillId: string,
    domain: string,
    data?: any,
    nextSkill?: string
  ): void {
    const response: AgentResponse = {
      type: "skill_result",
      skillId,
      domain,
      data,
      nextSkill,
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send status message
   */
  static sendStatus(ws: any, message: string): void {
    const response: AgentResponse = {
      type: "status",
      message,
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send progress/processing update
   */
  static sendProgress(ws: any, stage: string, details?: any): void {
    const response: any = {
      type: "progress",
      stage,
      details,
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send typing indicator for agent processing
   */
  static sendProcessing(ws: any, isProcessing: boolean): void {
    const response: any = {
      type: "processing",
      isProcessing,
      timestamp: Date.now(),
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send user message to display in chat
   */
  static sendUserMessage(ws: any, content: string): void {
    const response: any = {
      type: "message_added",
      message: {
        id: crypto.randomUUID(),
        role: "user",
        content,
        timestamp: Date.now(),
      },
    };
    ws.send(JSON.stringify(response));
  }

  /**
   * Send agent message to display in chat
   */
  static sendAgentMessage(ws: any, content: string): void {
    const response: any = {
      type: "message_added",
      message: {
        id: crypto.randomUUID(),
        role: "agent",
        content,
        timestamp: Date.now(),
      },
    };
    ws.send(JSON.stringify(response));
  }
}
