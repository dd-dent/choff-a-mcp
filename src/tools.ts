import { z } from 'zod';
import { CHOFFParser } from './parser/index.js';

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
});

const getAnchorsSchema = z.object({
  type: z.enum(['decision', 'blocker', 'breakthrough', 'question']).optional(),
  resolved: z.boolean().optional(),
  limit: z.number().optional(),
  content: z.string().optional(), // For parsing CHOFF from provided content
});

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
    handler: (args): ToolResult<unknown> => {
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
        const anchorsExtracted = validated.extractAnchors
          ? choffDocument.statistics.totalMarkers
          : undefined;

        return {
          success: true,
          data: {
            checkpointId,
            tokensProcessed,
            anchorsExtracted,
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
      },
    },
    handler: (args): ToolResult<unknown> => {
      const validated = loadContextSchema.parse(args);

      // For now, return empty context
      return {
        success: true,
        data: {
          contexts: [],
          totalTokens: 0,
          query: validated.query,
        },
      };
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
    handler: (args): ToolResult<unknown> => {
      try {
        const validated = getAnchorsSchema.parse(args);

        if (!validated.content) {
          return {
            success: true,
            data: {
              anchors: [],
              total: 0,
              filters: validated,
              message: 'No content provided for anchor extraction',
            },
          };
        }

        // Parse CHOFF content
        const parser = new CHOFFParser();
        const choffDocument = parser.parse(validated.content);

        // Extract semantic anchors from CHOFF markers
        const anchors = [];

        // Map state markers to semantic anchors
        for (const state of choffDocument.states) {
          let anchorType: string | null = null;
          const confidence = 0.8; // Base confidence for state-based anchors

          if (state.type === 'simple') {
            const value = state.value.toLowerCase();
            if (value.includes('decisive') || value.includes('decided')) {
              anchorType = 'decision';
            } else if (value.includes('blocked') || value.includes('stuck')) {
              anchorType = 'blocker';
            } else if (
              value.includes('eureka') ||
              value.includes('breakthrough')
            ) {
              anchorType = 'breakthrough';
            } else if (
              value.includes('questioning') ||
              value.includes('curious')
            ) {
              anchorType = 'question';
            }
          }

          if (
            anchorType &&
            (!validated.type || validated.type === anchorType)
          ) {
            anchors.push({
              id: `anchor_${anchors.length + 1}`,
              type: anchorType,
              confidence,
              position: state.position,
              content: state.raw,
              context: 'state_marker',
              resolved: false, // Default to unresolved
            });
          }
        }

        // Map pattern markers to semantic anchors
        for (const pattern of choffDocument.patterns) {
          let anchorType: string | null = null;
          const confidence = 0.7; // Slightly lower confidence for pattern-based anchors

          const category = pattern.category.toLowerCase();
          if (category.includes('decision') || category.includes('choice')) {
            anchorType = 'decision';
          } else if (category.includes('block') || category.includes('stuck')) {
            anchorType = 'blocker';
          } else if (
            category.includes('breakthrough') ||
            category.includes('solution')
          ) {
            anchorType = 'breakthrough';
          } else if (
            category.includes('question') ||
            category.includes('inquiry')
          ) {
            anchorType = 'question';
          }

          if (
            anchorType &&
            (!validated.type || validated.type === anchorType)
          ) {
            anchors.push({
              id: `anchor_${anchors.length + 1}`,
              type: anchorType,
              confidence,
              position: pattern.position,
              content: pattern.raw,
              context: 'pattern_marker',
              resolved:
                pattern.flow === 'completed' || pattern.flow === 'resolved',
            });
          }
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
            choffStats: {
              totalMarkers: choffDocument.statistics.totalMarkers,
              parseTime: choffDocument.parseTime,
              errors: choffDocument.errors.length,
            },
          },
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
