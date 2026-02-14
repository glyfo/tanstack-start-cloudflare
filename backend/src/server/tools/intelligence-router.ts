export interface ComplexityAnalysis {
  complexity: "simple" | "complex";
  confidence: number;
  estimatedSteps: number;
  reasoning: string;
  requiresAgentLoop: boolean;
}

export class IntelligenceRouter {
  async analyzeComplexity(
    userMessage: string,
    _context?: {
      conversationHistory?: any[];
      sessionData?: any;
    }
  ): Promise<ComplexityAnalysis> {
    // Pattern matching for simple queries
    const simplePatterns = [
      /what time is it/i,
      /what'?s the time/i,
      /current time/i,
      /time/i,
      /what'?s my (timezone|location)/i,
      /where am i/i,
      /what device/i,
      /what browser/i,
      /list (all )?contacts/i,
      /show (me )?(all )?contacts/i,
      /create (a |an )?contact/i,
      /add (a |an )?contact/i,
      /new contact/i,
      /search (for )?contacts?/i,
      /find (a )?contact/i,
    ];

    // Pattern matching for complex workflows
    const complexPatterns = [
      /research .+ (and|then) create/i,
      /find .+ (and|then) (add|create|send)/i,
      /(first|then|after that|next)/i, // Multi-step indicators
      /schedule .+ (and|then) (send|notify)/i,
      /analyze .+ (and|then) (report|summarize)/i,
      /compare .+ (with|and) .+/i,
    ];

    const message = userMessage.toLowerCase();

    // Check for simple patterns
    const isSimple = simplePatterns.some((pattern) => pattern.test(message));
    if (isSimple) {
      return {
        complexity: "simple",
        confidence: 0.95,
        estimatedSteps: 1,
        reasoning:
          "Single, direct query that can be answered with one tool call",
        requiresAgentLoop: false,
      };
    }

    // Check for complex patterns
    const isComplex = complexPatterns.some((pattern) => pattern.test(message));
    if (isComplex) {
      // Estimate steps based on conjunctions
      const conjunctions = (
        message.match(/\b(and|then|after|next|first)\b/g) || []
      ).length;
      const estimatedSteps = Math.max(2, conjunctions + 2);

      return {
        complexity: "complex",
        confidence: 0.9,
        estimatedSteps,
        reasoning: "Multi-step workflow detected with multiple actions",
        requiresAgentLoop: true,
      };
    }

    // Check message length as a heuristic
    const wordCount = message.split(/\s+/).length;
    if (wordCount > 20) {
      return {
        complexity: "complex",
        confidence: 0.7,
        estimatedSteps: 3,
        reasoning: "Long message suggests complex request",
        requiresAgentLoop: true,
      };
    }

    // Check for multiple questions
    const questionCount = (message.match(/\?/g) || []).length;
    if (questionCount > 1) {
      return {
        complexity: "complex",
        confidence: 0.75,
        estimatedSteps: questionCount + 1,
        reasoning: "Multiple questions detected",
        requiresAgentLoop: true,
      };
    }

    // Default: treat as simple with lower confidence
    return {
      complexity: "simple",
      confidence: 0.6,
      estimatedSteps: 1,
      reasoning: "No clear complexity indicators; treating as simple query",
      requiresAgentLoop: false,
    };
  }

  shouldUseAgentLoop(analysis: ComplexityAnalysis): boolean {
    // Use agent loop ONLY for truly complex workflows
    // Default to simple direct execution for better UX

    // Explicit complex with high confidence
    if (analysis.complexity === "complex" && analysis.confidence > 0.8) {
      return true;
    }

    // Multiple steps clearly required
    if (analysis.estimatedSteps > 3) {
      return true;
    }

    // Default: use direct execution (simpler, faster, cleaner responses)
    return false;
  }
}

// Singleton instance
let intelligenceRouter: IntelligenceRouter | null = null;

export function getIntelligenceRouter(): IntelligenceRouter {
  if (!intelligenceRouter) {
    intelligenceRouter = new IntelligenceRouter();
  }
  return intelligenceRouter;
}
