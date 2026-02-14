/**
 * Lead Export API Endpoint
 *
 * Handles CSV and Excel export of leads
 * Supports filtering by source, classification, and date range
 */

import type { Env } from 'cloudflare:workers';
import { searchLeads, exportLeadsToCSV, type LeadSearchOptions } from '../services/unified-lead-service';

/**
 * Export leads to CSV
 */
export async function exportLeadsAsCSV(
  env: Env,
  searchOptions: LeadSearchOptions = {}
): Promise<Response> {
  try {
    // Fetch all matching leads (increase limit for export)
    const leads = await searchLeads(env, {
      ...searchOptions,
      limit: 10000, // Export up to 10k leads
    });

    // Generate CSV
    const csvContent = exportLeadsToCSV(leads);

    // Create filename with timestamp
    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leads-export-${timestamp}.csv`;

    // Return CSV response
    return new Response(csvContent, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Convert leads to Excel-compatible JSON format
 * (Frontend can use a library like SheetJS to convert to actual Excel)
 */
export async function exportLeadsAsJSON(
  env: Env,
  searchOptions: LeadSearchOptions = {}
): Promise<Response> {
  try {
    const leads = await searchLeads(env, {
      ...searchOptions,
      limit: 10000,
    });

    // Format for Excel
    const excelData = leads.map((lead) => ({
      Source: lead.source,
      Name: lead.name || '',
      Email: lead.email || '',
      Phone: lead.phone || '',
      Company: lead.company || '',
      Classification: lead.classification || 'new',
      'Qualification Score': lead.qualificationScore || '',
      Campaign: lead.campaignName || '',
      'Campaign ID': lead.campaignId || '',
      Date: new Date(lead.timestamp).toISOString(),
      'Date (Local)': new Date(lead.timestamp).toLocaleString(),
    }));

    const timestamp = new Date().toISOString().split('T')[0];
    const filename = `leads-export-${timestamp}.json`;

    return new Response(JSON.stringify(excelData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Access-Control-Allow-Origin': '*',
      },
    });
  } catch (error) {
    console.error('Export error:', error);
    return new Response(JSON.stringify({ error: 'Export failed' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}

/**
 * Handle export requests
 */
export async function handleExportRequest(
  request: Request,
  env: Env
): Promise<Response> {
  // Parse query parameters
  const url = new URL(request.url);
  const format = url.searchParams.get('format') || 'csv';
  const sources = url.searchParams.get('sources')?.split(',') as any;
  const classifications = url.searchParams.get('classifications')?.split(',') as any;
  const startDate = url.searchParams.get('startDate');
  const endDate = url.searchParams.get('endDate');
  const searchQuery = url.searchParams.get('query') || undefined;

  const searchOptions: LeadSearchOptions = {
    sources,
    classifications,
    searchQuery,
    startDate: startDate ? parseInt(startDate) : undefined,
    endDate: endDate ? parseInt(endDate) : undefined,
  };

  // Export based on format
  if (format === 'json' || format === 'excel') {
    return exportLeadsAsJSON(env, searchOptions);
  } else {
    return exportLeadsAsCSV(env, searchOptions);
  }
}
