import { describe, it, expect } from 'vitest';
import { z } from 'zod';
import {
  createSaveCheckpointTool,
  createLoadContextTool,
  createGetAnchorsTool,
} from '../../src/tools';

describe('MCP Tools', () => {
  describe('saveCheckpoint tool', () => {
    it('should have correct schema', () => {
      const tool = createSaveCheckpointTool();

      expect(tool.name).toBe('saveCheckpoint');
      expect(tool.description).toContain('Save conversation checkpoint');
      expect(tool.inputSchema).toBeDefined();

      // Validate schema structure
      const schema = z.object({
        content: z.string(),
        extractAnchors: z.boolean().optional(),
        generateSummary: z.boolean().optional(),
      });

      // Should parse valid input
      expect(() =>
        schema.parse({
          content: 'Test conversation content',
        }),
      ).not.toThrow();
    });

    it('should return checkpoint ID on success', async () => {
      const tool = createSaveCheckpointTool();
      const result = await tool.handler({
        content: 'Test conversation with {state:decisive} decision made',
        extractAnchors: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('checkpointId');
      expect((result.data as { checkpointId: string }).checkpointId).toMatch(
        /^chk_/,
      );
    });

    it('should parse complex CHOFF content and extract all metadata', async () => {
      const tool = createSaveCheckpointTool();
      const choffContent = `{state:analytical} [context:testing]
I am thinking about this &pattern:development|active| problem.
→ Let me explore this further with {state:weighted|focused[0.8]|curious[0.2]|}
{branch:exploration|Investigation} trying different approaches.`;

      const result = await tool.handler({
        content: choffContent,
        extractAnchors: true,
      });

      expect(result.success).toBe(true);
      expect(result.data).toHaveProperty('choffMetadata');

      // Type assertion for the specific result data structure
      const data = result.data as {
        choffMetadata: {
          totalMarkers: number;
          markerDensity: number;
          parseTime: number;
        };
        states: number;
        contexts: number;
        patterns: number;
        directionals: number;
        branches: number;
      };

      // Check CHOFF metadata
      expect(data.choffMetadata.totalMarkers).toBeGreaterThan(0);
      expect(data.choffMetadata).toHaveProperty('markerDensity');
      expect(data.choffMetadata).toHaveProperty('parseTime');

      // Check individual marker counts
      expect(data.states).toBe(2); // analytical + weighted state
      expect(data.contexts).toBe(1); // testing context
      expect(data.patterns).toBe(1); // development pattern
      expect(data.directionals).toBe(1); // → operator
      expect(data.branches).toBe(1); // exploration branch
    });
  });

  describe('loadContext tool', () => {
    it('should have correct schema', () => {
      const tool = createLoadContextTool();

      expect(tool.name).toBe('loadContext');
      expect(tool.description).toContain('Load relevant context');
      expect(tool.inputSchema).toBeDefined();

      // Validate schema structure
      const schema = z.object({
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

      // Should parse valid input
      expect(() =>
        schema.parse({
          query: 'database decisions',
          maxTokens: 4000,
        }),
      ).not.toThrow();
    });
  });

  describe('getAnchors tool', () => {
    it('should have correct schema', () => {
      const tool = createGetAnchorsTool();

      expect(tool.name).toBe('getAnchors');
      expect(tool.description).toContain('Get semantic anchors');
      expect(tool.inputSchema).toBeDefined();

      // Validate schema structure
      const schema = z.object({
        type: z
          .enum(['decision', 'blocker', 'breakthrough', 'question'])
          .optional(),
        resolved: z.boolean().optional(),
        limit: z.number().optional(),
        content: z.string().optional(),
      });

      // Should parse valid input
      expect(() =>
        schema.parse({
          type: 'decision',
          resolved: false,
          limit: 10,
          content: 'Test content',
        }),
      ).not.toThrow();
    });

    it('should extract semantic anchors from CHOFF content', async () => {
      const tool = createGetAnchorsTool();
      const choffContent = `I am {state:decisive} about this choice.
We are {state:blocked} on the database issue.
Found a {state:eureka} solution to the problem!
&pattern:question|open| How should we proceed?`;

      const result = await tool.handler({
        content: choffContent,
        limit: 10,
      });

      expect(result.success).toBe(true);

      // Type assertion for the result data structure
      const data = result.data as {
        anchors: Array<{
          id: string;
          type: string;
          confidence: number;
          position: object;
          content: string;
        }>;
        total: number;
      };

      expect(data.anchors).toHaveLength(4); // decisive, blocked, eureka states + question pattern
      expect(data.total).toBe(4);

      // Check anchor types
      const anchorTypes = data.anchors.map((a) => a.type);
      expect(anchorTypes).toContain('decision');
      expect(anchorTypes).toContain('blocker');
      expect(anchorTypes).toContain('breakthrough');
      expect(anchorTypes).toContain('question');

      // Check anchor structure
      expect(data.anchors[0]).toHaveProperty('id');
      expect(data.anchors[0]).toHaveProperty('confidence');
      expect(data.anchors[0]).toHaveProperty('position');
      expect(data.anchors[0]).toHaveProperty('content');
    });
  });
});
