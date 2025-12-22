/**
 * Router Agent
 * Intelligent orchestrator that detects intent and routes to appropriate agents
 * Based on Discord agent pattern with memory blocks and tool calling
 */

import { A2UIBuilder } from "./a2ui-builder";
import { detectIntent, DetectedIntent } from "./router/intent-detector";
import { getMemoryManager, MemoryManager } from "./memory-manager";
import {
  MemoryBlock,
  findMemoryBlock,
  updateMemoryBlock,
  renderMemoryBlocksForPrompt,
} from "../types/agent-memory";

export interface RouterContext {
  sessionId: string;
  userId: string;
  env: any;
  ws: any;
}

export interface RoutingDecision {
  targetAgent: "support" | "csm" | "ae" | "sdr" | "human";
  reasoning: string;
  shouldHandoff: boolean;
}

export class RouterAgent {
  private memoryManager: MemoryManager;
  private currentAgent: string = "none";
  private a2uiBuilder: A2UIBuilder;

  constructor() {
    this.memoryManager = getMemoryManager();
    this.a2uiBuilder = new A2UIBuilder();
  }

  /**
   * Main entry point: process user message through router
   */
  async processMessage(
    userMessage: string,
    context: RouterContext
  ): Promise<{
    response: string;
    routedTo: string;
    shouldHandoff: boolean;
    a2uiComponents?: any[];
  }> {
    const { sessionId, env } = context;

    // 1. Load router memory
    const routerMemory = await this.memoryManager.loadMemory(
      "router",
      sessionId
    );

    // 2. Detect intent from message
    const intent = await detectIntent(userMessage);

    // 3. Determine routing decision
    const decision = await this.makeRoutingDecision(
      intent,
      routerMemory,
      userMessage
    );

    // 4. Update router memory with interaction
    await this.updateInteractionHistory(sessionId, userMessage, decision);

    // 5. Route to appropriate agent or human
    if (decision.targetAgent === "human") {
      return {
        response: await this.handleHumanEscalation(
          sessionId,
          userMessage,
          decision.reasoning
        ),
        routedTo: "human",
        shouldHandoff: true,
      };
    }

    // 6. Delegate to specialized agent
    const agentResponse = await this.delegateToAgent(
      decision.targetAgent,
      userMessage,
      context,
      routerMemory
    );

    return {
      response: agentResponse.response,
      routedTo: decision.targetAgent,
      shouldHandoff: decision.shouldHandoff,
      a2uiComponents: agentResponse.a2uiComponents,
    };
  }

  /**
   * Make routing decision based on intent and context
   */
  private async makeRoutingDecision(
    intent: DetectedIntent,
    routerMemory: any,
    userMessage: string
  ): Promise<RoutingDecision> {
    // If human is explicitly required, escalate
    if (intent.requiresHuman) {
      return {
        targetAgent: "human",
        reasoning: `Escalation required: ${intent.reason}`,
        shouldHandoff: true,
      };
    }

    // Check if we should stay with current agent
    const currentAgentBlock = findMemoryBlock(
      routerMemory.blocks,
      "current_agent_assignment"
    );
    const currentAgentValue = currentAgentBlock?.value || "";

    if (
      this.currentAgent !== "none" &&
      shouldStayWithCurrentAgent(intent, userMessage)
    ) {
      return {
        targetAgent: this.currentAgent as any,
        reasoning: `Continuing with ${this.currentAgent} (context continuity)`,
        shouldHandoff: false,
      };
    }

    // Route to primary intent agent
    return {
      targetAgent: intent.primaryAgent as any,
      reasoning: intent.reason,
      shouldHandoff: this.currentAgent !== intent.primaryAgent,
    };
  }

  /**
   * Delegate message to specialized agent
   */
  private async delegateToAgent(
    agentRole: "support" | "csm" | "ae" | "sdr",
    userMessage: string,
    context: RouterContext,
    routerMemory: any
  ): Promise<{ response: string; a2uiComponents?: any[] }> {
    const { sessionId, env } = context;

    // Load agent's memory
    const agentMemory = await this.memoryManager.loadMemory(
      agentRole,
      sessionId
    );

    // Build system prompt with agent's memory context
    const systemPrompt = this.buildAgentSystemPrompt(agentRole, agentMemory);

    // Get AI response
    const aiResponse = await this.callAI(
      userMessage,
      systemPrompt,
      agentRole,
      context,
      sessionId
    );

    // Check for tool calls in response
    if (aiResponse.toolCalls && aiResponse.toolCalls.length > 0) {
      for (const toolCall of aiResponse.toolCalls) {
        await this.executeAgentTool(agentRole, toolCall, sessionId);
      }
    }

    // Check for escalation request
    if (this.shouldEscalate(aiResponse, agentRole)) {
      return {
        response: await this.handleEscalation(agentRole, aiResponse, sessionId),
      };
    }

    // Return response with optional A2UI components
    const a2uiComponents = this.a2uiBuilder.fromTextResponse(aiResponse.text);

    return {
      response: aiResponse.text,
      a2uiComponents,
    };
  }

  /**
   * Build system prompt with agent role instructions and memory
   */
  private buildAgentSystemPrompt(
    agentRole: "support" | "csm" | "ae" | "sdr",
    agentMemory: any
  ): string {
    const roleInstructions = this.getRoleInstructions(agentRole);
    const memoryContext = renderMemoryBlocksForPrompt(agentMemory.blocks);

    return `${roleInstructions}

===== AGENT MEMORY =====
${memoryContext}

===== TOOLS YOU CAN CALL =====
You have access to tools to update your memory and perform actions.
Examples:
- memoryReplace(blockLabel, oldText, newText) - Update memory
- memoryInsert(blockLabel, textToInsert) - Add to memory
- updateIssueStatus(status) - For support agent
- updateDealStage(stage) - For AE agent
- updateHealthScore(score) - For CSM agent
- scoreQualified(score, level) - For SDR agent

Use tools to remember important information about this conversation.

===== CURRENT CONVERSATION =====`;
  }

  /**
   * Get role-specific instructions for agent
   */
  private getRoleInstructions(
    agentRole: "support" | "csm" | "ae" | "sdr"
  ): string {
    const instructions = {
      support: `You are a Support Agent. Your role:
- Diagnose technical issues quickly
- Provide clear, actionable solutions
- Escalate complex issues to managers
- Use knowledge base to answer questions
- Be empathetic and professional
Success: Resolve issues in <2 hours with 80%+ self-service rate`,

      sdr: `You are an SDR (Sales Development Rep). Your role:
- Qualify leads using BANT criteria
- Book discovery calls and demos
- Provide company information and pricing details
- Personalize outreach based on company
- Hand off qualified leads to Account Executives
Success: 30%+ lead qualification rate, high demo booking`,

      ae: `You are an Account Executive. Your role:
- Present tailored solutions to qualified leads
- Negotiate pricing and contract terms
- Handle objections professionally
- Create customized quotes
- Move deals through sales pipeline
Success: 25%+ deal closure, $50k+ average deal size`,

      csm: `You are a Customer Success Manager. Your role:
- Guide customers to onboarding success
- Monitor customer health and adoption
- Identify expansion and upsell opportunities
- Proactively resolve satisfaction issues
- Build long-term relationships
Success: 95%+ NRR, 15%+ expansion revenue`,
    };

    return instructions[agentRole];
  }

  /**
   * Call Cloudflare AI with streaming
   */
  private async callAI(
    userMessage: string,
    systemPrompt: string,
    agentRole: string,
    context: RouterContext,
    sessionId: string
  ): Promise<any> {
    const { env } = context;

    // For now, return mock response
    // In production, this would call env.AI.run() with streaming
    return {
      text: `I'm a ${agentRole} agent. I'll help you with this issue.`,
      toolCalls: [],
    };
  }

  /**
   * Execute tool called by agent
   */
  private async executeAgentTool(
    agentRole: string,
    toolCall: any,
    sessionId: string
  ): Promise<void> {
    const { name, arguments: args } = toolCall;

    switch (name) {
      case "memoryInsert":
        await this.memoryManager.appendToMemoryBlock(
          agentRole as any,
          sessionId,
          args.blockLabel,
          args.textToInsert
        );
        break;

      case "memoryReplace":
        await this.memoryManager.replaceInMemoryBlock(
          agentRole as any,
          sessionId,
          args.blockLabel,
          args.oldText,
          args.newText
        );
        break;

      case "memoryUpdate":
        await this.memoryManager.updateMemoryBlock(
          agentRole as any,
          sessionId,
          args.blockLabel,
          args.newContent
        );
        break;

      default:
        console.log(`[${agentRole}] Tool called: ${name}`, args);
    }
  }

  /**
   * Check if agent is requesting escalation
   */
  private shouldEscalate(aiResponse: any, agentRole: string): boolean {
    // Check if escalation tool was called
    if (
      aiResponse.toolCalls?.some((t: any) => t.name === "escalateToManager")
    ) {
      return true;
    }

    // Check response text for escalation signals
    const escalationKeywords = [
      "escalate",
      "manager",
      "supervisor",
      "need human",
      "complex issue",
      "beyond my",
    ];
    return escalationKeywords.some((kw) =>
      aiResponse.text.toLowerCase().includes(kw)
    );
  }

  /**
   * Handle escalation from agent
   */
  private async handleEscalation(
    agentRole: string,
    aiResponse: any,
    sessionId: string
  ): Promise<string> {
    // Update router memory to flag for human
    await this.memoryManager.updateMemoryBlock(
      "router",
      sessionId,
      "current_agent_assignment",
      `agent: ${agentRole}\nescalation: true\nreason: ${aiResponse.text}`
    );

    return `This requires human attention. A ${agentRole} manager will contact you shortly.`;
  }

  /**
   * Handle human escalation
   */
  private async handleHumanEscalation(
    sessionId: string,
    userMessage: string,
    reason: string
  ): Promise<string> {
    // Update memory
    await this.memoryManager.updateMemoryBlock(
      "router",
      sessionId,
      "interaction_history",
      `\nEscalation to human: ${reason}\nUser message: ${userMessage}`
    );

    return `I'm connecting you with a human specialist who can help better. They'll be with you shortly.`;
  }

  /**
   * Update interaction history in router memory
   */
  private async updateInteractionHistory(
    sessionId: string,
    userMessage: string,
    decision: RoutingDecision
  ): Promise<void> {
    const timestamp = new Date().toISOString();
    const historyEntry = `[${timestamp}] Route: ${decision.targetAgent} | Message: "${userMessage.substring(0, 50)}..."`;

    await this.memoryManager.appendToMemoryBlock(
      "router",
      sessionId,
      "interaction_history",
      historyEntry
    );

    // Update current agent assignment
    await this.memoryManager.updateMemoryBlock(
      "router",
      sessionId,
      "current_agent_assignment",
      `agent: ${decision.targetAgent}\nassigned_at: ${timestamp}\nreason: ${decision.reasoning}`
    );

    this.currentAgent = decision.targetAgent;
  }
}

/**
 * Helper: Determine if we should stay with current agent
 */
function shouldStayWithCurrentAgent(
  intent: DetectedIntent,
  userMessage: string
): boolean {
  // If confidence is low, might need to switch
  if (intent.confidence < 0.6) {
    return true; // Stay to maintain context
  }

  // If same agent detected, stay
  // (would compare with currentAgent in actual implementation)
  return false;
}

// Create and export singleton
let routerAgent: RouterAgent | null = null;

export function getRouterAgent(): RouterAgent {
  if (!routerAgent) {
    routerAgent = new RouterAgent();
  }
  return routerAgent;
}
