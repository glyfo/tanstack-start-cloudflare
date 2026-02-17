/**
 * StatusBadge Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { StatusBadge } from '../StatusBadge';

describe('StatusBadge', () => {
  it('renders with label', () => {
    render(<StatusBadge label="Active" color="green" />);
    expect(screen.getByText('Active')).toBeInTheDocument();
  });

  it('applies correct color classes', () => {
    const { rerender } = render(<StatusBadge label="Hot" color="red" />);
    expect(screen.getByText('Hot')).toHaveClass('bg-red-100', 'text-red-700');

    rerender(<StatusBadge label="Warm" color="amber" />);
    expect(screen.getByText('Warm')).toHaveClass('bg-amber-100', 'text-amber-700');

    rerender(<StatusBadge label="Cold" color="sky" />);
    expect(screen.getByText('Cold')).toHaveClass('bg-sky-100', 'text-sky-700');
  });

  it('applies custom className', () => {
    render(<StatusBadge label="Test" color="green" className="custom-class" />);
    expect(screen.getByText('Test')).toHaveClass('custom-class');
  });
});
