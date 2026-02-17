/**
 * ContactCard Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactCard } from '../ContactCard';

describe('ContactCard', () => {
  const mockContact = {
    id: '123',
    name: 'John Doe',
    email: 'john@example.com',
    phone: '+1234567890',
    company: 'Acme Corp',
  };

  it('renders contact information', () => {
    render(<ContactCard contact={mockContact} />);

    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('+1234567890')).toBeInTheDocument();
    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('renders without optional fields', () => {
    const minimalContact = {
      id: '123',
      name: 'Jane Doe',
      email: 'jane@example.com',
    };

    render(<ContactCard contact={minimalContact} />);

    expect(screen.getByText('Jane Doe')).toBeInTheDocument();
    expect(screen.getByText('jane@example.com')).toBeInTheDocument();
    expect(screen.queryByText('Acme Corp')).not.toBeInTheDocument();
  });

  it('displays actions when provided', () => {
    const onView = vi.fn();
    const onEdit = vi.fn();

    render(
      <ContactCard
        contact={mockContact}
        onView={onView}
        onEdit={onEdit}
      />
    );

    expect(screen.getByText('View')).toBeInTheDocument();
    expect(screen.getByText('Edit')).toBeInTheDocument();
  });
});
