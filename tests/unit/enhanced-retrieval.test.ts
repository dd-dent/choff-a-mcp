import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  createLoadContextTool,
  configureStorage,
  resetStorage,
} from '../../src/tools.js';
import { JSONConversationStorage } from '../../src/storage/json-storage.js';
import { SemanticAnchorDetector } from '../../src/anchors/semantic-anchor-detector.js';
import { CHOFFParser } from '../../src/parser/index.js';
import * as fs from 'fs/promises';
import * as path from 'path';
import * as os from 'os';

describe('Enhanced Retrieval for loadContext', () => {
  let tempDir: string;
  let storagePath: string;
  let storage: JSONConversationStorage;

  beforeEach(async () => {
    // Create temp directory
    tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'choff-test-'));
    storagePath = path.join(tempDir, 'test-conversations.json');

    // Configure storage with temp path
    configureStorage({ storagePath });
    storage = new JSONConversationStorage(storagePath);

    // Create test data with various content types
    const parser = new CHOFFParser();
    const detector = new SemanticAnchorDetector();

    // Conversation 1: Technical with decision anchor
    const content1 = `{state:analytical}[context:technical]
**DECISION:** We decided to use TypeScript for type safety.
This provides better developer experience and catches errors early.`;

    const choffDoc1 = parser.parse(content1);
    const anchors1 = detector.extract(content1);

    await storage.save({
      content: content1,
      choffDocument: choffDoc1,
      summary: 'TypeScript decision',
      tags: ['context:technical', 'anchor:decision'],
      metadata: {
        tokensProcessed: 20,
        anchorsExtracted: anchors1.length,
        checkpointId: 'chk_001',
        anchors: anchors1,
      },
    });

    // Conversation 2: Research with breakthrough
    const content2 = `{state:curious}[context:research]
After extensive testing, we made a **BREAKTHROUGH:** The parser 
can handle recursive structures efficiently using a stack-based approach.
&pattern:discovery|active|`;

    const choffDoc2 = parser.parse(content2);
    const anchors2 = detector.extract(content2);

    await storage.save({
      content: content2,
      choffDocument: choffDoc2,
      summary: 'Parser breakthrough',
      tags: ['context:research', 'anchor:breakthrough'],
      metadata: {
        tokensProcessed: 25,
        anchorsExtracted: anchors2.length,
        checkpointId: 'chk_002',
        anchors: anchors2,
      },
    });

    // Conversation 3: Planning with question
    const content3 = `{state:planning}[context:architecture]
We need to figure out the storage layer design.
**QUESTION:** Should we use JSON files or SQLite for local storage?
Consider performance and simplicity trade-offs.`;

    const choffDoc3 = parser.parse(content3);
    const anchors3 = detector.extract(content3);

    await storage.save({
      content: content3,
      choffDocument: choffDoc3,
      summary: 'Storage design question',
      tags: ['context:architecture', 'anchor:question'],
      metadata: {
        tokensProcessed: 30,
        anchorsExtracted: anchors3.length,
        checkpointId: 'chk_003',
        anchors: anchors3,
      },
    });
  });

  afterEach(async () => {
    resetStorage();
    // Clean up temp directory
    await fs.rm(tempDir, { recursive: true, force: true });
  });

  describe('Multi-layer retrieval strategy', () => {
    it('should find content using primary text search', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'typescript safety' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as any;
      expect(data.contexts).toHaveLength(1);
      expect(data.contexts[0].content).toContain('TypeScript');
    });

    it('should fall back to anchor search when content search fails', async () => {
      const tool = createLoadContextTool();
      // Search for something not in content but in anchor type
      const result = await tool.handler({ query: 'important decisions made' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as any;

      // Should find conversations with decision anchors
      expect(data.contexts.length).toBeGreaterThan(0);
      expect(data.fallbackStrategy).toBe('anchor_search');
    });

    it('should use CHOFF state matching as third fallback', async () => {
      const tool = createLoadContextTool();
      // Search for cognitive state
      const result = await tool.handler({ query: 'analytical thinking' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as any;

      // Should find conversations with analytical state
      expect(data.contexts.length).toBeGreaterThan(0);
      expect(data.fallbackStrategy).toBe('state_matching');
    });

    it('should return helpful suggestions when no results found', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        query: 'nonexistent quantum physics',
      });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as any;

      expect(data.contexts).toHaveLength(0);
      expect(data.suggestions).toBeDefined();
      expect(data.suggestions).toContain(
        '- Try searching for anchor types: decision, breakthrough, question, blocker',
      );
      expect(data.availableContexts).toContain('technical');
      expect(data.availableStates).toContain('analytical');
    });

    it('should include tool invocation suggestions in response', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'breakthrough' });

      expect(result.success).toBe(true);
      expect(result.data).toBeDefined();
      const data = result.data as any;

      expect(data.toolSuggestions).toBeDefined();
      expect(data.toolSuggestions.length).toBeGreaterThan(0);
      expect(data.toolSuggestions[0]).toHaveProperty('tool', 'getAnchors');
      expect(data.toolSuggestions[0]).toHaveProperty('args');
      expect(data.toolSuggestions[0]).toHaveProperty('reason');
    });
  });

  describe('Enhanced filtering options', () => {
    it('should filter by CHOFF context', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        contextFilter: 'technical',
      });

      if (!result.success) {
        console.error('Error:', result.error);
      }

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.contexts).toHaveLength(1);
      expect(data.contexts[0].tags).toContain('context:technical');
    });

    it('should filter by multiple contexts with OR logic', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        contextFilter: ['technical', 'research'],
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.contexts).toHaveLength(2);
    });

    it('should filter by anchor type', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        anchorTypeFilter: 'question',
      });

      expect(result.success).toBe(true);
      const data = result.data as any;

      // The filter should return all conversations with question anchors
      expect(data.contexts.length).toBeGreaterThan(0);

      // At least one should have "question" in the summary
      const questionContexts = data.contexts.filter((ctx: any) =>
        ctx.summary?.includes('question'),
      );
      expect(questionContexts.length).toBeGreaterThan(0);

      // All returned contexts should have question anchors
      data.contexts.forEach((ctx: any) => {
        expect(
          ctx.metadata.anchors.some((a: any) => a.type === 'question'),
        ).toBe(true);
      });
    });

    it('should combine multiple filters', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({
        query: 'design',
        contextFilter: 'architecture',
        anchorTypeFilter: 'question',
      });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.contexts).toHaveLength(1);
      expect(data.contexts[0].content).toContain('storage layer design');
    });
  });

  describe('Result enrichment', () => {
    it('should include search strategy used', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'typescript' });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.searchStrategy).toBe('content_search');
      expect(data.searchMetrics).toBeDefined();
      expect(data.searchMetrics.candidatesEvaluated).toBeGreaterThan(0);
    });

    it('should include available filters in empty results', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'xyz123' });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.availableFilters).toBeDefined();
      expect(data.availableFilters.contexts).toContain('technical');
      expect(data.availableFilters.anchorTypes).toContain('decision');
      expect(data.availableFilters.states).toContain('analytical');
    });

    it('should suggest related searches', async () => {
      const tool = createLoadContextTool();
      const result = await tool.handler({ query: 'parser' });

      expect(result.success).toBe(true);
      const data = result.data as any;
      expect(data.relatedSearches).toBeDefined();
      expect(data.relatedSearches.length).toBeGreaterThan(0);
      // Related searches should include terms from the found content
      expect(
        data.relatedSearches.some(
          (search: string) =>
            search.includes('recursive') ||
            search.includes('breakthrough') ||
            search.includes('research'),
        ),
      ).toBe(true);
    });
  });
});
