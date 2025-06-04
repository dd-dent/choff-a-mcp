import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { ChoffHttpServer } from '../../src/http-api.js';

describe('ChoffHttpServer', () => {
  let server: ChoffHttpServer;

  beforeEach(() => {
    // Mock the storage configuration
    vi.mock('../../src/tools.js', () => ({
      configureStorage: vi.fn(),
      createLoadContextTool: (): any => ({
        handler: vi.fn().mockResolvedValue({
          success: true,
          data: {
            contexts: [],
            totalTokens: 0,
            searchStrategy: 'content_search',
          },
        }),
      }),
    }));
  });

  afterEach(async () => {
    if (server) {
      await server.stop();
    }
    vi.clearAllMocks();
  });

  describe('server lifecycle', () => {
    it('should start and stop the server', async () => {
      server = new ChoffHttpServer(0); // Use port 0 for random available port
      await server.start();

      const port = server.getPort();
      expect(port).toBeGreaterThan(0);

      // Verify server is listening
      const response = await fetch(`http://localhost:${port}/health`);
      expect(response.ok).toBe(true);

      await server.stop();

      // Verify server is stopped
      await expect(fetch(`http://localhost:${port}/health`)).rejects.toThrow();
    });

    it('should handle graceful shutdown on SIGTERM', async () => {
      server = new ChoffHttpServer(0);
      await server.start();

      const stopSpy = vi.spyOn(server, 'stop');
      process.emit('SIGTERM', 'SIGTERM');

      // Give it time to process
      await new Promise((resolve) => setTimeout(resolve, 100));

      expect(stopSpy).toHaveBeenCalled();
    });
  });

  describe('health endpoint', () => {
    beforeEach(async () => {
      server = new ChoffHttpServer(0);
      await server.start();
    });

    it('should return health status', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/health`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data).toMatchObject({
        status: 'ok',
        uptime: expect.any(Number),
        timestamp: expect.any(String),
      });
    });
  });

  describe('query endpoint', () => {
    beforeEach(async () => {
      server = new ChoffHttpServer(0);
      await server.start();
    });

    it('should handle basic query', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/api/query?q=test`);

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data).toMatchObject({
        success: true,
        data: {
          results: [],
          metadata: {
            total: 0,
            query: 'test',
            filters: {},
          },
        },
      });
    });

    it('should handle multiple filters', async () => {
      const port = server.getPort();
      const params = new URLSearchParams({
        q: 'quantum',
        context: 'technical,research',
        state: 'focused',
        anchorType: 'breakthrough',
        pchoffType: 'observation',
        limit: '10',
      });

      const response = await fetch(
        `http://localhost:${port}/api/query?${params.toString()}`,
      );

      expect(response.status).toBe(200);
      const data = (await response.json()) as any;

      expect(data.data.metadata.filters).toEqual({
        context: ['technical', 'research'],
        state: ['focused'],
        anchorType: 'breakthrough',
        pchoffType: 'observation',
      });
    });

    it('should validate query length', async () => {
      const port = server.getPort();
      const longQuery = 'a'.repeat(1001);

      const response = await fetch(
        `http://localhost:${port}/api/query?q=${longQuery}`,
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;

      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'INVALID_PARAMS',
          message: 'Query length exceeds maximum of 1000 characters',
        },
      });
    });

    it('should validate limit parameter', async () => {
      const port = server.getPort();

      const response = await fetch(
        `http://localhost:${port}/api/query?limit=500`,
      );

      expect(response.status).toBe(400);
      const data = (await response.json()) as any;

      expect(data.error.message).toContain('limit');
    });

    it('should support multiple output formats', async () => {
      const port = server.getPort();

      // JSON format (default)
      const jsonResponse = await fetch(
        `http://localhost:${port}/api/query?q=test`,
      );
      expect(jsonResponse.headers.get('content-type')).toContain(
        'application/json',
      );

      // Markdown format
      const mdResponse = await fetch(
        `http://localhost:${port}/api/query?q=test&format=markdown`,
      );
      expect(mdResponse.headers.get('content-type')).toContain('text/markdown');

      // Text format
      const textResponse = await fetch(
        `http://localhost:${port}/api/query?q=test&format=text`,
      );
      expect(textResponse.headers.get('content-type')).toContain('text/plain');

      // HTML format
      const htmlResponse = await fetch(
        `http://localhost:${port}/api/query?q=test&format=html`,
      );
      expect(htmlResponse.headers.get('content-type')).toContain('text/html');
    });

    it('should handle retrieval errors gracefully', async () => {
      // Create a new server instance with mocked tool
      const failingServer = new ChoffHttpServer(0);

      // Mock the loadContextTool to fail
      (failingServer as any).loadContextTool = {
        handler: vi.fn().mockRejectedValue(new Error('Storage unavailable')),
      };

      await failingServer.start();
      const port = failingServer.getPort();

      const response = await fetch(`http://localhost:${port}/api/query?q=test`);

      expect(response.status).toBe(500);
      const data = (await response.json()) as any;

      expect(data).toMatchObject({
        success: false,
        error: {
          code: 'INTERNAL_ERROR',
          message: 'Storage unavailable',
        },
      });

      await failingServer.stop();
    });
  });

  describe('CORS handling', () => {
    beforeEach(async () => {
      process.env.CORS_ORIGINS = 'http://localhost:3001,https://example.com';
      server = new ChoffHttpServer(0);
      await server.start();
    });

    afterEach(() => {
      delete process.env.CORS_ORIGINS;
    });

    it('should set CORS headers for allowed origins', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/api/query`, {
        headers: {
          Origin: 'http://localhost:3001',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBe(
        'http://localhost:3001',
      );
      expect(response.headers.get('access-control-allow-methods')).toBe(
        'GET, OPTIONS',
      );
    });

    it('should not set CORS headers for disallowed origins', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/api/query`, {
        headers: {
          Origin: 'http://evil.com',
        },
      });

      expect(response.headers.get('access-control-allow-origin')).toBeNull();
    });

    it('should handle preflight OPTIONS requests', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/api/query`, {
        method: 'OPTIONS',
        headers: {
          Origin: 'http://localhost:3001',
          'Access-Control-Request-Method': 'GET',
        },
      });

      expect(response.status).toBe(204);
      expect(response.headers.get('access-control-allow-origin')).toBe(
        'http://localhost:3001',
      );
    });
  });

  describe('viewer endpoint', () => {
    beforeEach(async () => {
      server = new ChoffHttpServer(0);
      await server.start();
    });

    it('should serve viewer HTML at /viewer', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/viewer`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');

      const html = await response.text();
      expect(html).toContain('CHOFF Memory Viewer');
      expect(html).toContain('Search your memory...');
    });

    it('should serve viewer HTML at /viewer.html', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/viewer.html`);

      expect(response.status).toBe(200);
      expect(response.headers.get('content-type')).toContain('text/html');
    });
  });

  describe('request validation', () => {
    beforeEach(async () => {
      server = new ChoffHttpServer(0);
      await server.start();
    });

    it('should reject URLs that are too long', async () => {
      const port = server.getPort();
      // req.url only contains path+query, not the full URL
      // Server checks for > 2000 chars in path+query
      const longParam = 'x'.repeat(2001);

      const response = await fetch(
        `http://localhost:${port}/api/query?param=${longParam}`,
      );

      expect(response.status).toBe(414);
      const data = (await response.json()) as any;
      expect(data.error.message).toContain('Request-URI Too Long');
    });

    it('should handle invalid paths', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/invalid/path`);

      expect(response.status).toBe(404);
      const data = (await response.json()) as any;
      expect(data.error.code).toBe('NOT_FOUND');
    });

    it('should only accept GET requests', async () => {
      const port = server.getPort();
      const response = await fetch(`http://localhost:${port}/api/query`, {
        method: 'POST',
      });

      expect(response.status).toBe(405);
      const data = (await response.json()) as any;
      expect(data.error.message).toContain('Method Not Allowed');
    });
  });
});
