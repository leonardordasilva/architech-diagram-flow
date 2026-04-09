import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import React from 'react';

// ─── Mocks ────────────────────────────────────────────────────────────────────

vi.mock('@/hooks/use-toast', () => ({ toast: vi.fn() }));
import { toast } from '@/hooks/use-toast';

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (k: string) => k }),
}));

vi.mock('@/utils/getErrorMessage', () => ({
  getErrorMessage: (e: unknown) => (e instanceof Error ? e.message : String(e)),
}));

vi.mock('@/schemas/diagramSchema', () => ({
  ImportDiagramSchema: {
    parse: (v: unknown) => {
      const data = v as { nodes?: unknown; edges?: unknown; name?: unknown };
      if (!Array.isArray(data.nodes) || !Array.isArray(data.edges)) {
        const { ZodError } = require('zod');
        throw new ZodError([{ path: ['nodes'], message: 'Required', code: 'invalid_type', expected: 'array', received: 'undefined' }]);
      }
      return data;
    },
  },
}));

import ImportJSONModal from '@/components/ImportJSONModal';

// ─── Helpers ─────────────────────────────────────────────────────────────────

const validPayload = JSON.stringify({
  nodes: [{ id: 'n1', type: 'service', position: { x: 0, y: 0 }, data: { label: 'A', type: 'service' } }],
  edges: [],
  name: 'Test Diagram',
});

function renderModal(onImport = vi.fn()) {
  return render(
    React.createElement(ImportJSONModal, {
      open: true,
      onOpenChange: vi.fn(),
      onImport,
    }),
  );
}

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('ImportJSONModal — renderização', () => {
  it('renderiza título e área de drag-and-drop', () => {
    renderModal();
    expect(screen.getByText('importModal.title')).toBeInTheDocument();
    expect(screen.getByText('importModal.dragOrClick')).toBeInTheDocument();
  });

  it('botão de importar está desabilitado sem texto', () => {
    renderModal();
    expect(screen.getByText('importModal.import').closest('button')).toBeDisabled();
  });

  it('botão de importar é habilitado ao digitar JSON', () => {
    renderModal();
    const textarea = screen.getByRole('textbox');
    fireEvent.change(textarea, { target: { value: '{}' } });
    expect(screen.getByText('importModal.import').closest('button')).not.toBeDisabled();
  });
});

describe('ImportJSONModal — importação por texto', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('chama onImport com dados válidos', () => {
    const onImport = vi.fn();
    renderModal(onImport);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: validPayload } });
    fireEvent.click(screen.getByText('importModal.import'));
    expect(onImport).toHaveBeenCalledWith(
      expect.objectContaining({ nodes: expect.any(Array), edges: expect.any(Array) }),
    );
  });

  it('exibe toast de erro para JSON inválido', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'not-json{' } });
    fireEvent.click(screen.getByText('importModal.import'));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'importModal.invalidJSON' }),
    );
  });

  it('exibe toast de erro para JSON sem nodes/edges', () => {
    renderModal();
    fireEvent.change(screen.getByRole('textbox'), { target: { value: '{"title":"x"}' } });
    fireEvent.click(screen.getByText('importModal.import'));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive' }),
    );
  });

  it('exibe toast de erro quando payload excede 2 MB', () => {
    renderModal();
    const big = 'x'.repeat(2 * 1024 * 1024 + 1);
    fireEvent.change(screen.getByRole('textbox'), { target: { value: big } });
    fireEvent.click(screen.getByText('importModal.import'));
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'importModal.tooLarge' }),
    );
  });
});

describe('ImportJSONModal — upload de arquivo', () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it('rejeita arquivo não-JSON com toast', async () => {
    renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File(['{}'], 'diagram.txt', { type: 'text/plain' });
    fireEvent.change(input, { target: { files: [file] } });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'importModal.invalidFormat' }),
    );
  });

  it('rejeita arquivo JSON maior que 2 MB com toast', () => {
    renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const bigContent = 'x'.repeat(2 * 1024 * 1024 + 1);
    const file = new File([bigContent], 'big.json', { type: 'application/json' });
    Object.defineProperty(file, 'size', { value: bigContent.length });
    fireEvent.change(input, { target: { files: [file] } });
    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'importModal.tooLarge' }),
    );
  });

  it('preenche textarea ao carregar arquivo .json válido', async () => {
    renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([validPayload], 'diagram.json', { type: 'application/json' });

    // Mock FileReader
    const mockReadAsText = vi.fn();
    const mockFileReader: Partial<FileReader> = {
      readAsText: mockReadAsText,
      onload: null,
      onerror: null,
    };
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as FileReader);

    fireEvent.change(input, { target: { files: [file] } });

    // Simulate FileReader.onload inside act to avoid React state-update warning
    const loadEvent = { target: { result: validPayload } } as unknown as ProgressEvent<FileReader>;
    await act(async () => {
      (mockFileReader.onload as ((e: ProgressEvent<FileReader>) => void))?.(loadEvent);
    });

    await waitFor(() => {
      const textarea = screen.getByRole('textbox') as HTMLTextAreaElement;
      expect(textarea.value).toBe(validPayload);
    });
  });

  it('exibe toast de erro quando FileReader falha', () => {
    renderModal();
    const input = document.querySelector('input[type="file"]') as HTMLInputElement;
    const file = new File([validPayload], 'diagram.json', { type: 'application/json' });

    const mockReadAsText = vi.fn();
    const mockFileReader: Partial<FileReader> & { error: DOMException | null } = {
      readAsText: mockReadAsText,
      onload: null,
      onerror: null,
      error: new DOMException('Read failed'),
    };
    vi.spyOn(window, 'FileReader').mockImplementation(() => mockFileReader as FileReader);

    fireEvent.change(input, { target: { files: [file] } });

    // Simulate FileReader.onerror
    (mockFileReader.onerror as ((e: ProgressEvent<FileReader>) => void))?.(
      {} as ProgressEvent<FileReader>,
    );

    expect(toast).toHaveBeenCalledWith(
      expect.objectContaining({ variant: 'destructive', title: 'importModal.invalidJSON' }),
    );
  });
});

describe('ImportJSONModal — acessibilidade drag-and-drop', () => {
  it('área de drop é acionável via teclado (Enter)', () => {
    renderModal();
    const dropArea = screen.getByRole('button', { name: 'importModal.dragOrClick' });
    expect(dropArea).toBeInTheDocument();
    // Enter key should not throw
    fireEvent.keyDown(dropArea, { key: 'Enter' });
  });

  it('área de drop é acionável via teclado (Space)', () => {
    renderModal();
    const dropArea = screen.getByRole('button', { name: 'importModal.dragOrClick' });
    fireEvent.keyDown(dropArea, { key: ' ' });
    // No error thrown = pass
  });
});
