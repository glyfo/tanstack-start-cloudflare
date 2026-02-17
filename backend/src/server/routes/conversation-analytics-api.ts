/**
 * Conversation Analytics API Routes
 *
 * Endpoints for querying conversation analytics data:
 * - GET /api/analytics/conversation-insights
 * - GET /api/analytics/channel-performance
 * - GET /api/analytics/active-tests
 * - POST /api/analytics/create-test
 */

import type { Env } from '../types/env';
import {
  analyzeConversations,
  generatePromptImprovements,
  createPromptTest,
  evaluatePromptTest,
  type PromptTest,
} from '../analytics/improvement-loop';

/**
 * GET /api/analytics/conversation-insights
 *
 * Query parameters:
 * - timeRange: '24h' | '7d' | '30d' (default: '7d')
 * - channels: comma-separated list of channels (optional)
 */
export async function handleConversationInsights(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const timeRange = url.searchParams.get('timeRange') || '7d';
  const channelsParam = url.searchParams.get('channels');

  const hours: Record<string, number> = {
    '24h': 24,
    '7d': 168,
    '30d': 720,
  };

  const channels = channelsParam?.split(',').filter(Boolean);

  try {
    const insights = await analyzeConversations(env, {
      timeRangeHours: hours[timeRange] || 168,
      channels,
    });

    // Convert Map to object for JSON serialization
    const insightsObj: Record<string, any> = {};
    for (const [channel, channelInsights] of insights) {
      insightsObj[channel] = channelInsights;
    }

    return new Response(JSON.stringify({
      timeRange,
      insights: insightsObj,
      timestamp: Date.now(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Analytics API] Failed to fetch insights:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch conversation insights',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

/**
 * GET /api/analytics/channel-performance
 *
 * Query parameters:
 * - channel: specific channel (required)
 * - days: number of days to analyze (default: 7)
 */
export async function handleChannelPerformance(
  request: Request,
  env: Env
): Promise<Response> {
  const url = new URL(request.url);
  const channel = url.searchParams.get('channel');
  const days = parseInt(url.searchParams.get('days') || '7');

  if (!channel) {
    return new Response(JSON.stringify({
      error: 'Missing required parameter: channel',
    }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  try {
    const insights = await analyzeConversations(env, {
      timeRangeHours: days * 24,
      channels: [channel],
    });

    const channelInsights = insights.get(channel);

    if (!channelInsights) {
      return new Response(JSON.stringify({
        error: 'No data found for channel',
        channel,
      }), {
        status: 404,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // Generate improvement suggestions
    const improvements = await generatePromptImprovements(env, channelInsights);

    return new Response(JSON.stringify({
      channel,
      days,
      insights: channelInsights,
      improvements,
      timestamp: Date.now(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Analytics API] Failed to fetch channel performance:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch channel performance',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/analytics/active-tests
 *
 * List all active A/B tests
 */
export async function handleActiveTests(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    // TODO: Retrieve from KV or DO storage
    // For now, return sample data
    const activeTests: PromptTest[] = [];

    return new Response(JSON.stringify({
      tests: activeTests,
      count: activeTests.length,
      timestamp: Date.now(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Analytics API] Failed to fetch active tests:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch active tests',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * POST /api/analytics/create-test
 *
 * Create a new A/B test for prompt improvement
 *
 * Body:
 * {
 *   channel: string,
 *   currentPrompt: string,
 *   suggestedPrompt: string,
 *   trafficSplit: { a: number, b: number }
 * }
 */
export async function handleCreateTest(
  request: Request,
  env: Env
): Promise<Response> {
  try {
    const body = await request.json() as {
      channel: string;
      currentPrompt: string;
      suggestedPrompt: string;
      reason?: string;
      trafficSplit?: { a: number; b: number };
    };

    if (!body.channel || !body.currentPrompt || !body.suggestedPrompt) {
      return new Response(JSON.stringify({
        error: 'Missing required fields: channel, currentPrompt, suggestedPrompt',
      }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const improvement = {
      currentPrompt: body.currentPrompt,
      suggestedPrompt: body.suggestedPrompt,
      reason: body.reason || 'Manual test creation',
      expectedImpact: {
        metric: 'custom',
        improvement: 'TBD',
      },
      confidence: 0.5,
    };

    const test = await createPromptTest(
      env,
      body.channel,
      improvement,
      body.trafficSplit
    );

    return new Response(JSON.stringify({
      success: true,
      test,
      timestamp: Date.now(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Analytics API] Failed to create test:', error);
    return new Response(JSON.stringify({
      error: 'Failed to create test',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * GET /api/analytics/test-results/:testId
 *
 * Get results for a specific A/B test
 */
export async function handleTestResults(
  request: Request,
  env: Env,
  testId: string
): Promise<Response> {
  try {
    const results = await evaluatePromptTest(env, testId);

    return new Response(JSON.stringify({
      test: results,
      timestamp: Date.now(),
    }), {
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('[Analytics API] Failed to fetch test results:', error);
    return new Response(JSON.stringify({
      error: 'Failed to fetch test results',
      message: error instanceof Error ? error.message : 'Unknown error',
    }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
