import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  ListToolsRequestSchema,
  CallToolRequestSchema,
  ErrorCode,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import {
  createSaveCheckpointTool,
  createLoadContextTool,
  createGetAnchorsTool,
} from './tools.js';

export interface ServerInfo {
  name: string;
  version: string;
  description: string;
}

export interface HealthCheck {
  status: 'healthy' | 'unhealthy';
  timestamp: Date;
  uptime: number;
}

export class ChoffMCPServer {
  private server: Server;
  private startTime: Date;

  constructor() {
    this.startTime = new Date();
    this.server = new Server(
      {
        name: 'choff-anamnesis',
        version: '0.1.0',
      },
      {
        capabilities: {
          tools: {},
        },
      },
    );

    // Only register tools when server is connected
  }

  private registerTools(): void {
    const saveCheckpoint = createSaveCheckpointTool();
    const loadContext = createLoadContextTool();
    const getAnchors = createGetAnchorsTool();

    // Register list tools handler
    this.server.setRequestHandler(ListToolsRequestSchema, () => {
      return {
        tools: [
          {
            name: saveCheckpoint.name,
            description: saveCheckpoint.description,
            inputSchema: saveCheckpoint.inputSchema,
          },
          {
            name: loadContext.name,
            description: loadContext.description,
            inputSchema: loadContext.inputSchema,
          },
          {
            name: getAnchors.name,
            description: getAnchors.description,
            inputSchema: getAnchors.inputSchema,
          },
        ],
      };
    });

    // Register call tool handler
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const { name, arguments: args } = request.params;

      let result;
      switch (name) {
        case 'saveCheckpoint':
          result = await saveCheckpoint.handler(
            args as Parameters<typeof saveCheckpoint.handler>[0],
          );
          break;
        case 'loadContext':
          result = await loadContext.handler(
            args as Parameters<typeof loadContext.handler>[0],
          );
          break;
        case 'getAnchors':
          result = await getAnchors.handler(
            args as Parameters<typeof getAnchors.handler>[0],
          );
          break;
        default:
          throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
      }

      // MCP expects the response to include content property
      if (!result.success && result.error) {
        throw new McpError(
          ErrorCode.InternalError,
          `Tool error: ${result.error.message}`,
        );
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result.data, null, 2),
          },
        ],
      };
    });
  }

  getServerInfo(): ServerInfo {
    return {
      name: 'choff-anamnesis',
      version: '0.1.0',
      description:
        'Digital consciousness continuity infrastructure using CHOFF notation',
    };
  }

  listTools(): Array<{ name: string; description: string }> {
    return [
      {
        name: 'saveCheckpoint',
        description:
          'Save conversation checkpoint with CHOFF metadata extraction',
      },
      {
        name: 'loadContext',
        description: 'Load relevant context from conversation history',
      },
      {
        name: 'getAnchors',
        description: 'Get semantic anchors from conversations',
      },
    ];
  }

  healthCheck(): HealthCheck {
    const now = new Date();
    const uptime = now.getTime() - this.startTime.getTime();

    return {
      status: 'healthy',
      timestamp: now,
      uptime,
    };
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    this.registerTools();
    await this.server.connect(transport);
  }
}

// Main entry point
export async function main(): Promise<void> {
  // Parse command line arguments
  const args = process.argv.slice(2);
  const storagePathIndex = args.indexOf('--storage-path');

  if (storagePathIndex !== -1 && storagePathIndex + 1 < args.length) {
    const storagePath = args[storagePathIndex + 1];
    // Import configureStorage and configure it
    const { configureStorage } = await import('./tools.js');
    configureStorage({ storageDir: storagePath });
  }

  const server = new ChoffMCPServer();
  await server.run();
}
