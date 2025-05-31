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
      });

      // Should parse valid input
      expect(() =>
        schema.parse({
          type: 'decision',
          resolved: false,
          limit: 10,
        }),
      ).not.toThrow();
    });
  });
});
