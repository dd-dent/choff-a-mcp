import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { promises as fs } from 'fs';
import * as path from 'path';
import { SearchCriteria } from '../../src/storage/types.js';
import { CHOFFDocument } from '../../src/parser/types.js';
import { JSONConversationStorage } from '../../src/storage/json-storage.js';

describe('JSONConversationStorage', () => {
  let storage: JSONConversationStorage;
  let testDir: string;
  let storageFile: string;

  beforeEach(async () => {
    // Create temporary directory for testing
    testDir = path.join(process.cwd(), 'test-storage');
    storageFile = path.join(testDir, 'conversations.json');

    try {
      await fs.mkdir(testDir, { recursive: true });
    } catch {
      // Directory might already exist
    }

    storage = new JSONConversationStorage(storageFile);
  });

  afterEach(async () => {
    // Cleanup test directory
    try {
      await fs.rm(testDir, { recursive: true, force: true });
    } catch {
      // Cleanup might fail, that's ok
    }
  });

  describe('Basic Operations', () => {
    it('should save conversation entry with CHOFF metadata', async () => {
      const mockCHOFFDoc: CHOFFDocument = {
        text: '{state:analytical} Testing storage [context:test]',
        states: [
          {
            type: 'simple',
            value: 'analytical',
            position: { start: 0, end: 18 },
            raw: '{state:analytical}',
          },
        ],
        contexts: [
          {
            value: 'test',
            position: { start: 36, end: 50 },
            raw: '[context:test]',
          },
        ],
        patterns: [],
        directionals: [],
        branches: [],
        socialLayers: [],
        errors: [],
        parseTime: 1.5,
        statistics: {
          totalMarkers: 2,
          markerDensity: 4.2,
          dominantStateType: 'simple',
          branchComplexity: 0,
        },
      };

      const entry = {
        content: '{state:analytical} Testing storage [context:test]',
        choffDocument: mockCHOFFDoc,
        metadata: {
          tokensProcessed: 5,
          anchorsExtracted: 2,
          checkpointId: 'chk_test_123',
        },
      };

      const result = await storage.save(entry);

      expect(result.success).toBe(true);
      expect(result.data).toMatch(/^conv_\d+_[a-z0-9]+$/); // ID format
    });

    it('should load conversation entry by ID', async () => {
      const mockCHOFFDoc: CHOFFDocument = {
        text: 'Test content',
        states: [],
        contexts: [],
        patterns: [],
        directionals: [],
        branches: [],
        socialLayers: [],
        errors: [],
        parseTime: 1.0,
        statistics: { totalMarkers: 0, markerDensity: 0, branchComplexity: 0 },
      };

      const entry = {
        content: 'Test content',
        choffDocument: mockCHOFFDoc,
        metadata: { tokensProcessed: 2, anchorsExtracted: 0 },
      };

      const saveResult = await storage.save(entry);
      expect(saveResult.success).toBe(true);

      const loadResult = await storage.load(saveResult.data!);
      expect(loadResult.success).toBe(true);
      expect(loadResult.data?.content).toBe('Test content');
      expect(loadResult.data?.choffDocument.text).toBe('Test content');
    });

    it('should return error for non-existent ID', async () => {
      const result = await storage.load('non_existent_id');

      expect(result.success).toBe(false);
      expect(result.error?.code).toBe('NOT_FOUND');
    });
  });

  describe('Search Operations', () => {
    beforeEach(async () => {
      // Setup test data
      const entries = [
        {
          content: '{state:analytical} Working on database [context:technical]',
          choffDocument: createMockCHOFFDoc('analytical', ['technical']),
          metadata: { tokensProcessed: 5, anchorsExtracted: 1 },
        },
        {
          content: '{state:creative} Brainstorming ideas [context:design]',
          choffDocument: createMockCHOFFDoc('creative', ['design']),
          metadata: { tokensProcessed: 4, anchorsExtracted: 1 },
        },
        {
          content: '{state:decisive} Made final choice [context:architecture]',
          choffDocument: createMockCHOFFDoc('decisive', ['architecture']),
          metadata: { tokensProcessed: 4, anchorsExtracted: 1 },
        },
      ];

      for (const entry of entries) {
        await storage.save(entry);
      }

      // Add small delay to ensure different timestamps
      await new Promise((resolve) => setTimeout(resolve, 10));
    });

    it('should search by date range', async () => {
      const now = new Date();
      const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);

      const criteria: SearchCriteria = {
        timeRange: {
          start: oneHourAgo,
          end: now,
        },
      };

      const result = await storage.search(criteria);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(3);
    });

    it('should filter by CHOFF context', async () => {
      const criteria: SearchCriteria = {
        contexts: ['technical'],
      };

      const result = await storage.search(criteria);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].content).toContain('database');
    });

    it('should filter by CHOFF states', async () => {
      const criteria: SearchCriteria = {
        states: ['decisive'],
      };

      const result = await storage.search(criteria);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(1);
      expect(result.data?.[0].content).toContain('final choice');
    });

    it('should limit search results', async () => {
      const criteria: SearchCriteria = {
        limit: 2,
      };

      const result = await storage.search(criteria);
      expect(result.success).toBe(true);
      expect(result.data?.length).toBe(2);
    });
  });

  describe('Concurrent Operations', () => {
    it('should handle concurrent writes safely', async () => {
      const entry1 = {
        content: 'Concurrent write 1',
        choffDocument: createMockCHOFFDoc('analytical', []),
        metadata: { tokensProcessed: 3, anchorsExtracted: 0 },
      };

      const entry2 = {
        content: 'Concurrent write 2',
        choffDocument: createMockCHOFFDoc('creative', []),
        metadata: { tokensProcessed: 3, anchorsExtracted: 0 },
      };

      const entry3 = {
        content: 'Concurrent write 3',
        choffDocument: createMockCHOFFDoc('focused', []),
        metadata: { tokensProcessed: 3, anchorsExtracted: 0 },
      };

      // Execute concurrent saves
      const results = await Promise.all([
        storage.save(entry1),
        storage.save(entry2),
        storage.save(entry3),
      ]);

      // All should succeed
      results.forEach((result) => {
        expect(result.success).toBe(true);
        expect(result.data).toBeDefined();
      });

      // All entries should be saved
      const allEntries = await storage.loadAll();
      expect(allEntries.success).toBe(true);
      expect(allEntries.data?.length).toBe(3);
    });
  });

  describe('Backup Operations', () => {
    it('should create backup successfully', async () => {
      // Add some data first
      const entry = {
        content: 'Test backup content',
        choffDocument: createMockCHOFFDoc('analytical', []),
        metadata: { tokensProcessed: 3, anchorsExtracted: 0 },
      };
      await storage.save(entry);

      const result = await storage.createBackup();
      expect(result.success).toBe(true);
      expect(result.data).toMatch(
        /conversations-backup-\d{4}-\d{2}-\d{2}-\d{6}\.json$/,
      );

      // Backup file should exist
      const backupPath = path.join(testDir, result.data!);
      const backupExists = await fs
        .access(backupPath)
        .then(() => true)
        .catch(() => false);
      expect(backupExists).toBe(true);
    });

    it('should restore from backup', async () => {
      // Create and save entry
      const entry = {
        content: 'Original content',
        choffDocument: createMockCHOFFDoc('analytical', []),
        metadata: { tokensProcessed: 2, anchorsExtracted: 0 },
      };
      await storage.save(entry);

      // Create backup
      const backupResult = await storage.createBackup();
      expect(backupResult.success).toBe(true);

      // Clear storage
      await storage.clear();
      const emptyCheck = await storage.loadAll();
      expect(emptyCheck.data?.length).toBe(0);

      // Restore from backup
      const backupPath = path.join(testDir, backupResult.data!);
      const restoreResult = await storage.restoreFromBackup(backupPath);
      expect(restoreResult.success).toBe(true);

      // Verify restore worked
      const restoredEntries = await storage.loadAll();
      expect(restoredEntries.data?.length).toBe(1);
      expect(restoredEntries.data?.[0].content).toBe('Original content');
    });
  });

  describe('Storage Management', () => {
    it('should provide storage statistics', async () => {
      // Add test data
      const entries = [
        {
          content: 'Entry 1',
          choffDocument: createMockCHOFFDoc('analytical', []),
          metadata: { tokensProcessed: 2, anchorsExtracted: 1 },
        },
        {
          content: 'Entry 2',
          choffDocument: createMockCHOFFDoc('creative', []),
          metadata: { tokensProcessed: 3, anchorsExtracted: 2 },
        },
      ];

      for (const entry of entries) {
        await storage.save(entry);
      }

      const statsResult = await storage.getStats();
      expect(statsResult.success).toBe(true);
      expect(statsResult.data?.totalEntries).toBe(2);
      expect(statsResult.data?.averageTokensPerEntry).toBe(2.5);
      expect(statsResult.data?.totalAnchors).toBe(3);
    });

    it('should handle file rotation when size limit exceeded', async () => {
      // This would require a more complex test with actual file size checking
      // For now, just test that rotate() runs without error
      const rotateResult = await storage.rotate();
      expect(rotateResult.success).toBe(true);
    });
  });
});

// Helper function to create mock CHOFF documents
function createMockCHOFFDoc(state: string, contexts: string[]): CHOFFDocument {
  return {
    text: `{state:${state}} ${contexts.map((c) => `[context:${c}]`).join(' ')}`,
    states: [
      {
        type: 'simple',
        value: state,
        position: { start: 0, end: state.length + 8 },
        raw: `{state:${state}}`,
      },
    ],
    contexts: contexts.map((ctx, i) => ({
      value: ctx,
      position: { start: i * 20, end: i * 20 + ctx.length + 10 },
      raw: `[context:${ctx}]`,
    })),
    patterns: [],
    directionals: [],
    branches: [],
    socialLayers: [],
    errors: [],
    parseTime: 1.0,
    statistics: {
      totalMarkers: 1 + contexts.length,
      markerDensity: 5.0,
      dominantStateType: 'simple',
      branchComplexity: 0,
    },
  };
}
