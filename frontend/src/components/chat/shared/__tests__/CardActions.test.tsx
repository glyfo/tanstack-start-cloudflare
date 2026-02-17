/**
 * CardActions Component Tests
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CardActions } from '../CardActions';

describe('CardActions', () => {
  it('renders action buttons', () => {
    const actions = [
      { label: 'Submit', onClick: vi.fn() },
      { label: 'Cancel', onClick: vi.fn(), variant: 'secondary' as const },
    ];

    render(<CardActions actions={actions} />);

    expect(screen.getByText('Submit')).toBeInTheDocument();
    expect(screen.getByText('Cancel')).toBeInTheDocument();
  });

  it('calls onClick when button is clicked', () => {
    const onClick = vi.fn();
    const actions = [{ label: 'Click me', onClick }];

    render(<CardActions actions={actions} />);

    const button = screen.getByText('Click me');
    fireEvent.click(button);

    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies correct variant styles', () => {
    const actions = [
      { label: 'Primary', onClick: vi.fn(), variant: 'primary' as const },
      { label: 'Danger', onClick: vi.fn(), variant: 'danger' as const },
    ];

    render(<CardActions actions={actions} />);

    const primaryButton = screen.getByText('Primary');
    const dangerButton = screen.getByText('Danger');

    expect(primaryButton).toHaveClass('bg-stone-900');
    expect(dangerButton).toHaveClass('bg-red-600');
  });

  it('disables buttons when disabled prop is true', () => {
    const actions = [
      { label: 'Disabled', onClick: vi.fn(), disabled: true },
    ];

    render(<CardActions actions={actions} />);

    const button = screen.getByText('Disabled');
    expect(button).toBeDisabled();
  });
});
