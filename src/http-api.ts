import http, { IncomingMessage, ServerResponse } from 'node:http';
import { URL } from 'node:url';
import { z } from 'zod';
import { createLoadContextTool } from './tools.js';
import type { SemanticAnchor } from './anchors/types.js';
import type { EnhancedLoadContextResponse } from './tools-enhanced.js';

// Request validation schemas
const QueryParamsSchema = z.object({
  q: z.string().max(1000).optional(),
  context: z.string().optional(),
  state: z.string().optional(),
  anchorType: z
    .enum(['decision', 'blocker', 'breakthrough', 'question'])
    .optional(),
  pchoffType: z
    .enum(['observation', 'insight', 'methodology', 'outcome'])
    .optional(),
  limit: z
    .string()
    .transform(Number)
    .pipe(z.number().min(1).max(200))
    .optional(),
  format: z.enum(['json', 'markdown', 'text', 'html']).default('json'),
});

// Response types
interface ApiResponse {
  success: boolean;
  data?: {
    results: Array<
      | {
          conversationId: string;
          content?: string;
          summary?: string;
          tags?: string[];
          anchors: SemanticAnchor[];
          timestamp: Date;
        }
      | SemanticAnchor
    >;
    metadata: {
      total: number;
      query: string;
      filters: Record<string, string | string[]>;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

interface HealthResponse {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
}

export class ChoffHttpServer {
  private server: http.Server | null = null;
  private port: number;
  private startTime: Date;
  private loadContextTool: ReturnType<typeof createLoadContextTool>;

  constructor(port: number = 3000) {
    this.port = port;
    this.startTime = new Date();
    this.loadContextTool = createLoadContextTool();
  }

  async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server = http.createServer((req, res) => {
        this.handleRequest(req, res).catch((error) => {
          console.error('Request handling error:', error);
          this.sendError(res, 500, 'INTERNAL_ERROR', 'Internal server error');
        });
      });

      this.server.listen(this.port, () => {
        if (this.port === 0) {
          // Update port if using random port
          const address = this.server!.address();
          if (address && typeof address !== 'string') {
            this.port = address.port;
          }
        }
        console.log(`HTTP server listening on port ${this.port}`);

        // Setup graceful shutdown with listener limit
        process.setMaxListeners(process.getMaxListeners() + 2);
        process.on('SIGTERM', () => {
          void this.stop();
        });
        process.on('SIGINT', () => {
          void this.stop();
        });

        resolve();
      });
    });
  }

  async stop(): Promise<void> {
    return new Promise((resolve) => {
      if (!this.server) {
        resolve();
        return;
      }

      this.server.close(() => {
        console.log('HTTP server stopped');
        resolve();
      });

      // Force close after 5 seconds
      setTimeout(() => {
        this.server?.closeAllConnections();
        resolve();
      }, 5000);
    });
  }

  getPort(): number {
    return this.port;
  }

  private async handleRequest(
    req: IncomingMessage,
    res: ServerResponse,
  ): Promise<void> {
    // Check URL length before parsing
    if (!req.url) {
      this.sendError(res, 400, 'INVALID_REQUEST', 'Missing URL');
      return;
    }

    // Note: req.url only contains the path + query, not the full URL
    // For a 2048 char limit on the full URL, we need to account for host
    // But for simplicity, we'll check the path+query length
    if (req.url.length > 2000) {
      this.sendError(res, 414, 'URI_TOO_LONG', 'Request-URI Too Long');
      return;
    }

    // Parse URL
    const url = new URL(req.url || '/', `http://localhost:${this.port}`);

    // Handle CORS
    this.setCorsHeaders(req, res);

    // Handle preflight
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    // Only accept GET requests
    if (req.method !== 'GET') {
      this.sendError(res, 405, 'METHOD_NOT_ALLOWED', 'Method Not Allowed');
      return;
    }

    // Route requests
    switch (url.pathname) {
      case '/health':
        this.handleHealth(res);
        break;
      case '/api/query':
        await this.handleQuery(url, res);
        break;
      default:
        this.sendError(res, 404, 'NOT_FOUND', 'Endpoint not found');
    }
  }

  private setCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
    const origin = req.headers.origin;
    if (!origin) return;

    const allowedOrigins = process.env.CORS_ORIGINS?.split(',') || [
      'http://localhost:*',
    ];

    // Check if origin is allowed
    const isAllowed = allowedOrigins.some((allowed) => {
      if (allowed.includes('*')) {
        const pattern = allowed.replace('*', '.*');
        return new RegExp(`^${pattern}$`).test(origin);
      }
      return allowed === origin;
    });

    if (isAllowed) {
      res.setHeader('Access-Control-Allow-Origin', origin);
      res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
      res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    }
  }

  private handleHealth(res: ServerResponse): void {
    const uptime = Date.now() - this.startTime.getTime();
    const response: HealthResponse = {
      status: 'ok',
      uptime: Math.floor(uptime / 1000), // seconds
      timestamp: new Date().toISOString(),
    };

    res.setHeader('Content-Type', 'application/json');
    res.statusCode = 200;
    res.end(JSON.stringify(response));
  }

  private async handleQuery(url: URL, res: ServerResponse): Promise<void> {
    try {
      // Parse and validate query parameters
      const rawParams = Object.fromEntries(url.searchParams);
      const result = QueryParamsSchema.safeParse(rawParams);

      if (!result.success) {
        const message = result.error.errors[0].message;
        // Make messages more user-friendly
        if (message.includes('1000 character')) {
          this.sendError(
            res,
            400,
            'INVALID_PARAMS',
            'Query length exceeds maximum of 1000 characters',
          );
        } else if (message.includes('200')) {
          this.sendError(
            res,
            400,
            'INVALID_PARAMS',
            'Result limit exceeds maximum of 200',
          );
        } else {
          this.sendError(res, 400, 'INVALID_PARAMS', message);
        }
        return;
      }

      const params = result.data;

      // Build filters object for metadata
      const filters: Record<string, string | string[]> = {};
      if (params.context) filters.context = params.context.split(',');
      if (params.state) filters.state = params.state.split(',');
      if (params.anchorType) filters.anchorType = params.anchorType;
      if (params.pchoffType) filters.pchoffType = params.pchoffType;

      // Call loadContext tool
      const toolResult = await this.loadContextTool.handler({
        query: params.q,
        contextFilter: filters.context as string[],
        stateFilter: filters.state as string[],
        anchorTypeFilter: params.anchorType,
        pchoffType: params.pchoffType,
        maxTokens: params.limit || 50,
      });

      if (!toolResult.success) {
        throw new Error(toolResult.error?.message || 'Unknown error');
      }

      // Transform the enhanced retrieval response to API response format
      const enhancedData = toolResult.data as EnhancedLoadContextResponse;
      const results = enhancedData.contexts.map((context) => ({
        conversationId: context.conversationId,
        content: context.content,
        summary: context.summary,
        tags: context.tags || [],
        anchors: context.anchors || [],
        timestamp: context.timestamp,
      }));

      // Format response based on requested format
      this.sendResponse(res, params.format, {
        success: true,
        data: {
          results,
          metadata: {
            total: results.length,
            query: params.q || '',
            filters,
          },
        },
      });
    } catch (error) {
      console.error('Query error:', error);
      const message = error instanceof Error ? error.message : 'Unknown error';
      this.sendError(res, 500, 'INTERNAL_ERROR', message);
    }
  }

  private sendResponse(
    res: ServerResponse,
    format: string,
    data: ApiResponse,
  ): void {
    res.statusCode = 200;

    switch (format) {
      case 'json':
        res.setHeader('Content-Type', 'application/json');
        res.end(JSON.stringify(data, null, 2));
        break;

      case 'markdown':
        res.setHeader('Content-Type', 'text/markdown');
        res.end(this.formatAsMarkdown(data));
        break;

      case 'text':
        res.setHeader('Content-Type', 'text/plain');
        res.end(this.formatAsText(data));
        break;

      case 'html':
        res.setHeader('Content-Type', 'text/html');
        res.end(this.formatAsHtml(data));
        break;
    }
  }

  private formatAsMarkdown(data: ApiResponse): string {
    if (!data.success || !data.data) {
      return `# Error\n\n${data.error?.message}`;
    }

    let md = `# Search Results\n\n`;
    md += `**Query**: ${data.data.metadata.query || 'All'}\n`;
    md += `**Total Results**: ${data.data.metadata.total}\n\n`;

    for (const result of data.data.results) {
      if ('conversationId' in result) {
        // Conversation result
        md += `## Conversation ${result.conversationId}\n`;
        md += `- **Timestamp**: ${result.timestamp.toISOString()}\n`;
        if (result.summary) md += `- **Summary**: ${result.summary}\n`;
        if (result.anchors.length > 0) {
          md += `- **Anchors**:\n`;
          for (const anchor of result.anchors) {
            md += `  - **${anchor.type}**: ${anchor.text}\n`;
          }
        }
      } else {
        // SemanticAnchor
        md += `## ${result.type}: ${result.text}\n`;
        md += `- **Confidence**: ${result.confidence}\n`;
        md += `- **Timestamp**: ${result.extractedAt.toISOString()}\n`;
      }
      md += '\n';
    }

    return md;
  }

  private formatAsText(data: ApiResponse): string {
    if (!data.success || !data.data) {
      return `Error: ${data.error?.message}`;
    }

    let text = `Search Results\n`;
    text += `=============\n\n`;
    text += `Query: ${data.data.metadata.query || 'All'}\n`;
    text += `Total: ${data.data.metadata.total}\n\n`;

    for (const result of data.data.results) {
      if ('conversationId' in result) {
        text += `Conversation ${result.conversationId}\n`;
        text += `  Timestamp: ${result.timestamp.toISOString()}\n`;
        if (result.summary) text += `  Summary: ${result.summary}\n`;
      } else {
        text += `${result.type}: ${result.text}\n`;
        text += `  Confidence: ${result.confidence}\n`;
      }
      text += '\n';
    }

    return text;
  }

  private formatAsHtml(data: ApiResponse): string {
    if (!data.success || !data.data) {
      return `<html><body><h1>Error</h1><p>${data.error?.message}</p></body></html>`;
    }

    let html = `<!DOCTYPE html>
<html>
<head>
  <title>CHOFF Memory Search</title>
  <style>
    body { font-family: sans-serif; margin: 20px; }
    .result { border: 1px solid #ccc; padding: 10px; margin: 10px 0; }
    .anchor { margin-left: 20px; }
    .metadata { color: #666; }
  </style>
</head>
<body>
  <h1>Search Results</h1>
  <div class="metadata">
    <p><strong>Query:</strong> ${data.data.metadata.query || 'All'}</p>
    <p><strong>Total Results:</strong> ${data.data.metadata.total}</p>
  </div>`;

    for (const result of data.data.results) {
      html += '<div class="result">';
      if ('conversationId' in result) {
        html += `<h3>Conversation ${result.conversationId}</h3>`;
        html += `<p class="metadata">Timestamp: ${result.timestamp.toISOString()}</p>`;
        if (result.summary) html += `<p>${result.summary}</p>`;
        if (result.anchors.length > 0) {
          html += '<div class="anchors"><h4>Anchors:</h4>';
          for (const anchor of result.anchors) {
            html += `<div class="anchor"><strong>${anchor.type}:</strong> ${anchor.text}</div>`;
          }
          html += '</div>';
        }
      } else {
        html += `<h3>${result.type}: ${result.text}</h3>`;
        html += `<p class="metadata">Confidence: ${result.confidence}</p>`;
      }
      html += '</div>';
    }

    html += '</body></html>';
    return html;
  }

  private sendError(
    res: ServerResponse,
    statusCode: number,
    code: string,
    message: string,
  ): void {
    res.statusCode = statusCode;
    res.setHeader('Content-Type', 'application/json');
    res.end(
      JSON.stringify({
        success: false,
        error: { code, message },
      }),
    );
  }
}
