/**
 * AE Agent (Account Executive)
 * Focuses on deal closing and revenue generation
 * Critical for GTM: Mid-funnel, converts leads to customers
 *
 * Role: Present solutions, negotiate pricing, create quotes, close deals
 * Memory: deal_structure, negotiation_state, competitor_intelligence, contract_stage
 * Tools: createQuote, updateDealStage, requestApproval
 */

import { getMemoryManager } from "../memory-manager";
import {
  MemoryBlock,
  findMemoryBlock,
  renderMemoryBlocksForPrompt,
} from "../types/agent-memory";

export interface AEContext {
  sessionId: string;
  userId: string;
  dealId: string;
  customerId: string;
  env: any;
  ws: any;
}

export interface DealAnalysis {
  dealSize: number;
  dealStage: string;
  closureProbability: number;
  nextStep: string;
  requiresApproval: boolean;
  objectionHandled: boolean;
}

export class AEAgent {
  private memoryManager = getMemoryManager();

  /**
   * Process message as AE
   * Goal: Move deal forward through pipeline, handle objections, negotiate, close
   */
  async processMessage(
    userMessage: string,
    context: AEContext
  ): Promise<{
    response: string;
    dealAnalysis?: DealAnalysis;
    quoteGenerated?: boolean;
    escalatedForApproval?: boolean;
  }> {
    const { sessionId, dealId, env } = context;

    // Load AE's memory for this deal
    const aeMemory = await this.memoryManager.loadMemory("ae", sessionId);

    // Analyze message for objections, negotiation, or closing signals
    const dealSignals = this.analyzeDealSignals(userMessage, aeMemory);

    // Build system prompt for AE
    const systemPrompt = this.buildAESystemPrompt(aeMemory, dealSignals);

    // Get AI response
    const aiResponse = await this.callAI(userMessage, systemPrompt, context);

    // Extract deal analysis
    const dealAnalysis = this.analyzeDealProgress(
      aiResponse.text,
      aeMemory,
      dealSignals
    );

    // Update AE memory with deal progress
    await this.updateAEMemory(
      sessionId,
      userMessage,
      aiResponse.text,
      dealAnalysis,
      aeMemory
    );

    // Check if quote needed
    const quoteGenerated =
      aiResponse.text.toLowerCase().includes("quote") ||
      aiResponse.toolCalls?.some((t) => t.name === "createQuote");

    // Check if approval needed
    const escalatedForApproval =
      dealAnalysis.dealSize > 50000 &&
      aiResponse.toolCalls?.some((t) => t.name === "requestApproval");

    return {
      response: aiResponse.text,
      dealAnalysis,
      quoteGenerated,
      escalatedForApproval,
    };
  }

  /**
   * Build AE-specific system prompt
   */
  private buildAESystemPrompt(aeMemory: any, dealSignals: any): string {
    const memoryContext = renderMemoryBlocksForPrompt(aeMemory.blocks);
    const dealBlock = findMemoryBlock(aeMemory.blocks, "deal_structure");
    const dealValue = dealBlock?.value || "";

    return `You are an Account Executive. Your mission:
1. Present tailored solutions that address customer pain points
2. Handle objections with confidence and data
3. Negotiate pricing/terms within your flexibility limits
4. Create customized proposals and quotes
5. Move deals through the pipeline to closure
6. Request approval for deals that need management sign-off

Deal Signals Detected:
- Objection: ${dealSignals.objectionDetected || "None"}
- Negotiation Signal: ${dealSignals.negotiationSignal || "None"}
- Budget Discussion: ${dealSignals.budgetDiscussed || "No"}
- Closing Signal: ${dealSignals.closingSignal || "No"}

Current Deal Context:
${memoryContext}

Your Strategy:
✅ Acknowledge customer's concerns (shows you listen)
✅ Present ROI/value in their business terms
✅ Use social proof (similar companies, case studies)
✅ Propose specific next step (demo, walkthrough, proposal)
✅ Confirm timeline and decision process
✅ If pricing objection: explain value, offer term flexibility
✅ If authority objection: ask to involve decision maker
✅ If timeline objection: create urgency (limited offer, process time)

Remember: Close on value, not price. Protect margin by trading flexibility.
Examples: 
- "We can do 10% for annual commitment" 
- "Free implementation if you sign Q1"
- "Extra users at 50% off for year 2"`;
  }

  /**
   * Analyze message for deal signals
   */
  private analyzeDealSignals(
    userMessage: string,
    aeMemory: any
  ): {
    objectionDetected: string | null;
    negotiationSignal: string | null;
    budgetDiscussed: boolean;
    closingSignal: string | null;
  } {
    const lower = userMessage.toLowerCase();

    // Objection detection
    let objectionDetected = null;
    const objectionKeywords: { [key: string]: string } = {
      "too expensive": "Price objection",
      "can't afford": "Price objection",
      expensive: "Price objection",
      competitor: "Competitor objection",
      integrations: "Capability objection",
      security: "Security/Compliance objection",
      timing: "Timeline objection",
      "need to think": "Authority/Consensus objection",
    };

    for (const [keyword, objection] of Object.entries(objectionKeywords)) {
      if (lower.includes(keyword)) {
        objectionDetected = objection;
        break;
      }
    }

    // Negotiation signals
    let negotiationSignal = null;
    if (
      lower.includes("discount") ||
      lower.includes("best price") ||
      lower.includes("can you do")
    ) {
      negotiationSignal = "Customer asking for negotiation";
    }

    // Budget discussion
    const budgetDiscussed =
      lower.includes("budget") ||
      lower.includes("cost") ||
      lower.includes("price") ||
      lower.includes("$") ||
      /\d+k|\d+,\d{3}/.test(userMessage);

    // Closing signals
    let closingSignal = null;
    const closingKeywords = [
      "sounds good",
      "looks good",
      "ready to move forward",
      "lets do it",
      "let's do it",
      "sign me up",
      "when can we start",
      "next steps",
    ];
    if (closingKeywords.some((kw) => lower.includes(kw))) {
      closingSignal = "Strong closing signal detected";
    }

    return {
      objectionDetected,
      negotiationSignal,
      budgetDiscussed,
      closingSignal,
    };
  }

  /**
   * Call AI for AE response
   */
  private async callAI(
    userMessage: string,
    systemPrompt: string,
    context: AEContext
  ): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; arguments: any }>;
  }> {
    const { env } = context;

    // In production: return env.AI.run('llama-3.1-8b', {...})
    // For now, return mock response
    return {
      text: `I understand pricing is a key consideration. Let me show you the ROI. Most customers in your space see 3x return within 6 months. 

What if we structured it as: Annual commitment gets 15% discount, plus we throw in implementation and training at no extra cost. Would that work within your budget?`,
      toolCalls: [],
    };
  }

  /**
   * Analyze deal progress
   */
  private analyzeDealProgress(
    aiResponse: string,
    aeMemory: any,
    dealSignals: any
  ): DealAnalysis {
    const dealBlock = findMemoryBlock(aeMemory.blocks, "deal_structure");
    const negotiationBlock = findMemoryBlock(
      aeMemory.blocks,
      "negotiation_state"
    );

    // Extract deal size
    const dealSizeMatch = dealBlock?.value.match(/deal_size: (\d+)/);
    const dealSize = dealSizeMatch ? parseInt(dealSizeMatch[1]) : 0;

    // Analyze stage
    const stageMatch = negotiationBlock?.value.match(
      /negotiation_stage: (\w+)/
    );
    const dealStage = stageMatch ? stageMatch[1] : "discovery";

    // Calculate closure probability based on signals
    let closureProb = 0.3; // Start at 30%
    if (dealSignals.objectionDetected) closureProb -= 0.1;
    if (dealSignals.closingSignal) closureProb += 0.4;
    if (dealSignals.budgetDiscussed) closureProb += 0.15;
    if (
      aiResponse.toLowerCase().includes("proposal") ||
      aiResponse.toLowerCase().includes("quote")
    ) {
      closureProb += 0.15;
    }

    closureProb = Math.max(0, Math.min(1, closureProb)); // Clamp 0-1

    // Determine next step
    let nextStep = "Continue discovery";
    if (dealStage === "proposal") {
      nextStep = "Send proposal and schedule walkthrough";
    } else if (dealStage === "negotiation") {
      nextStep = "Finalize terms and create quote";
    } else if (dealSignals.closingSignal) {
      nextStep = "Request signature on MSA";
    } else if (dealSignals.objectionDetected) {
      nextStep = "Address objection and requalify";
    }

    return {
      dealSize,
      dealStage,
      closureProb: Math.round(closureProb * 100),
      nextStep,
      requiresApproval: dealSize > 50000,
      objectionHandled: !dealSignals.objectionDetected,
    };
  }

  /**
   * Update AE memory with deal progress
   */
  private async updateAEMemory(
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    dealAnalysis: DealAnalysis,
    currentMemory: any
  ): Promise<void> {
    // Update deal stage if progressed
    const dealBlock = findMemoryBlock(currentMemory.blocks, "deal_structure");
    if (dealBlock && dealAnalysis.dealStage !== "discovery") {
      await this.memoryManager.replaceInMemoryBlock(
        "ae",
        sessionId,
        "deal_structure",
        /deal_stage: \w+/,
        `deal_stage: ${dealAnalysis.dealStage}`
      );
    }

    // Update negotiation state
    const negotiationBlock = findMemoryBlock(
      currentMemory.blocks,
      "negotiation_state"
    );
    if (negotiationBlock) {
      let updated = negotiationBlock.value;
      updated = updated.replace(
        /negotiation_stage: \w+/,
        `negotiation_stage: ${dealAnalysis.dealStage}`
      );
      updated = updated.replace(
        /last_proposal_date: null/,
        `last_proposal_date: ${new Date().toISOString()}`
      );

      await this.memoryManager.updateMemoryBlock(
        "ae",
        sessionId,
        "negotiation_state",
        updated
      );
    }

    // Append to conversation history
    await this.memoryManager.appendToMemoryBlock(
      "ae",
      sessionId,
      "deal_structure",
      `\n[${new Date().toISOString()}] Customer: "${userMessage.substring(0, 60)}..."`
    );
  }

  /**
   * Create quote (called by AI via tool)
   */
  async createQuote(
    sessionId: string,
    dealSize: number,
    term: number,
    discount: number
  ): Promise<{
    quoteId: string;
    total: number;
    monthly: number;
  }> {
    const discountedSize = dealSize * (1 - discount);
    const monthly = discountedSize / term;

    return {
      quoteId: `Q-${Date.now()}`,
      total: discountedSize,
      monthly: Math.round(monthly),
    };
  }

  /**
   * Get AE metrics for dashboard
   */
  async getMetrics(sessionId: string): Promise<{
    dealsInProgress: number;
    closureRate: number;
    averageDealSize: number;
    salesCycle: number;
  }> {
    // In production, aggregate from memory and database
    return {
      dealsInProgress: 0,
      closureRate: 0,
      averageDealSize: 0,
      salesCycle: 0,
    };
  }
}

// Export singleton
let aeAgent: AEAgent | null = null;

export function getAEAgent(): AEAgent {
  if (!aeAgent) {
    aeAgent = new AEAgent();
  }
  return aeAgent;
}
