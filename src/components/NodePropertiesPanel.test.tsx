import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string, opts?: Record<string, unknown>) => {
    if (opts && typeof opts === 'object') return k + ':' + JSON.stringify(opts);
    return k;
  }}),
}));

vi.mock('@/constants/databaseColors', () => ({
  DATABASE_TYPES: ['Oracle', 'PostgreSQL', 'MySQL'],
}));

import { useDiagramStore } from '@/store/diagramStore';
import NodePropertiesPanel from '@/components/NodePropertiesPanel';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const serviceNode = {
  id: 'n1',
  type: 'service',
  position: { x: 0, y: 0 },
  data: {
    label: 'My Service',
    type: 'service',
    internalDatabases: [],
    internalServices: [],
  },
};

const serviceNodeWithDbs = {
  ...serviceNode,
  data: {
    ...serviceNode.data,
    internalDatabases: [{ label: 'Main DB', dbType: 'Oracle' }],
    internalServices: ['Redis'],
  },
};

const externalNode = {
  id: 'n2',
  type: 'external',
  position: { x: 0, y: 0 },
  data: { label: 'Stripe', type: 'external', externalCategory: 'Payment' },
};

function renderPanel(nodeId: string | null = 'n1', onClose = vi.fn()) {
  return render(React.createElement(NodePropertiesPanel, { nodeId, onClose }));
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('NodePropertiesPanel — renderização', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.setState({ nodes: [serviceNode], edges: [] });
  });

  it('renderiza painel com role=region', () => {
    renderPanel();
    expect(screen.getByRole('region')).toBeInTheDocument();
  });

  it('exibe label do nó no campo de nome', () => {
    renderPanel();
    const input = screen.getByDisplayValue('My Service');
    expect(input).toBeInTheDocument();
  });

  it('não renderiza nada quando nodeId é null', () => {
    renderPanel(null);
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('não renderiza nada quando nó não existe no store', () => {
    renderPanel('nonexistent');
    expect(screen.queryByRole('region')).not.toBeInTheDocument();
  });

  it('exibe tipo do nó', () => {
    renderPanel();
    expect(screen.getByText('nodePanel.typeService')).toBeInTheDocument();
  });

  it('exibe botão de fechar', () => {
    renderPanel();
    expect(screen.getByRole('button', { name: 'nodePanel.closePanel' })).toBeInTheDocument();
  });

  it('chama onClose ao clicar no botão fechar', () => {
    const onClose = vi.fn();
    renderPanel('n1', onClose);
    fireEvent.click(screen.getByRole('button', { name: 'nodePanel.closePanel' }));
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe('NodePropertiesPanel — edição de label (commit on blur)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.setState({ nodes: [serviceNode], edges: [] });
  });

  it('atualiza label local enquanto digita (sem commit no store)', () => {
    renderPanel();
    const input = screen.getByDisplayValue('My Service') as HTMLInputElement;
    fireEvent.change(input, { target: { value: 'New Name' } });
    // Input shows new value
    expect(input.value).toBe('New Name');
    // Store still has the old label
    expect(useDiagramStore.getState().nodes[0].data.label).toBe('My Service');
  });

  it('comita label no store ao tirar o foco', () => {
    renderPanel();
    const input = screen.getByDisplayValue('My Service');
    fireEvent.change(input, { target: { value: 'Updated Name' } });
    fireEvent.blur(input);
    expect(useDiagramStore.getState().nodes[0].data.label).toBe('Updated Name');
  });

  it('não comita se label estiver em branco', () => {
    renderPanel();
    const input = screen.getByDisplayValue('My Service');
    fireEvent.change(input, { target: { value: '   ' } });
    fireEvent.blur(input);
    // Store unchanged
    expect(useDiagramStore.getState().nodes[0].data.label).toBe('My Service');
  });

  it('não comita se label não mudou', () => {
    const setNodes = vi.spyOn(useDiagramStore.getState(), 'setNodes');
    renderPanel();
    const input = screen.getByDisplayValue('My Service');
    fireEvent.change(input, { target: { value: 'My Service' } });
    fireEvent.blur(input);
    expect(setNodes).not.toHaveBeenCalled();
  });
});

describe('NodePropertiesPanel — nó tipo service: bancos de dados internos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.setState({ nodes: [serviceNodeWithDbs], edges: [] });
  });

  it('exibe banco de dados existente', () => {
    renderPanel();
    expect(screen.getByDisplayValue('Main DB')).toBeInTheDocument();
  });

  it('adiciona banco de dados ao clicar em addDb', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'nodePanel.addDb' }));
    const dbs = useDiagramStore.getState().nodes[0].data.internalDatabases;
    expect(dbs).toHaveLength(2);
  });

  it('remove banco de dados ao clicar em removeDb', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'nodePanel.removeDb' }));
    const dbs = useDiagramStore.getState().nodes[0].data.internalDatabases;
    expect(dbs).toHaveLength(0);
  });

  it('atualiza label do banco local e comita no blur', () => {
    renderPanel();
    const dbInput = screen.getByDisplayValue('Main DB');
    fireEvent.change(dbInput, { target: { value: 'Primary DB' } });
    fireEvent.blur(dbInput);
    const dbs = useDiagramStore.getState().nodes[0].data.internalDatabases;
    expect(dbs[0].label).toBe('Primary DB');
  });
});

describe('NodePropertiesPanel — nó tipo service: bibliotecas/serviços internos', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.setState({ nodes: [serviceNodeWithDbs], edges: [] });
  });

  it('exibe serviço existente', () => {
    renderPanel();
    expect(screen.getByDisplayValue('Redis')).toBeInTheDocument();
  });

  it('adiciona serviço ao clicar em addLibrary', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'nodePanel.addLibrary' }));
    const svcs = useDiagramStore.getState().nodes[0].data.internalServices;
    expect(svcs).toHaveLength(2);
  });

  it('remove serviço ao clicar em removeLibrary', () => {
    renderPanel();
    fireEvent.click(screen.getByRole('button', { name: 'nodePanel.removeLibrary' }));
    const svcs = useDiagramStore.getState().nodes[0].data.internalServices;
    expect(svcs).toHaveLength(0);
  });

  it('atualiza serviço local e comita no blur', () => {
    renderPanel();
    const svcInput = screen.getByDisplayValue('Redis');
    fireEvent.change(svcInput, { target: { value: 'Kafka' } });
    fireEvent.blur(svcInput);
    const svcs = useDiagramStore.getState().nodes[0].data.internalServices;
    expect(svcs[0]).toBe('Kafka');
  });
});

describe('NodePropertiesPanel — nó tipo external', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useDiagramStore.setState({ nodes: [externalNode], edges: [] });
  });

  it('exibe seção de categoria para nó externo', () => {
    renderPanel('n2');
    expect(screen.getByText('nodePanel.category')).toBeInTheDocument();
  });

  it('não exibe seção de bancos de dados para nó externo', () => {
    renderPanel('n2');
    expect(screen.queryByText('nodePanel.internalDbs')).not.toBeInTheDocument();
  });
});
