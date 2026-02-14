/**
 * Enhanced Conversation Types
 * Supports multi-intent conversations with qualification and branching
 */

// Conversation Phase - High-level stages in the sales process
export type ConversationPhase =
  | "initial_contact"      // First interaction
  | "qualifying"           // BANT qualification in progress
  | "needs_assessment"     // Understanding customer needs
  | "presenting_solution"  // Presenting offer/demo
  | "handling_objections"  // Addressing concerns
  | "proposal"             // Sent proposal, awaiting response
  | "negotiation"          // Discussing terms
  | "closing"              // Final steps before close
  | "closed_won"           // Deal closed successfully
  | "closed_lost"          // Deal lost
  | "nurturing";           // Long-term follow-up

// Conversation Intent - What the user is trying to do
export type ConversationIntent =
  | "general_inquiry"
  | "request_demo"
  | "pricing_question"
  | "feature_question"
  | "support_request"
  | "objection"
  | "ready_to_buy"
  | "schedule_meeting"
  | "provide_information"
  | "unknown";

// Sentiment Analysis
export type Sentiment = "positive" | "neutral" | "negative" | "unknown";

// BANT Qualification Data
export interface BANTData {
  budget?: {
    range?: string;           // "10k-50k", "50k-100k", etc.
    qualified: boolean;       // Do they have budget?
    confidence: number;       // 0-1 confidence score
    extractedAt?: number;
  };
  authority?: {
    role?: string;            // "decision_maker", "influencer", "gatekeeper"
    canApprove: boolean;      // Can they approve the purchase?
    confidence: number;
    extractedAt?: number;
  };
  need?: {
    description?: string;     // What problem are they solving?
    urgency: "high" | "medium" | "low" | "unknown";
    painPoints: string[];     // List of pain points mentioned
    confidence: number;
    extractedAt?: number;
  };
  timeline?: {
    range?: string;           // "immediate", "1-3 months", "3-6 months", etc.
    deadline?: number;        // Unix timestamp if specific date
    confidence: number;
    extractedAt?: number;
  };
}

// Contact Information
export interface ContactData {
  name?: string;
  email?: string;
  phone?: string;
  company?: string;
  role?: string;
  linkedIn?: string;
  website?: string;
}

// Enhanced Conversation State
export interface EnhancedConversationState {
  id: string;
  sessionId: string;

  // Phase tracking
  phase: ConversationPhase;
  previousPhase?: ConversationPhase;
  phaseStartedAt: number;
  phaseTransitions: Array<{
    from: ConversationPhase;
    to: ConversationPhase;
    timestamp: number;
    reason?: string;
  }>;

  // Intent tracking
  currentIntent: ConversationIntent;
  intentHistory: Array<{
    intent: ConversationIntent;
    timestamp: number;
    confidence: number;
  }>;

  // Qualification data
  bant: BANTData;
  qualificationScore: number;  // 0-100
  isQualified: boolean;

  // Contact data
  contact: ContactData;

  // Conversation quality
  sentiment: Sentiment;
  sentimentHistory: Array<{
    sentiment: Sentiment;
    timestamp: number;
    score: number;  // -1 to 1
  }>;

  // Engagement metrics
  messageCount: number;
  userMessageCount: number;
  assistantMessageCount: number;
  avgResponseTime?: number;     // milliseconds
  engagementScore: number;      // 0-100

  // Flags
  needsHumanEscalation: boolean;
  escalationReason?: string;
  hasUnresolvedObjection: boolean;
  isStalled: boolean;

  // Metadata
  createdAt: number;
  updatedAt: number;
  lastMessageAt: number;
}

// State transition rules
export interface StateTransitionRule {
  from: ConversationPhase;
  to: ConversationPhase;
  conditions: {
    requiredSignals?: string[];
    minQualificationScore?: number;
    minEngagementScore?: number;
    customCheck?: (state: EnhancedConversationState) => boolean;
  };
  autoAdvance: boolean;
}

// Conversation Context for LLM
export interface ConversationContext {
  phase: ConversationPhase;
  intent: ConversationIntent;
  qualificationStatus: {
    score: number;
    isQualified: boolean;
    missingFields: string[];
  };
  contactInfo: ContactData;
  sentiment: Sentiment;
  recentTopics: string[];
  flags: {
    needsEscalation: boolean;
    hasObjection: boolean;
    isStalled: boolean;
  };
}
