/**
 * OpportunityCard Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { OpportunityCard } from '../OpportunityCard';

describe('OpportunityCard', () => {
  const mockOpportunity = {
    id: '456',
    title: 'Big Deal',
    contactName: 'John Doe',
    company: 'Acme Corp',
    dealValue: 50000,
    stage: 'proposal',
    probability: 75,
  };

  it('renders opportunity information', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />);

    expect(screen.getByText('Big Deal')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('displays formatted currency', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />);

    // Should show $50,000 or $50,000.00 depending on formatting
    expect(screen.getByText(/\$50,000/)).toBeInTheDocument();
  });

  it('renders without optional fields', () => {
    const minimalOpportunity = {
      id: '456',
      title: 'Small Deal',
      contactName: 'Jane Doe',
    };

    render(<OpportunityCard opportunity={minimalOpportunity} />);

    expect(screen.getByText('Small Deal')).toBeInTheDocument();
    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
  });

  it('displays stage badge', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />);

    // Should show the stage label
    expect(screen.getByText(/proposal/i)).toBeInTheDocument();
  });

  it('displays probability metric when provided', () => {
    render(<OpportunityCard opportunity={mockOpportunity} />);

    expect(screen.getByText('75%')).toBeInTheDocument();
  });
});
