import { z } from 'zod';
import { CHOFFParser } from './parser/index.js';
import { JSONConversationStorage } from './storage/json-storage.js';
import { SemanticAnchorDetector } from './anchors/semantic-anchor-detector.js';
import { EnhancedRetrieval } from './tools-enhanced.js';
import type { ConversationStorage } from './storage/types.js';
import type { SemanticAnchor } from './anchors/types.js';

// Tool response interfaces

interface GetAnchorsResponse {
  anchors: SemanticAnchor[];
  total: number;
  filters: z.infer<typeof getAnchorsSchema>;
  source: string;
}

export interface MCPTool<T = unknown> {
  name: string;
  description: string;
  inputSchema: unknown;
  handler: (args: T) => ToolResult<unknown> | Promise<ToolResult<unknown>>;
}

export interface ToolResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
    retryable?: boolean;
  };
  metadata?: {
    tokensUsed: number;
    latencyMs: number;
  };
}

// Input schemas
const saveCheckpointSchema = z.object({
  content: z.string(),
  extractAnchors: z.boolean().optional(),
  generateSummary: z.boolean().optional(),
});

const loadContextSchema = z.object({
  query: z.string().optional(),
  timeRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  anchorsOnly: z.boolean().optional(),
  maxTokens: z.number().optional(),
  // Enhanced options
  contextFilter: z.union([z.string(), z.array(z.string())]).optional(),
  anchorTypeFilter: z
    .enum(['decision', 'blocker', 'breakthrough', 'question'])
    .optional(),
  stateFilter: z.union([z.string(), z.array(z.string())]).optional(),
  branchFilter: z.string().optional(),
});

const getAnchorsSchema = z.object({
  type: z.enum(['decision', 'blocker', 'breakthrough', 'question']).optional(),
  resolved: z.boolean().optional(),
  limit: z.number().optional(),
  content: z.string().optional(), // For parsing CHOFF from provided content
});

const clearMemorySchema = z.object({
  confirm: z.boolean(),
  beforeDate: z.string().datetime().optional(),
});

// Singleton storage instance
let storageInstance: ConversationStorage | null = null;

// Storage configuration (can be set for testing)
let storageConfig: { storageDir?: string; storagePath?: string } = {};

export function configureStorage(config: {
  storageDir?: string;
  storagePath?: string;
}): void {
  storageConfig = config;
  storageInstance = null; // Reset instance to use new config
}

function getStorage(): ConversationStorage {
  if (!storageInstance) {
    // Use explicit storagePath if provided, otherwise build from storageDir
    const storageFile =
      storageConfig.storagePath ||
      ((): string => {
        const storageDir = storageConfig.storageDir || './conversations';
        return storageDir.endsWith('.json')
          ? storageDir
          : `${storageDir}/conversations.json`;
      })();
    storageInstance = new JSONConversationStorage(storageFile);
  }
  return storageInstance;
}

// For testing purposes - reset storage instance
export function resetStorage(): void {
  storageInstance = null;
}

// Helper functions for conversation metadata
function generateSummary(content: string, anchors: SemanticAnchor[]): string {
  // Simple summary: first 100 chars + stats
  const preview = content.substring(0, 100);
  return `${preview}${content.length > 100 ? '...' : ''} (${anchors.length} anchors)`;
}

function extractTags(
  choffDocument: { contexts: Array<{ value: string }> },
  anchors: SemanticAnchor[],
): string[] {
  const tags = [];

  // Add context tags
  for (const context of choffDocument.contexts) {
    tags.push(`context:${context.value}`);
  }

  // Add anchor type tags
  const anchorTypes = new Set(anchors.map((a) => a.type));
  for (const type of anchorTypes) {
    tags.push(`anchor:${type}`);
  }

  return tags;
}

// Tool implementations
export function createSaveCheckpointTool(): MCPTool<
  z.infer<typeof saveCheckpointSchema>
> {
  return {
    name: 'saveCheckpoint',
    description: 'Save conversation checkpoint with CHOFF metadata extraction',
    inputSchema: {
      type: 'object',
      properties: {
        content: {
          type: 'string',
          description: 'The conversation content to save',
        },
        extractAnchors: {
          type: 'boolean',
          description: 'Whether to extract semantic anchors',
          default: true,
        },
        generateSummary: {
          type: 'boolean',
          description: 'Whether to generate a summary',
          default: false,
        },
      },
      required: ['content'],
    },
    handler: async (args): Promise<ToolResult<unknown>> => {
      try {
        // Validate input
        const input = args || { content: '' };
        const validated = saveCheckpointSchema.parse(input);

        // Parse CHOFF content
        const parser = new CHOFFParser();
        const choffDocument = parser.parse(validated.content);

        // Generate checkpoint ID
        const checkpointId = `chk_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        // Extract basic statistics
        const tokensProcessed = validated.content.split(/\s+/).length;

        // Extract semantic anchors if requested
        let anchors: SemanticAnchor[] = [];
        if (validated.extractAnchors !== false) {
          const detector = new SemanticAnchorDetector();
          anchors = detector.extract(validated.content);
        }

        // Generate summary and tags
        const summary = generateSummary(validated.content, anchors);
        const tags = extractTags(choffDocument, anchors);

        // Save to storage
        const storage = getStorage();
        const saveResult = await storage.save({
          content: validated.content,
          choffDocument,
          summary,
          tags,
          metadata: {
            tokensProcessed,
            anchorsExtracted: anchors.length,
            checkpointId,
            anchors,
          },
        });

        if (!saveResult.success) {
          return {
            success: false,
            error: {
              code: 'STORAGE_SAVE_ERROR',
              message: `Failed to save conversation: ${saveResult.error?.message || 'Unknown error'}`,
              retryable: true,
            },
          };
        }

        const conversationId = saveResult.data;

        return {
          success: true,
          data: {
            checkpointId,
            conversationId,
            tokensProcessed,
            anchorsExtracted: anchors.length,
            choffMetadata: {
              totalMarkers: choffDocument.statistics.totalMarkers,
              markerDensity: choffDocument.statistics.markerDensity,
              dominantStateType: choffDocument.statistics.dominantStateType,
              branchComplexity: choffDocument.statistics.branchComplexity,
              parseTime: choffDocument.parseTime,
              errors: choffDocument.errors.length,
            },
            states: choffDocument.states.length,
            contexts: choffDocument.contexts.length,
            patterns: choffDocument.patterns.length,
            directionals: choffDocument.directionals.length,
            branches: choffDocument.branches.length,
            socialLayers: choffDocument.socialLayers.length,
          },
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'PARSE_ERROR',
            message: `Failed to parse CHOFF content: ${error instanceof Error ? error.message : String(error)}`,
            retryable: false,
          },
        };
      }
    },
  };
}

export function createLoadContextTool(): MCPTool<
  z.infer<typeof loadContextSchema>
> {
  return {
    name: 'loadContext',
    description: 'Load relevant context from conversation history',
    inputSchema: {
      type: 'object',
      properties: {
        query: {
          type: 'string',
          description: 'Search query for context',
        },
        timeRange: {
          type: 'object',
          properties: {
            start: {
              type: 'string',
              format: 'date-time',
              description: 'Start time for context search',
            },
            end: {
              type: 'string',
              format: 'date-time',
              description: 'End time for context search',
            },
          },
        },
        anchorsOnly: {
          type: 'boolean',
          description: 'Return only semantic anchors',
          default: false,
        },
        maxTokens: {
          type: 'number',
          description: 'Maximum tokens to return',
          default: 4000,
        },
        contextFilter: {
          type: ['string', 'array'],
          description: 'Filter by CHOFF context(s)',
        },
        anchorTypeFilter: {
          type: 'string',
          enum: ['decision', 'blocker', 'breakthrough', 'question'],
          description: 'Filter by anchor type',
        },
        stateFilter: {
          type: ['string', 'array'],
          description: 'Filter by CHOFF state(s)',
        },
        branchFilter: {
          type: 'string',
          description: 'Filter by branch ID (local to conversation)',
        },
      },
    },
    handler: async (args): Promise<ToolResult<unknown>> => {
      try {
        const validated = loadContextSchema.parse(args);
        const storage = getStorage();

        // Use enhanced retrieval
        const enhancedRetrieval = new EnhancedRetrieval(storage);
        const result = await enhancedRetrieval.searchWithFallbacks(validated);

        return {
          success: true,
          data: result,
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'LOAD_CONTEXT_ERROR',
            message: `Failed to load context: ${error instanceof Error ? error.message : String(error)}`,
            retryable: true,
          },
        };
      }
    },
  };
}

export function createGetAnchorsTool(): MCPTool<
  z.infer<typeof getAnchorsSchema>
> {
  return {
    name: 'getAnchors',
    description: 'Get semantic anchors from conversations',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['decision', 'blocker', 'breakthrough', 'question'],
          description: 'Type of anchor to filter by',
        },
        resolved: {
          type: 'boolean',
          description: 'Filter by resolution status',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of anchors to return',
          default: 50,
        },
        content: {
          type: 'string',
          description: 'CHOFF-annotated content to extract anchors from',
        },
      },
    },
    handler: async (args): Promise<ToolResult<unknown>> => {
      try {
        const validated = getAnchorsSchema.parse(args);

        // If no content provided, extract from storage
        if (!validated.content) {
          const storage = getStorage();
          const searchResult = await storage.search({});

          if (!searchResult.success) {
            return {
              success: false,
              error: {
                code: 'STORAGE_SEARCH_ERROR',
                message: `Storage search failed: ${searchResult.error?.message || 'Unknown error'}`,
                retryable: true,
              },
            };
          }

          const conversations = searchResult.data || [];

          let allAnchors: SemanticAnchor[] = [];
          for (const conv of conversations) {
            if (conv.metadata?.anchors) {
              allAnchors.push(...conv.metadata.anchors);
            }
          }

          // Filter by type if specified
          if (validated.type) {
            allAnchors = allAnchors.filter((a) => a.type === validated.type);
          }

          // Filter by resolved status if specified
          if (validated.resolved !== undefined) {
            allAnchors = allAnchors.filter(
              (a) => a.resolved === validated.resolved,
            );
          }

          // Apply limit
          const limitedAnchors = validated.limit
            ? allAnchors.slice(0, validated.limit)
            : allAnchors;

          return {
            success: true,
            data: {
              anchors: limitedAnchors,
              total: allAnchors.length,
              filters: validated,
              source: 'stored_conversations',
            } as GetAnchorsResponse,
          };
        }

        // Use semantic anchor detector for content
        const detector = new SemanticAnchorDetector();
        let anchors = detector.extract(validated.content);

        // Filter by type if specified
        if (validated.type) {
          anchors = anchors.filter((a) => a.type === validated.type);
        }

        // Filter by resolved status if specified
        if (validated.resolved !== undefined) {
          anchors = anchors.filter((a) => a.resolved === validated.resolved);
        }

        // Apply limit
        const limitedAnchors = validated.limit
          ? anchors.slice(0, validated.limit)
          : anchors;

        return {
          success: true,
          data: {
            anchors: limitedAnchors,
            total: anchors.length,
            filters: validated,
            source: 'content',
          } as GetAnchorsResponse,
        };
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'ANCHOR_EXTRACTION_ERROR',
            message: `Failed to extract anchors: ${error instanceof Error ? error.message : String(error)}`,
            retryable: false,
          },
        };
      }
    },
  };
}

export function createClearMemoryTool(): MCPTool<
  z.infer<typeof clearMemorySchema>
> {
  return {
    name: 'clearMemory',
    description: 'Clear conversation memory with confirmation',
    inputSchema: {
      type: 'object',
      properties: {
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
        beforeDate: {
          type: 'string',
          format: 'date-time',
          description: 'Optional: Only clear conversations before this date',
        },
      },
      required: ['confirm'],
    },
    handler: async (args): Promise<ToolResult<unknown>> => {
      try {
        const validated = clearMemorySchema.parse(args);

        if (!validated.confirm) {
          return {
            success: false,
            error: {
              code: 'CONFIRMATION_REQUIRED',
              message:
                'Confirmation required to clear memory. Set confirm: true',
              retryable: true,
            },
          };
        }

        const storage = getStorage();

        if (validated.beforeDate) {
          // Clear conversations before specified date
          const searchResult = await storage.search({
            timeRange: {
              start: new Date(0), // Beginning of time
              end: new Date(validated.beforeDate),
            },
          });

          if (!searchResult.success) {
            return {
              success: false,
              error: {
                code: 'STORAGE_SEARCH_ERROR',
                message: `Storage search failed: ${searchResult.error?.message || 'Unknown error'}`,
                retryable: true,
              },
            };
          }

          const conversations = searchResult.data || [];

          let deletedCount = 0;
          for (const conv of conversations) {
            const deleteResult = await storage.delete(conv.id);
            if (deleteResult.success) {
              deletedCount++;
            }
          }

          return {
            success: true,
            data: {
              deletedCount,
              message: `Cleared ${deletedCount} conversations before ${validated.beforeDate}`,
            },
          };
        } else {
          // Clear all conversations
          const statsResult = await storage.getStats();
          if (!statsResult.success) {
            return {
              success: false,
              error: {
                code: 'STORAGE_STATS_ERROR',
                message: `Failed to get storage stats: ${statsResult.error?.message || 'Unknown error'}`,
                retryable: true,
              },
            };
          }

          // const totalBefore = statsResult.data?.totalEntries || 0;

          // Get all conversations and delete them
          const searchResult = await storage.search({});
          if (!searchResult.success) {
            return {
              success: false,
              error: {
                code: 'STORAGE_SEARCH_ERROR',
                message: `Storage search failed: ${searchResult.error?.message || 'Unknown error'}`,
                retryable: true,
              },
            };
          }

          const conversations = searchResult.data || [];
          let deletedCount = 0;
          for (const conv of conversations) {
            const deleteResult = await storage.delete(conv.id);
            if (deleteResult.success) {
              deletedCount++;
            }
          }

          return {
            success: true,
            data: {
              deletedCount,
              message: `Cleared all ${deletedCount} conversations`,
            },
          };
        }
      } catch (error) {
        return {
          success: false,
          error: {
            code: 'CLEAR_MEMORY_ERROR',
            message: `Failed to clear memory: ${error instanceof Error ? error.message : String(error)}`,
            retryable: true,
          },
        };
      }
    },
  };
}
