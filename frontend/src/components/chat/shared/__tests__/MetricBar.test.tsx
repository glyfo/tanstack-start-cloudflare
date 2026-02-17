/**
 * MetricBar Component Tests
 */

import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { MetricBar } from '../MetricBar';

describe('MetricBar', () => {
  it('renders with label and percentage', () => {
    render(<MetricBar label="Completion" percentage={75} />);

    expect(screen.getByText('Completion')).toBeInTheDocument();
    expect(screen.getByText('75%')).toBeInTheDocument();
  });

  it('displays progress bar with correct width', () => {
    const { container } = render(<MetricBar label="Progress" percentage={60} />);

    const progressBar = container.querySelector('[style*="width: 60%"]');
    expect(progressBar).toBeInTheDocument();
  });

  it('applies correct color for different percentages', () => {
    const { container, rerender } = render(<MetricBar label="Test" percentage={90} />);

    // High percentage (>= 70) should be green
    let progressBar = container.querySelector('.bg-emerald-500');
    expect(progressBar).toBeInTheDocument();

    // Medium percentage (40-69) should be amber
    rerender(<MetricBar label="Test" percentage={50} />);
    progressBar = container.querySelector('.bg-amber-500');
    expect(progressBar).toBeInTheDocument();

    // Low percentage (< 40) should be red
    rerender(<MetricBar label="Test" percentage={20} />);
    progressBar = container.querySelector('.bg-red-500');
    expect(progressBar).toBeInTheDocument();
  });

  it('handles 0% correctly', () => {
    render(<MetricBar label="Empty" percentage={0} />);

    expect(screen.getByText('Empty')).toBeInTheDocument();
    expect(screen.getByText('0%')).toBeInTheDocument();
  });

  it('handles 100% correctly', () => {
    render(<MetricBar label="Full" percentage={100} />);

    expect(screen.getByText('Full')).toBeInTheDocument();
    expect(screen.getByText('100%')).toBeInTheDocument();
  });
});
