/**
 * TikTokLeadCard Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { TikTokLeadCard } from '../TikTokLeadCard';

describe('TikTokLeadCard', () => {
  const mockLead = {
    id: '789',
    name: 'Sarah Johnson',
    email: 'sarah@example.com',
    phone: '+9876543210',
    adName: 'Summer Campaign',
    classification: 'hot' as const,
    qualificationScore: 85,
    timestamp: Date.now(),
  };

  it('renders lead information', () => {
    render(<TikTokLeadCard lead={mockLead} />);

    expect(screen.getByText('Sarah Johnson')).toBeInTheDocument();
    expect(screen.getByText('sarah@example.com')).toBeInTheDocument();
    expect(screen.getByText('+9876543210')).toBeInTheDocument();
  });

  it('displays TikTok platform badge', () => {
    render(<TikTokLeadCard lead={mockLead} />);

    expect(screen.getByText(/tiktok/i)).toBeInTheDocument();
  });

  it('displays classification badge', () => {
    render(<TikTokLeadCard lead={mockLead} />);

    expect(screen.getByText(/hot/i)).toBeInTheDocument();
  });

  it('displays qualification score', () => {
    render(<TikTokLeadCard lead={mockLead} />);

    expect(screen.getByText('85%')).toBeInTheDocument();
  });

  it('displays ad campaign name', () => {
    render(<TikTokLeadCard lead={mockLead} />);

    expect(screen.getByText('Summer Campaign')).toBeInTheDocument();
  });

  it('renders with minimal data', () => {
    const minimalLead = {
      id: '789',
      name: 'Jane Smith',
      classification: 'cold' as const,
      qualificationScore: 30,
      timestamp: Date.now(),
    };

    render(<TikTokLeadCard lead={minimalLead} />);

    expect(screen.getByText('Jane Smith')).toBeInTheDocument();
    expect(screen.getByText(/cold/i)).toBeInTheDocument();
  });
});
