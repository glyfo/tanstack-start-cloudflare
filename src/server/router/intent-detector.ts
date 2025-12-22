/**
 * Intent Detector
 * Classifies user messages to determine which agent should handle the request
 */

export interface DetectedIntent {
  primaryAgent: "router" | "support" | "csm" | "ae" | "sdr" | "human";
  confidence: number; // 0-1
  reason: string;
  secondaryAgent?: string;
  urgency: "low" | "medium" | "high";
  requiresHuman?: boolean;
}

/**
 * Detect intent from user message
 * Uses keyword matching + heuristics (can be enhanced with LLM classification later)
 */
export async function detectIntent(
  userMessage: string
): Promise<DetectedIntent> {
  const lowerMessage = userMessage.toLowerCase();

  // Support Agent Keywords
  const supportKeywords = [
    "bug",
    "error",
    "not working",
    "doesn't work",
    "issue",
    "problem",
    "broken",
    "crash",
    "failed",
    "timeout",
    "how to",
    "how do i",
    "help me",
    "confused",
    "not sure",
    "api error",
    "database",
    "connection",
    "authentication",
  ];

  // SDR Agent Keywords (Lead qualification)
  const sdrKeywords = [
    "interested in",
    "tell me about",
    "pricing",
    "plans",
    "demo",
    "trial",
    "sign up",
    "how much",
    "what does it do",
    "features",
    "comparison",
    "alternative",
    "competitor",
    "first time",
    "new customer",
    "free trial",
    "schedule a call",
  ];

  // AE Agent Keywords (Sales/Negotiation)
  const aeKeywords = [
    "deal",
    "contract",
    "negotiate",
    "discount",
    "pricing flexibility",
    "quote",
    "proposal",
    "msa",
    "terms",
    "enterprise",
    "volume discount",
    "annual commitment",
    "custom plan",
    "special pricing",
    "budget",
  ];

  // CSM Agent Keywords (Customer Success/Expansion)
  const csmKeywords = [
    "expand",
    "upgrade",
    "add more",
    "more seats",
    "scale",
    "integration",
    "feature request",
    "custom workflow",
    "training",
    "onboarding",
    "adoption",
    "best practices",
    "growth",
    "usage analytics",
    "roi",
    "value realization",
  ];

  // Check for escalation signals
  if (
    userMessage.includes("URGENT") ||
    userMessage.includes("!!!") ||
    lowerMessage.includes("angry") ||
    lowerMessage.includes("very upset") ||
    lowerMessage.includes("unacceptable") ||
    lowerMessage.includes("lost customer") ||
    lowerMessage.includes("cancel")
  ) {
    return {
      primaryAgent: "human",
      confidence: 0.95,
      reason: "Escalation signal detected - high urgency",
      urgency: "high",
      requiresHuman: true,
    };
  }

  // Count keyword matches
  const supportMatches = supportKeywords.filter((kw) =>
    lowerMessage.includes(kw)
  ).length;
  const sdrMatches = sdrKeywords.filter((kw) =>
    lowerMessage.includes(kw)
  ).length;
  const aeMatches = aeKeywords.filter((kw) => lowerMessage.includes(kw)).length;
  const csmMatches = csmKeywords.filter((kw) =>
    lowerMessage.includes(kw)
  ).length;

  // Determine primary agent
  const scores = [
    {
      agent: "support" as const,
      score: supportMatches,
      confidence: 0.6 + supportMatches * 0.1,
    },
    {
      agent: "sdr" as const,
      score: sdrMatches,
      confidence: 0.5 + sdrMatches * 0.12,
    },
    {
      agent: "ae" as const,
      score: aeMatches,
      confidence: 0.5 + aeMatches * 0.12,
    },
    {
      agent: "csm" as const,
      score: csmMatches,
      confidence: 0.5 + csmMatches * 0.12,
    },
  ];

  // Sort by score
  scores.sort((a, b) => b.score - a.score);
  const topMatch = scores[0];

  // If low confidence, default to router for further analysis
  if (topMatch.score === 0) {
    return {
      primaryAgent: "router",
      confidence: 0.4,
      reason: "Ambiguous intent - router will analyze context",
      urgency: "medium",
    };
  }

  // Determine urgency
  let urgency: "low" | "medium" | "high" = "medium";
  if (
    lowerMessage.includes("asap") ||
    lowerMessage.includes("immediately") ||
    lowerMessage.includes("urgent") ||
    lowerMessage.includes("down")
  ) {
    urgency = "high";
  }

  return {
    primaryAgent: topMatch.agent,
    confidence: Math.min(0.95, topMatch.confidence),
    reason: `Detected ${topMatch.agent} keywords (${topMatch.score} matches)`,
    secondaryAgent: scores[1]?.score > 0 ? scores[1].agent : undefined,
    urgency,
    requiresHuman: urgency === "high" && topMatch.score < 2,
  };
}

/**
 * LLM-based intent detection (enhanced version for future use)
 * Currently comments out - can be enabled when needed
 */
export async function detectIntentWithLLM(
  userMessage: string,
  env: any
): Promise<DetectedIntent> {
  // const systemPrompt = `You are an intent classifier for a CRM agent ecosystem.
  // Analyze the user message and classify it into one of these categories:
  // - support: Bug, error, technical issue, how-to, troubleshooting
  // - sdr: Lead inquiry, qualification, pricing, features, demo request
  // - ae: Deal, pricing flexibility, negotiation, contract, enterprise
  // - csm: Expansion, upsell, feature request, adoption, training
  // - human: Escalation, complaint, special request, cancellation threat

  // Respond with JSON: {
  //   "primaryAgent": "support|sdr|ae|csm|human",
  //   "confidence": 0-1,
  //   "reason": "string",
  //   "urgency": "low|medium|high"
  // }`;

  // const response = await env.AI.run('llama-3.1-8b', {
  //   messages: [{ role: 'user', content: userMessage }],
  //   system_prompt: systemPrompt,
  //   max_tokens: 200,
  // });

  // return JSON.parse(response);

  // For now, use heuristic-based detection
  return detectIntent(userMessage);
}
