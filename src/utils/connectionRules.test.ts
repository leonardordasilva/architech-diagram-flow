import { describe, it, expect } from 'vitest';
import { canConnect, connectionErrorMessage } from './connectionRules';
import type { NodeType } from '@/types/diagram';

const ALL_TYPES: NodeType[] = ['service', 'database', 'queue', 'external'];

describe('canConnect', () => {
  // service → all
  it('service can connect to service', () => expect(canConnect('service', 'service')).toBe(true));
  it('service can connect to database', () => expect(canConnect('service', 'database')).toBe(true));
  it('service can connect to queue', () => expect(canConnect('service', 'queue')).toBe(true));
  it('service can connect to external', () => expect(canConnect('service', 'external')).toBe(true));

  // database → service, external only
  it('database can connect to service', () => expect(canConnect('database', 'service')).toBe(true));
  it('database can connect to external', () => expect(canConnect('database', 'external')).toBe(true));
  it('database cannot connect to database', () => expect(canConnect('database', 'database')).toBe(false));
  it('database cannot connect to queue', () => expect(canConnect('database', 'queue')).toBe(false));

  // queue → service only
  it('queue can connect to service', () => expect(canConnect('queue', 'service')).toBe(true));
  it('queue cannot connect to database', () => expect(canConnect('queue', 'database')).toBe(false));
  it('queue cannot connect to queue', () => expect(canConnect('queue', 'queue')).toBe(false));
  it('queue cannot connect to external', () => expect(canConnect('queue', 'external')).toBe(false));

  // external → all
  it('external can connect to service', () => expect(canConnect('external', 'service')).toBe(true));
  it('external can connect to database', () => expect(canConnect('external', 'database')).toBe(true));
  it('external can connect to queue', () => expect(canConnect('external', 'queue')).toBe(true));
  it('external can connect to external', () => expect(canConnect('external', 'external')).toBe(true));

  it('returns false for unknown types', () => {
    expect(canConnect('unknown' as NodeType, 'service')).toBe(false);
  });
});

describe('connectionErrorMessage', () => {
  it('returns descriptive message in Portuguese', () => {
    const msg = connectionErrorMessage('database', 'queue');
    expect(msg).toContain('Banco de Dados');
    expect(msg).toContain('Fila/Mensageria');
  });

  it('uses correct names for all types', () => {
    expect(connectionErrorMessage('service', 'database')).toContain('Microserviço');
    expect(connectionErrorMessage('external', 'service')).toContain('Sistema Externo');
  });
});
