import { describe, it, expect } from 'vitest';
import { PROTOCOL_CONFIGS, type EdgeProtocol } from './diagram';

describe('PROTOCOL_CONFIGS', () => {
  const protocols = Object.keys(PROTOCOL_CONFIGS) as EdgeProtocol[];

  it('should have exactly 11 protocols', () => {
    expect(protocols).toHaveLength(11);
  });

  it('every protocol should have label, color, and async boolean', () => {
    for (const proto of protocols) {
      const config = PROTOCOL_CONFIGS[proto];
      expect(config.label).toBeTruthy();
      expect(config.color).toMatch(/^hsl\(/);
      expect(typeof config.async).toBe('boolean');
    }
  });

  it('async protocols should have dashArray', () => {
    for (const proto of protocols) {
      const config = PROTOCOL_CONFIGS[proto];
      if (config.async) {
        expect(config.dashArray).toBeTruthy();
      }
    }
  });

  it('sync protocols should NOT have dashArray', () => {
    for (const proto of protocols) {
      const config = PROTOCOL_CONFIGS[proto];
      if (!config.async) {
        expect(config.dashArray).toBeUndefined();
      }
    }
  });

  it('all protocol colors should have sufficient lightness for dark mode (L >= 40%)', () => {
    for (const proto of protocols) {
      const color = PROTOCOL_CONFIGS[proto].color;
      // Parse hsl(h, s%, l%) format
      const match = color.match(/hsl\(\s*(\d+)\s*,\s*(\d+)%?\s*,\s*(\d+)%?\s*\)/);
      expect(match, `Invalid HSL format for ${proto}: ${color}`).toBeTruthy();
      const lightness = parseInt(match![3], 10);
      expect(lightness, `${proto} lightness ${lightness}% is below 40%`).toBeGreaterThanOrEqual(40);
    }
  });
});
