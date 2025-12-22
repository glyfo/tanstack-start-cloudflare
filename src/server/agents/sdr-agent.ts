/**
 * SDR Agent (Sales Development Representative)
 * Focuses on lead qualification and meeting booking
 * Critical for GTM: Top of funnel, lead generation at scale
 *
 * Role: Qualify leads using BANT, schedule demos, escalate to AE
 * Memory: lead_profile, engagement_strategy, qualification_criteria, follow_up_state
 * Tools: scoreLead, scheduleDemo, escalateToAE
 */

import { getMemoryManager } from "../memory-manager";
import {
  MemoryBlock,
  findMemoryBlock,
  renderMemoryBlocksForPrompt,
} from "../types/agent-memory";

export interface SDRContext {
  sessionId: string;
  userId: string;
  leadId: string;
  env: any;
  ws: any;
}

export interface QualificationScore {
  score: number;
  budget: number;
  authority: number;
  need: number;
  timeline: number;
  overallLevel: "unqualified" | "mql" | "sql" | "ready_for_ae";
}

export class SDRAgent {
  private memoryManager = getMemoryManager();

  /**
   * Process message as SDR
   * Goal: Qualify lead, understand BANT, schedule meeting
   */
  async processMessage(
    userMessage: string,
    context: SDRContext
  ): Promise<{
    response: string;
    qualification?: QualificationScore;
    demoScheduled?: boolean;
    escalatedToAE?: boolean;
  }> {
    const { sessionId, leadId, env } = context;

    // Load SDR's memory for this lead
    const sdrMemory = await this.memoryManager.loadMemory("sdr", sessionId);

    // Analyze message for BANT signals
    const bantAnalysis = this.analyzeBantSignals(userMessage, sdrMemory);

    // Build system prompt for SDR
    const systemPrompt = this.buildSDRSystemPrompt(sdrMemory, bantAnalysis);

    // Get AI response
    const aiResponse = await this.callAI(userMessage, systemPrompt, context);

    // Extract qualification score from response
    const qualScore = this.extractQualificationScore(
      aiResponse.text,
      sdrMemory
    );

    // Update memory with conversation progress
    await this.updateSDRMemory(
      sessionId,
      userMessage,
      aiResponse.text,
      qualScore,
      sdrMemory
    );

    // Check if ready to escalate to AE
    const shouldEscalate = qualScore.overallLevel === "ready_for_ae";

    // Check if scheduling demo
    const demoScheduled =
      aiResponse.text.toLowerCase().includes("scheduled") ||
      aiResponse.text.toLowerCase().includes("booked") ||
      aiResponse.toolCalls?.some((t) => t.name === "scheduleDemo");

    return {
      response: aiResponse.text,
      qualification: qualScore,
      demoScheduled,
      escalatedToAE: shouldEscalate,
    };
  }

  /**
   * Build SDR-specific system prompt
   */
  private buildSDRSystemPrompt(sdrMemory: any, bantAnalysis: any): string {
    const memoryContext = renderMemoryBlocksForPrompt(sdrMemory.blocks);

    return `You are an SDR (Sales Development Representative). Your mission:
1. Qualify the lead using BANT criteria (Budget, Authority, Need, Timeline)
2. Present relevant use cases and value proposition
3. Schedule a product demo or discovery call with an AE
4. Be friendly, consultative, and professional
5. If ready, escalate to Account Executive

Current BANT Analysis:
- Budget: ${bantAnalysis.budget || "Unknown"}
- Authority: ${bantAnalysis.authority || "Unknown"}
- Need: ${bantAnalysis.need || "Unknown"}
- Timeline: ${bantAnalysis.timeline || "Unknown"}
- Overall Confidence: ${bantAnalysis.confidence}%

Agent Memory:
${memoryContext}

Your Response Should:
✅ Ask clarifying questions on weak BANT areas
✅ Emphasize relevant use cases for their company size
✅ Suggest specific demo time if BANT is strong
✅ Be authentic and curious, not salesy
✅ Update your memory about what you learned

Remember: Your job is to determine if this is a qualified lead worth an AE's time.
Don't oversell - honest qualification is better than wrong qualification.`;
  }

  /**
   * Analyze message for BANT signals
   */
  private analyzeBantSignals(
    userMessage: string,
    sdrMemory: any
  ): {
    budget: string | null;
    authority: string | null;
    need: string | null;
    timeline: string | null;
    confidence: number;
  } {
    const lower = userMessage.toLowerCase();

    // Budget signals
    let budget = null;
    if (lower.includes("budget")) {
      budget = "Mentioned budget";
    } else if (lower.includes("approved") || lower.includes("fund")) {
      budget = "Has budget flexibility";
    }

    // Authority signals
    let authority = null;
    if (
      lower.includes("i decide") ||
      lower.includes("decision maker") ||
      lower.includes("i approve")
    ) {
      authority = "Decision maker";
    } else if (lower.includes("need to check") || lower.includes("ask my")) {
      authority = "Influencer, not decision maker";
    }

    // Need signals
    let need = null;
    const needKeywords = [
      "problem",
      "issue",
      "challenge",
      "pain point",
      "struggling",
      "not working",
    ];
    if (needKeywords.some((kw) => lower.includes(kw))) {
      need = "Explicit pain point mentioned";
    }

    // Timeline signals
    let timeline = null;
    const timelineKeywords = [
      "asap",
      "urgent",
      "immediately",
      "next month",
      "q1",
      "q2",
      "q3",
      "q4",
    ];
    if (timelineKeywords.some((kw) => lower.includes(kw))) {
      timeline = "Timeline mentioned";
    }

    // Calculate confidence
    const signals = [budget, authority, need, timeline].filter(
      (s) => s !== null
    ).length;
    const confidence = Math.round((signals / 4) * 100);

    return { budget, authority, need, timeline, confidence };
  }

  /**
   * Call AI for SDR response
   */
  private async callAI(
    userMessage: string,
    systemPrompt: string,
    context: SDRContext
  ): Promise<{
    text: string;
    toolCalls?: Array<{ name: string; arguments: any }>;
  }> {
    const { env } = context;

    // In production: return env.AI.run('llama-3.1-8b', {...})
    // For now, return mock response
    return {
      text: `Great question! Let me understand your situation better. How many people on your team would need access to this platform?`,
      toolCalls: [],
    };
  }

  /**
   * Extract qualification score from AI response
   */
  private extractQualificationScore(
    aiResponse: string,
    sdrMemory: any
  ): QualificationScore {
    // Start with 0 score
    let totalScore = 0;
    let budget = 0;
    let authority = 0;
    let need = 0;
    let timeline = 0;

    // Check lead profile for existing info
    const profileBlock = findMemoryBlock(sdrMemory.blocks, "lead_profile");
    const qualBlock = findMemoryBlock(
      sdrMemory.blocks,
      "qualification_criteria"
    );

    if (
      profileBlock &&
      profileBlock.value.includes("company_size: enterprise")
    ) {
      budget += 15;
      authority += 10;
    }

    if (qualBlock && qualBlock.value.includes("budget_available: yes")) {
      budget += 25;
    }

    if (
      qualBlock &&
      qualBlock.value.includes("authority_level: decision_maker")
    ) {
      authority += 25;
    }

    if (qualBlock && qualBlock.value.includes("need_identified: true")) {
      need += 25;
    }

    if (
      (qualBlock && qualBlock.value.includes("timeline_months: 0")) ||
      qualBlock.value.includes("timeline_months: 1")
    ) {
      timeline += 25;
    }

    totalScore = budget + authority + need + timeline;

    // Determine qualification level
    let overallLevel: "unqualified" | "mql" | "sql" | "ready_for_ae" =
      "unqualified";
    if (totalScore >= 75) {
      overallLevel = "ready_for_ae";
    } else if (totalScore >= 50) {
      overallLevel = "sql";
    } else if (totalScore >= 25) {
      overallLevel = "mql";
    }

    return {
      score: totalScore,
      budget,
      authority,
      need,
      timeline,
      overallLevel,
    };
  }

  /**
   * Update SDR memory with new information
   */
  private async updateSDRMemory(
    sessionId: string,
    userMessage: string,
    aiResponse: string,
    qualScore: QualificationScore,
    currentMemory: any
  ): Promise<void> {
    // Update qualification criteria
    const qualBlock = findMemoryBlock(
      currentMemory.blocks,
      "qualification_criteria"
    );
    if (qualBlock) {
      let updated = qualBlock.value;
      updated = updated.replace(
        /qualification_score: \d+/,
        `qualification_score: ${qualScore.score}`
      );
      updated = updated.replace(
        /qualification_level: \w+/,
        `qualification_level: ${qualScore.overallLevel}`
      );

      await this.memoryManager.updateMemoryBlock(
        "sdr",
        sessionId,
        "qualification_criteria",
        updated
      );
    }

    // Update engagement strategy with latest interaction
    await this.memoryManager.appendToMemoryBlock(
      "sdr",
      sessionId,
      "engagement_strategy",
      `\n[Latest] User said: "${userMessage.substring(0, 80)}..."`
    );

    // Update follow up state
    const followupBlock = findMemoryBlock(
      currentMemory.blocks,
      "follow_up_state"
    );
    if (followupBlock) {
      let updated = followupBlock.value;
      updated = updated.replace(
        /contact_attempts: \d+/,
        `contact_attempts: ${parseInt(followupBlock.value.match(/contact_attempts: (\d+)/)?.[1] || "0") + 1}`
      );
      updated = updated.replace(
        /last_contact: null/,
        `last_contact: ${new Date().toISOString()}`
      );

      await this.memoryManager.updateMemoryBlock(
        "sdr",
        sessionId,
        "follow_up_state",
        updated
      );
    }
  }

  /**
   * Get SDR metrics for dashboard
   */
  async getMetrics(sessionId: string): Promise<{
    leadsQualified: number;
    qualificationRate: number;
    demosScheduled: number;
    escalatedToAE: number;
  }> {
    // In production, aggregate from memory and database
    return {
      leadsQualified: 0,
      qualificationRate: 0,
      demosScheduled: 0,
      escalatedToAE: 0,
    };
  }
}

// Export singleton
let sdrAgent: SDRAgent | null = null;

export function getSDRAgent(): SDRAgent {
  if (!sdrAgent) {
    sdrAgent = new SDRAgent();
  }
  return sdrAgent;
}
