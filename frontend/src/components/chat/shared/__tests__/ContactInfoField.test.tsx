/**
 * ContactInfoField Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ContactInfoField } from '../ContactInfoField';
import { Mail, Phone, Building } from 'lucide-react';

describe('ContactInfoField', () => {
  it('renders with icon and value', () => {
    render(<ContactInfoField icon={Mail} value="test@example.com" />);

    expect(screen.getByText('test@example.com')).toBeInTheDocument();
  });

  it('renders phone icon with phone value', () => {
    render(<ContactInfoField icon={Phone} value="+1234567890" />);

    expect(screen.getByText('+1234567890')).toBeInTheDocument();
  });

  it('renders company icon with company name', () => {
    render(<ContactInfoField icon={Building} value="Acme Corp" />);

    expect(screen.getByText('Acme Corp')).toBeInTheDocument();
  });

  it('does not render when value is empty', () => {
    const { container } = render(<ContactInfoField icon={Mail} value="" />);

    expect(container.firstChild).toBeNull();
  });

  it('does not render when value is undefined', () => {
    const { container } = render(<ContactInfoField icon={Mail} value={undefined} />);

    expect(container.firstChild).toBeNull();
  });

  it('applies custom className', () => {
    const { container } = render(
      <ContactInfoField icon={Mail} value="test@example.com" className="custom-class" />
    );

    expect(container.firstChild).toHaveClass('custom-class');
  });
});
