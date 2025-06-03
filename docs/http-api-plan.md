# HTTP API Implementation Plan

{state:planning}[context:architecture] &pattern:composition|strategic|

## Overview

Create a lightweight HTTP API that proxies the enhanced retrieval system, enabling web-based access to the CHOFF memory system without rebuilding the retrieval logic in client-side JavaScript.

## Design Principles

1. **Composition Over Construction**: Leverage existing enhanced retrieval system
2. **Minimal Surface Area**: Single endpoint with query parameters
3. **TDD First**: Write tests before implementation
4. **Existing Patterns**: Follow server.ts and tools.ts patterns
5. **No New Dependencies**: Use Node.js built-in `http` module

## Architecture

### File Structure

```
src/
├── http-api.ts          # Main HTTP server implementation (includes types)
└── cli.ts               # Add 'serve' command for HTTP mode

tests/
└── unit/
    └── http-api.test.ts # TDD tests for HTTP functionality
```

### API Design

**Endpoints**:

- `GET /api/query` - Main query endpoint
- `GET /health` - Health check endpoint

**Query Parameters** (`/api/query`):

- `q` - Search query (optional, max 1000 chars)
- `context` - Context filter (optional, comma-separated)
- `state` - State filter (optional, comma-separated)
- `anchorType` - Anchor type filter (optional)
- `pchoffType` - PCHOFF classification filter (optional)
- `limit` - Result limit (optional, default: 50, max: 200)
- `format` - Output format: json|markdown|text|html (optional, default: json)

**Response Format**:

```typescript
interface ApiResponse {
  success: boolean;
  data?: {
    results: Array<ConversationWithAnchors | SemanticAnchor>;
    metadata: {
      total: number;
      query: string;
      filters: Record<string, string[]>;
    };
  };
  error?: {
    code: string;
    message: string;
  };
}

// Health check response
interface HealthResponse {
  status: 'ok' | 'error';
  uptime: number;
  timestamp: string;
}
```

### Implementation Strategy

1. **Reuse Enhanced Retrieval**:

   ```typescript
   // Direct proxy to loadContext tool
   const results = await loadContextTool.handler({
     query: req.query.q,
     contextFilter: req.query.context?.split(','),
     stateFilter: req.query.state?.split(','),
     anchorTypeFilter: req.query.anchorType,
     pchoffTypeFilter: req.query.pchoffType,
     maxTokens: parseInt(req.query.limit) || 50,
   });
   ```

2. **Error Handling Pattern** (from existing code):

   ```typescript
   try {
     const result = await enhancedRetrieval(params);
     res.statusCode = 200;
     return { success: true, data: result };
   } catch (error) {
     if (error.code === 'INVALID_PARAMS') res.statusCode = 400;
     else if (error.code === 'NOT_FOUND') res.statusCode = 404;
     else res.statusCode = 500;

     return {
       success: false,
       error: { code: error.code || 'INTERNAL_ERROR', message: error.message },
     };
   }
   ```

3. **Server Lifecycle** (following server.ts pattern):
   ```typescript
   export class ChoffHttpServer {
     private server: http.Server;
     private port: number;
     private startTime: Date;

     constructor(port: number = 3000) {
       this.port = port;
       this.startTime = new Date();
     }

     async start(): Promise<void> {
       // Create server with request handling
       // Handle SIGTERM/SIGINT for graceful shutdown
     }

     async stop(): Promise<void> {
       // Graceful shutdown with timeout
     }

     private handleRequest(req: IncomingMessage, res: ServerResponse): void {
       // Route to /api/query or /health
     }
   }
   ```

## Testing Strategy

1. **Unit Tests** (http-api.test.ts):

   - Server starts and stops correctly
   - Query parameter parsing
   - Enhanced retrieval integration
   - Error handling scenarios
   - Format conversion (JSON/Markdown/Text)

2. **Integration Points**:
   - Verify loadContext tool is called with correct params
   - Response formatting matches CLI output formats
   - CORS headers for browser access

## Security Considerations

1. **Read-Only**: No write operations exposed
2. **Input Validation**: Zod schemas for query params with limits:
   - Max query length: 1000 characters
   - Max URL length: 2048 characters
   - Max result limit: 200
3. **Rate Limiting**: Basic in-memory rate limit (optional for v1)
4. **CORS**: Configurable allowed origins:
   ```typescript
   const ALLOWED_ORIGINS = process.env.CORS_ORIGINS?.split(',') || [
     'http://localhost:*',
   ];
   ```
5. **Request Timeouts**: 30-second timeout for long searches
6. **No Query Injection**: Parameters validated and sanitized

## CLI Integration

Add to existing CLI:

```bash
choff serve --port 3000  # Start HTTP server
choff serve              # Default port 3000
choff serve --port 3000 --storage-path ./memory  # With custom storage
```

**Note**: HTTP server runs independently from MCP server. They don't need to run together.

## Time Estimate

Based on 4x speed pattern:

- TDD test suite: 5 minutes
- HTTP server implementation: 5 minutes
- CLI integration: 2 minutes
- Testing & cleanup: 3 minutes
- **Total: 15 minutes**

## Success Criteria

1. All tests green
2. Zero linting errors
3. Existing retrieval system fully leveraged
4. Same filtering capabilities as CLI
5. Ready for browser bookmarklet consumption

## Next Steps After Implementation

1. Browser bookmarklet (15 min)
2. Simple HTML interface
3. Fetch from this API endpoint

---

{state:confident}[context:plan_complete] &pattern:architectural_clarity|achieved|
