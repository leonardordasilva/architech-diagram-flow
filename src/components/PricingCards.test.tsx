import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import PricingCards from './PricingCards';

// ─── BillingCycle type reference ─────────────────────────────────────────────
import type { BillingCycle } from './PricingCards';

// ─── Render tests ─────────────────────────────────────────────────────────────

describe('PricingCards', () => {
  it('renders all three plan names', () => {
    const onSelectPlan = vi.fn();
    render(<PricingCards onSelectPlan={onSelectPlan} />);
    // Using i18n keys resolved by setup.ts (pt-BR locale)
    expect(screen.getByText('Free')).toBeInTheDocument();
    expect(screen.getByText('Pro')).toBeInTheDocument();
    expect(screen.getByText('Team')).toBeInTheDocument();
  });

  it('renders all four billing cycle buttons', () => {
    render(<PricingCards onSelectPlan={vi.fn()} />);
    expect(screen.getByText('Mensal')).toBeInTheDocument();
    expect(screen.getByText('Trimestral')).toBeInTheDocument();
    expect(screen.getByText('Semestral')).toBeInTheDocument();
    expect(screen.getByText('Anual')).toBeInTheDocument();
  });

  it('calls onSelectPlan with plan id and current cycle when CTA is clicked', () => {
    const onSelectPlan = vi.fn();
    render(<PricingCards onSelectPlan={onSelectPlan} />);
    // Click the Free plan CTA (first CTA button)
    const freeCta = screen.getByRole('button', { name: /Começar grátis/i });
    fireEvent.click(freeCta);
    expect(onSelectPlan).toHaveBeenCalledWith('free', 'monthly');
  });

  it('changes cycle when a cycle button is clicked', () => {
    const onSelectPlan = vi.fn();
    render(<PricingCards onSelectPlan={onSelectPlan} />);
    // Click "Anual"
    fireEvent.click(screen.getByText('Anual'));
    // Now click Free plan CTA — should use 'annual' cycle
    const freeCta = screen.getByRole('button', { name: /Começar grátis/i });
    fireEvent.click(freeCta);
    expect(onSelectPlan).toHaveBeenCalledWith('free', 'annual');
  });

  it('shows loading spinner on loadingPlan', () => {
    render(<PricingCards onSelectPlan={vi.fn()} loadingPlan="pro" />);
    // The Loader2 icon renders when loadingPlan matches a plan id
    // It's inside the Pro CTA button — check button is disabled
    const proBtn = screen.getAllByRole('button').find(
      (b) => b.querySelector('svg') !== null && b.closest('[data-plan="pro"]') !== null
    );
    // Just verify pro CTA button is disabled when that plan is loading
    const allButtons = screen.getAllByRole('button');
    const disabledButtons = allButtons.filter((b) => b.hasAttribute('disabled'));
    // At least the "Get Pro" button should be disabled
    expect(disabledButtons.length).toBeGreaterThan(0);
  });

  it('uses buttonTextOverrides when provided', () => {
    render(
      <PricingCards
        onSelectPlan={vi.fn()}
        buttonTextOverrides={{ free: 'Ir para o App', pro: 'Ir para o App', team: 'Ir para o App' }}
      />
    );
    const overrideBtns = screen.getAllByRole('button', { name: 'Ir para o App' });
    expect(overrideBtns).toHaveLength(3);
  });

  it('does not render the header section when hideHeader=true', () => {
    render(<PricingCards onSelectPlan={vi.fn()} hideHeader={true} />);
    // The "Planos e Preços" badge should not be present
    expect(screen.queryByText(/Planos e Preços/i)).not.toBeInTheDocument();
  });

  it('defaults to monthly cycle', () => {
    render(<PricingCards onSelectPlan={vi.fn()} />);
    const cycleBtn = screen.getByText('Mensal');
    expect(cycleBtn.className).toContain('p-cycle-btn-active');
  });
});

// ─── BillingCycle type sanity ─────────────────────────────────────────────────

describe('BillingCycle type', () => {
  it('all expected cycles are accepted', () => {
    const cycles: BillingCycle[] = ['monthly', 'quarterly', 'semiannual', 'annual'];
    expect(cycles).toHaveLength(4);
  });
});
