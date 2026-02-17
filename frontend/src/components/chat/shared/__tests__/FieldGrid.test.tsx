/**
 * FieldGrid Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FieldGrid } from '../FieldGrid';

describe('FieldGrid', () => {
  it('renders fields in grid layout', () => {
    const fields = [
      { label: 'Name', value: 'John Doe' },
      { label: 'Email', value: 'john@example.com' },
      { label: 'Company', value: 'Acme Inc' },
    ];

    render(<FieldGrid fields={fields} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.getByText('John Doe')).toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
    expect(screen.getByText('john@example.com')).toBeInTheDocument();
    expect(screen.getByText('Company')).toBeInTheDocument();
    expect(screen.getByText('Acme Inc')).toBeInTheDocument();
  });

  it('handles empty fields array', () => {
    const { container } = render(<FieldGrid fields={[]} />);
    expect(container.firstChild).toBeEmptyDOMElement();
  });

  it('renders with custom columns', () => {
    const fields = [{ label: 'Test', value: 'Value' }];
    const { container } = render(<FieldGrid fields={fields} columns={3} />);

    const grid = container.firstChild;
    expect(grid).toHaveClass('grid-cols-3');
  });

  it('skips fields with no value', () => {
    const fields = [
      { label: 'Name', value: 'John' },
      { label: 'Empty', value: undefined },
      { label: 'Email', value: 'john@example.com' },
    ];

    render(<FieldGrid fields={fields} />);

    expect(screen.getByText('Name')).toBeInTheDocument();
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
    expect(screen.getByText('Email')).toBeInTheDocument();
  });
});
