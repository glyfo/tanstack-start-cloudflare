/**
 * CardShell Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CardShell } from '../CardShell';
import { User } from 'lucide-react';

describe('CardShell', () => {
  it('renders with title and children', () => {
    render(
      <CardShell title="Test Card" icon={User}>
        <div>Card content</div>
      </CardShell>
    );

    expect(screen.getByText('Test Card')).toBeInTheDocument();
    expect(screen.getByText('Card content')).toBeInTheDocument();
  });

  it('renders with badge', () => {
    render(
      <CardShell
        title="Test Card"
        icon={User}
        badge={<span>Badge</span>}
      >
        <div>Content</div>
      </CardShell>
    );

    expect(screen.getByText('Badge')).toBeInTheDocument();
  });

  it('applies custom className', () => {
    const { container } = render(
      <CardShell
        title="Test Card"
        icon={User}
        className="custom-class"
      >
        <div>Content</div>
      </CardShell>
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });

  it('renders subtitle when provided', () => {
    render(
      <CardShell
        title="Test Card"
        subtitle="Test subtitle"
        icon={User}
      >
        <div>Content</div>
      </CardShell>
    );

    expect(screen.getByText('Test subtitle')).toBeInTheDocument();
  });
});
