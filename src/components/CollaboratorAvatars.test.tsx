import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

// Tooltip renders children inline in jsdom
vi.mock('@/components/ui/tooltip', () => ({
  Tooltip: ({ children }: { children: React.ReactNode }) => React.createElement(React.Fragment, null, children),
  TooltipTrigger: ({ children }: { children: React.ReactNode; asChild?: boolean }) =>
    React.createElement(React.Fragment, null, children),
  TooltipContent: ({ children }: { children: React.ReactNode }) =>
    React.createElement('span', { 'data-testid': 'tooltip-content' }, children),
}));

import CollaboratorAvatars from '@/components/CollaboratorAvatars';
import type { Collaborator } from '@/hooks/useRealtimeCollab';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const makeCollaborator = (n: number): Collaborator => ({
  userId: `user-${n}`,
  email: `user${n}@test.com`,
  color: '#ff0000',
});

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('CollaboratorAvatars — renderização', () => {
  it('retorna null quando não há colaboradores', () => {
    const { container } = render(React.createElement(CollaboratorAvatars, { collaborators: [] }));
    expect(container.firstChild).toBeNull();
  });

  it('renderiza avatar para um colaborador', () => {
    render(React.createElement(CollaboratorAvatars, { collaborators: [makeCollaborator(1)] }));
    // Initial letter of email
    expect(screen.getByText('U')).toBeInTheDocument();
  });

  it('exibe e-mail do colaborador no tooltip', () => {
    render(React.createElement(CollaboratorAvatars, { collaborators: [makeCollaborator(1)] }));
    expect(screen.getByText('user1@test.com')).toBeInTheDocument();
  });

  it('usa fallback "?" para colaborador sem e-mail', () => {
    const collab: Collaborator = { userId: 'u1', email: '', color: '#aaa' };
    render(React.createElement(CollaboratorAvatars, { collaborators: [collab] }));
    expect(screen.getByText('?')).toBeInTheDocument();
  });

  it('exibe rótulo anônimo para colaborador sem e-mail no tooltip', () => {
    const collab: Collaborator = { userId: 'u1', email: '', color: '#aaa' };
    render(React.createElement(CollaboratorAvatars, { collaborators: [collab] }));
    expect(screen.getByText('collaborators.anonymous')).toBeInTheDocument();
  });
});

describe('CollaboratorAvatars — limite de avatares visíveis', () => {
  it('renderiza no máximo 5 avatares', () => {
    const collabs = Array.from({ length: 7 }, (_, i) => makeCollaborator(i + 1));
    render(React.createElement(CollaboratorAvatars, { collaborators: collabs }));
    // 5 visible letters U (all start with 'U') + overflow badge
    const letters = screen.getAllByText('U');
    expect(letters).toHaveLength(5);
  });

  it('exibe badge "+N" quando há mais de 5 colaboradores', () => {
    const collabs = Array.from({ length: 7 }, (_, i) => makeCollaborator(i + 1));
    render(React.createElement(CollaboratorAvatars, { collaborators: collabs }));
    expect(screen.getByText('+2')).toBeInTheDocument();
  });

  it('não exibe badge de overflow com exatamente 5 colaboradores', () => {
    const collabs = Array.from({ length: 5 }, (_, i) => makeCollaborator(i + 1));
    render(React.createElement(CollaboratorAvatars, { collaborators: collabs }));
    expect(screen.queryByText(/^\+/)).not.toBeInTheDocument();
  });
});
