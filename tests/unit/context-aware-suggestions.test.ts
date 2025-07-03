import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import {
  createLoadContextTool,
  configureStorage,
  resetStorage,
} from '../../src/tools.js';
import { JSONConversationStorage } from '../../src/storage/json-storage.js';
import { CHOFFParser } from '../../src/parser/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Context-Aware Suggestions for Empty Results', () => {
  let tempDir: string;
  let storagePath: string;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'choff-test-'));
    storagePath = path.join(tempDir, 'test-conversations.json');

    // Configure storage with temp path
    configureStorage({ storagePath });
    const storage = new JSONConversationStorage(storagePath);

    // Create minimal test data for available filters
    const parser = new CHOFFParser();
    const content = '{state:analytical}[context:technical] Test content';
    const choffDoc = parser.parse(content);

    await storage.save({
      content,
      choffDocument: choffDoc,
      summary: 'Test',
      tags: ['context:technical', 'state:analytical'],
      metadata: {
        tokensProcessed: 10,
        anchorsExtracted: 0,
        checkpointId: 'test_001',
        anchors: [],
      },
    });
  });

  afterEach(async () => {
    resetStorage();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Suggestion Count Constraints', () => {
    it('should show maximum 2 suggestions for empty results', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'nonexistent123xyz' });

      expect(result.success).toBe(true);
      const data = result.data as any;

      // Count actual suggestion lines (exclude header)
      const suggestions = data.suggestions || [];
      const actualSuggestions = suggestions.filter(
        (s: string) => s && !s.includes('No results found'),
      );

      expect(actualSuggestions.length).toBeLessThanOrEqual(2);
    });

    it('should not show suggestions when results are found', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'technical' });

      expect(result.success).toBe(true);
      const data = result.data as any;

      expect(data.contexts.length).toBeGreaterThan(0);
      expect(data.suggestions).toEqual([]);
    });
  });

  describe('Context-Aware Filtering', () => {
    it('should not suggest contextFilter if already applied', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        query: 'xyz',
        contextFilter: 'technical',
      });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];
      const hasSuggestedContext = suggestions.some(
        (s: string) => s.includes('context') || s.includes('contextFilter'),
      );

      expect(hasSuggestedContext).toBe(false);
    });

    it('should not suggest stateFilter if already applied', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        query: 'xyz',
        stateFilter: 'analytical',
      });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];
      const hasSuggestedState = suggestions.some(
        (s: string) => s.includes('state') || s.includes('stateFilter'),
      );

      expect(hasSuggestedState).toBe(false);
    });

    it('should not suggest anchorTypeFilter if already applied', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        query: 'xyz',
        anchorTypeFilter: 'decision',
      });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];
      const hasSuggestedAnchor = suggestions.some(
        (s: string) => s.includes('anchor') && s.includes('type'),
      );

      expect(hasSuggestedAnchor).toBe(false);
    });

    it('should not suggest timeRange if already applied', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        query: 'xyz',
        timeRange: {
          start: '2025-01-01T00:00:00Z',
          end: '2025-12-31T23:59:59Z',
        },
      } as any);

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];
      const hasSuggestedTime = suggestions.some(
        (s: string) => s.includes('time') || s.includes('timeRange'),
      );

      expect(hasSuggestedTime).toBe(false);
    });
  });

  describe('Suggestion Examples', () => {
    it('should include brief examples with each suggestion', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'nonexistent' });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];
      const actualSuggestions = suggestions.filter(
        (s: string) => s && !s.includes('No results found'),
      );

      // Each suggestion should include an example (look for quotes or common example patterns)
      actualSuggestions.forEach((suggestion: string) => {
        const hasExample =
          suggestion.includes('"') ||
          suggestion.includes("'") ||
          suggestion.includes('e.g.') ||
          suggestion.includes('like') ||
          suggestion.includes(':');

        expect(hasExample).toBe(true);
      });
    });
  });

  describe('Intelligent Suggestion Priority', () => {
    it('should prioritize unused filter types', async () => {
      const tool = createLoadContextTool();

      // Query with one filter already applied
      const result = await tool.handler({
        query: 'xyz',
        contextFilter: 'technical',
      });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];

      // Should suggest other filter types, not context
      if (suggestions.length > 0) {
        const suggestsOtherFilters = suggestions.some(
          (s: string) =>
            s.includes('anchor') ||
            s.includes('state') ||
            s.includes('broader'),
        );

        expect(suggestsOtherFilters).toBe(true);
      }
    });

    it('should suggest broader terms when all filters are applied', async () => {
      const tool = createLoadContextTool();

      // Query with multiple filters
      const result = await tool.handler({
        query: 'very_specific_term_xyz',
        contextFilter: 'technical',
        stateFilter: 'analytical',
        anchorTypeFilter: 'decision',
      });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];

      // Should suggest broader search terms since filters are exhausted
      if (suggestions.length > 0) {
        const suggestsBroaderTerms = suggestions.some(
          (s: string) =>
            s.includes('broader') ||
            s.includes('general') ||
            s.includes('different'),
        );

        expect(suggestsBroaderTerms).toBe(true);
      }
    });
  });

  describe('Concise Formatting', () => {
    it('should format suggestions concisely without verbosity', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'xyz123' });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];

      // Each suggestion should be concise (not too long)
      suggestions.forEach((suggestion: string) => {
        if (suggestion && !suggestion.includes('No results found')) {
          expect(suggestion.length).toBeLessThan(100); // Reasonable length limit
        }
      });
    });

    it('should use actionable language in suggestions', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'xyz123' });

      expect(result.success).toBe(true);
      const data = result.data as any;

      const suggestions = data.suggestions || [];
      const actualSuggestions = suggestions.filter(
        (s: string) => s && !s.includes('No results found'),
      );

      // Suggestions should start with actionable verbs or clear instructions
      actualSuggestions.forEach((suggestion: string) => {
        const startsWithAction =
          suggestion.startsWith('Try') ||
          suggestion.startsWith('Use') ||
          suggestion.startsWith('Search') ||
          suggestion.startsWith('Filter') ||
          suggestion.startsWith('Remove') ||
          suggestion.includes('instead');

        expect(startsWithAction).toBe(true);
      });
    });
  });
});
