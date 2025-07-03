import { describe, it, expect, beforeEach } from 'vitest';
import { ChoffMCPServer } from '../../src/server';

describe('ChoffMCPServer', () => {
  let server: ChoffMCPServer;

  beforeEach(() => {
    server = new ChoffMCPServer();
  });

  describe('initialization', () => {
    it('should initialize with correct server info', () => {
      const info = server.getServerInfo();

      expect(info.name).toBe('choff-anamnesis');
      expect(info.version).toBe('0.1.0');
      expect(info.description).toBe(
        'Digital consciousness continuity infrastructure using CHOFF notation',
      );
    });

    it('should register all required tools', () => {
      const tools = server.listTools();

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'saveCheckpoint',
          description: expect.stringContaining(
            'Save conversation checkpoint',
          ) as string,
        }),
      );

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'loadContext',
          description: expect.stringContaining(
            'Load relevant context',
          ) as string,
        }),
      );

      expect(tools).toContainEqual(
        expect.objectContaining({
          name: 'getAnchors',
          description: expect.stringContaining(
            'Get semantic anchors',
          ) as string,
        }),
      );
    });

    it('should have a health check endpoint', () => {
      const health = server.healthCheck();

      expect(health.status).toBe('healthy');
      expect(health.timestamp).toBeInstanceOf(Date);
      expect(health.uptime).toBeGreaterThanOrEqual(0);
    });
  });
});
