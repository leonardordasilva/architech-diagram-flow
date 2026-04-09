import { describe, it, expect } from 'vitest';
import { getErrorMessage } from './getErrorMessage';

describe('getErrorMessage', () => {
  it('extracts message from Error instance', () => {
    expect(getErrorMessage(new Error('fail'))).toBe('fail');
  });

  it('returns string errors as-is', () => {
    expect(getErrorMessage('something broke')).toBe('something broke');
  });

  it('extracts message from plain object with message property', () => {
    expect(getErrorMessage({ message: 'obj error' })).toBe('obj error');
  });

  it('returns "Unknown error" for null', () => {
    expect(getErrorMessage(null)).toBe('Unknown error');
  });

  it('returns "Unknown error" for undefined', () => {
    expect(getErrorMessage(undefined)).toBe('Unknown error');
  });

  it('returns "Unknown error" for numbers', () => {
    expect(getErrorMessage(42)).toBe('Unknown error');
  });

  it('handles TypeError subclass', () => {
    expect(getErrorMessage(new TypeError('type fail'))).toBe('type fail');
  });
});
