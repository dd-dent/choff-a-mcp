import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { JSONConversationStorage } from '../../src/storage/json-storage.js';
import { EnhancedRetrieval } from '../../src/tools-enhanced.js';
import { CHOFFParser } from '../../src/parser/index.js';
import { SemanticAnchorDetector } from '../../src/anchors/semantic-anchor-detector.js';
import type { ConversationEntry } from '../../src/storage/types.js';

describe('PCHOFF Integration Tests', () => {
  const testStorageDir = './test-pchoff-storage';
  const testStorageFile = path.join(testStorageDir, 'test-conversations.json');
  let storage: JSONConversationStorage;
  let enhancedRetrieval: EnhancedRetrieval;
  const parser = new CHOFFParser();
  const anchorDetector = new SemanticAnchorDetector();

  beforeEach(async () => {
    // Clean up any existing test data
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Directory might not exist
    }

    await fs.mkdir(testStorageDir, { recursive: true });
    storage = new JSONConversationStorage(testStorageFile);
    enhancedRetrieval = new EnhancedRetrieval(storage);
  });

  afterEach(async () => {
    try {
      await fs.rm(testStorageDir, { recursive: true, force: true });
    } catch {
      // Cleanup failed, not critical
    }
  });

  const createTestEntry = (
    content: string,
  ): Omit<ConversationEntry, 'id' | 'timestamp'> => ({
    content,
    choffDocument: parser.parse(content),
    metadata: {
      tokensProcessed: content.length,
      anchorsExtracted: 1,
      anchors: anchorDetector.extract(content),
    },
    summary: content.substring(0, 100),
    tags: ['test'],
  });

  describe('Storage with PCHOFF', () => {
    it('should automatically extract PCHOFF metadata on save', async () => {
      const content = `
        {state:analytical}[context:technical]
        [type:analysis][insight:emergent][level:intermediate]
        &pattern:pchoff_integration@active@
        {source:collective}
        [anchor:test_anchor]
        
        **DECISION:** Implement PCHOFF integration with multi-layer search
        This represents our analysis of integrating PCHOFF classification.
      `;

      const entry = createTestEntry(content);
      const saveResult = await storage.save(entry);
      expect(saveResult.success).toBe(true);

      const loadResult = await storage.load(saveResult.data!);
      expect(loadResult.success).toBe(true);

      const savedEntry = loadResult.data!;
      expect(savedEntry.metadata.pchoff).toBeDefined();
      expect(savedEntry.metadata.pchoff!.types).toEqual(['analysis']);
      expect(savedEntry.metadata.pchoff!.insights).toEqual(['emergent']);
      expect(savedEntry.metadata.pchoff!.levels).toEqual(['intermediate']);
      expect(savedEntry.metadata.pchoff!.patterns).toEqual([
        'pchoff_integration@active',
      ]);
      expect(savedEntry.metadata.pchoff!.sources).toEqual(['collective']);
      expect(savedEntry.metadata.pchoff!.anchorRefs).toEqual(['test_anchor']);
    });

    it('should filter by PCHOFF type', async () => {
      const entries = [
        createTestEntry('[type:observation] Direct observation of behavior'),
        createTestEntry('[type:analysis] Analytical breakdown of patterns'),
        createTestEntry(
          '[type:theory] Theoretical framework for understanding',
        ),
        createTestEntry('No PCHOFF markers here'),
      ];

      for (const entry of entries) {
        await storage.save(entry);
      }

      const searchResult = await storage.search({
        pchoffType: 'analysis',
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.data).toHaveLength(1);
      expect(searchResult.data![0].content).toContain('Analytical breakdown');
    });

    it('should filter by multiple PCHOFF criteria', async () => {
      const entries = [
        createTestEntry(
          '[type:analysis][insight:emergent][level:basic] Basic emergent analysis',
        ),
        createTestEntry(
          '[type:analysis][insight:direct][level:intermediate] Direct analytical insight',
        ),
        createTestEntry(
          '[type:observation][insight:emergent][level:basic] Basic emergent observation',
        ),
        createTestEntry(
          '[type:theory][insight:meta][level:advanced] Advanced meta theory',
        ),
      ];

      for (const entry of entries) {
        await storage.save(entry);
      }

      const searchResult = await storage.search({
        pchoffType: 'analysis',
        pchoffInsight: 'emergent',
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.data).toHaveLength(1);
      expect(searchResult.data![0].content).toContain(
        'Basic emergent analysis',
      );
    });

    it('should handle array filters', async () => {
      const entries = [
        createTestEntry('[type:observation] Observation content'),
        createTestEntry('[type:analysis] Analysis content'),
        createTestEntry('[type:theory] Theory content'),
        createTestEntry('[type:procedure] Procedure content'),
      ];

      for (const entry of entries) {
        await storage.save(entry);
      }

      const searchResult = await storage.search({
        pchoffType: ['observation', 'theory'],
      });

      expect(searchResult.success).toBe(true);
      expect(searchResult.data).toHaveLength(2);

      const contentTexts = searchResult.data!.map((e) => e.content);
      expect(contentTexts.some((c) => c.includes('Observation'))).toBe(true);
      expect(contentTexts.some((c) => c.includes('Theory'))).toBe(true);
    });
  });

  describe('Enhanced Retrieval with PCHOFF', () => {
    beforeEach(async () => {
      // Populate storage with diverse PCHOFF-annotated content
      const testEntries = [
        createTestEntry(`
          [type:analysis][insight:emergent][level:intermediate]
          {state:analytical}[context:technical]
          **BREAKTHROUGH:** Found optimization in search algorithm
          This analysis revealed performance improvements.
        `),
        createTestEntry(`
          [type:observation][insight:direct][level:basic]  
          {state:curious}[context:research]
          **DECISION:** Use PCHOFF for classification
          Direct observation of system behavior patterns.
        `),
        createTestEntry(`
          [type:theory][insight:meta][level:advanced]
          {state:reflective}[context:meta]
          **QUESTION:** How do classification systems evolve?
          Theoretical framework for understanding cognitive architectures.
        `),
        createTestEntry(`
          [type:procedure][insight:practical][level:intermediate]
          {state:methodical}[context:implementation]
          **DECISION:** Implement step-by-step integration process
          Procedural documentation for PCHOFF integration workflow.
        `),
      ];

      for (const entry of testEntries) {
        await storage.save(entry);
      }
    });

    it('should support PCHOFF filtering in enhanced search', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        pchoffType: 'analysis',
        pchoffInsight: 'emergent',
      });

      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0].content).toContain(
        'optimization in search algorithm',
      );
      expect(result.availableFilters?.pchoffTypes).toBeDefined();
      expect(result.availableFilters?.pchoffInsights).toBeDefined();
    });

    it('should include PCHOFF search in multi-layer strategy', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        query: 'theoretical framework',
      });

      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0].content).toContain('Theoretical framework');
      expect(result.searchStrategy).toBe('content_search'); // Found in primary layer
    });

    it('should fallback to PCHOFF search when content search fails', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        query: 'meta recursive',
      });

      // Should find the meta-insight content via PCHOFF search
      expect(result.contexts.length).toBeGreaterThan(0);
      expect(result.searchStrategy).toBe('pchoff_search');
      expect(result.contexts[0].content).toContain('cognitive architectures');
    });

    it('should provide PCHOFF markers in available filters for empty results', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        query: 'nonexistent content that will not match anything',
      });

      expect(result.contexts).toHaveLength(0);
      expect(result.availableFilters).toBeDefined();
      expect(result.availableFilters!.pchoffTypes).toContain('analysis');
      expect(result.availableFilters!.pchoffTypes).toContain('observation');
      expect(result.availableFilters!.pchoffInsights).toContain('emergent');
      expect(result.availableFilters!.pchoffInsights).toContain('direct');
    });

    it('should combine PCHOFF and CHOFF filters', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        contextFilter: 'technical',
        pchoffType: 'analysis',
        anchorTypeFilter: 'breakthrough',
      });

      expect(result.contexts).toHaveLength(1);
      expect(result.contexts[0].content).toContain(
        'optimization in search algorithm',
      );
    });

    it('should handle complex PCHOFF queries', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        pchoffType: ['analysis', 'theory'],
        pchoffLevel: ['intermediate', 'advanced'],
        query: 'framework',
      });

      expect(result.contexts.length).toBeGreaterThan(0);
      // Should match either the analysis (intermediate) or theory (advanced) content
      const hasAnalysis = result.contexts.some((c) =>
        c.content?.includes('optimization'),
      );
      const hasTheory = result.contexts.some((c) =>
        c.content?.includes('Theoretical framework'),
      );
      expect(hasAnalysis || hasTheory).toBe(true);
    });

    it('should provide tool suggestions based on PCHOFF results', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        pchoffType: 'analysis',
      });

      expect(result.toolSuggestions).toBeDefined();
      expect(result.toolSuggestions!.length).toBeGreaterThan(0);

      // Should suggest getAnchors for breakthrough content
      const hasAnchorSuggestion = result.toolSuggestions!.some(
        (s) => s.tool === 'getAnchors' && s.args.type === 'breakthrough',
      );
      expect(hasAnchorSuggestion).toBe(true);
    });
  });

  describe('PCHOFF Search Algorithm', () => {
    beforeEach(async () => {
      const testEntries = [
        createTestEntry(
          `[type:observation] Making direct observations about system behavior`,
        ),
        createTestEntry(
          `[insight:emergent] Pattern is emerging from multiple data points`,
        ),
        createTestEntry(
          `[level:experimental] Testing new theoretical approaches`,
        ),
        createTestEntry(
          `&pattern:pchoff_testing@active@ Running classification experiments`,
        ),
        createTestEntry(
          `{source:collective} Knowledge derived from team collaboration`,
        ),
      ];

      for (const entry of testEntries) {
        await storage.save(entry);
      }
    });

    it('should match by direct PCHOFF keyword mapping', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        query: 'observation documented',
      });

      expect(result.contexts.length).toBeGreaterThan(0);
      expect(result.searchStrategy).toBe('pchoff_search');
      expect(result.contexts[0].content).toContain('direct observations');
    });

    it('should match by semantic keyword mapping', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        query: 'pattern discovered',
      });

      expect(result.contexts.length).toBeGreaterThan(0);
      expect(result.searchStrategy).toBe('pchoff_search');
      expect(result.contexts[0].content).toContain('Pattern is emerging');
    });

    it('should match experimental content by keyword', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        query: 'prototype exploration',
      });

      expect(result.contexts.length).toBeGreaterThan(0);
      expect(result.searchStrategy).toBe('pchoff_search');
      expect(result.contexts[0].content).toContain(
        'Testing new theoretical approaches',
      );
    });

    it('should provide related searches based on PCHOFF', async () => {
      const result = await enhancedRetrieval.searchWithFallbacks({
        pchoffType: 'observation',
      });

      expect(result.relatedSearches).toBeDefined();
      expect(result.relatedSearches!.length).toBeGreaterThan(0);
    });
  });
});
