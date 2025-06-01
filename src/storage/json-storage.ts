import { promises as fs } from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import {
  ConversationStorage,
  ConversationEntry,
  SearchCriteria,
  StorageResult,
  StorageStats,
  StorageDocument,
  BackupConfig,
} from './types.js';

export class JSONConversationStorage implements ConversationStorage {
  private filePath: string;
  private lockFile: string;
  private backupConfig: BackupConfig;

  constructor(filePath: string, backupConfig?: Partial<BackupConfig>) {
    this.filePath = filePath;
    this.lockFile = `${filePath}.lock`;
    this.backupConfig = {
      enabled: true,
      maxBackups: 10,
      rotationSizeLimit: 10 * 1024 * 1024, // 10MB
      dailyBackup: true,
      ...backupConfig,
    };
  }

  async save(
    entry: Omit<ConversationEntry, 'id' | 'timestamp'>,
  ): Promise<StorageResult<string>> {
    try {
      // Generate unique ID
      const id = `conv_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const timestamp = new Date();

      const fullEntry: ConversationEntry = {
        id,
        timestamp,
        ...entry,
      };

      await this.withFileLock(async () => {
        const document = await this.loadDocument();
        document.entries.push(fullEntry);
        document.lastModified = new Date();
        document.metadata.totalWrites++;
        await this.saveDocument(document);
      });

      return {
        success: true,
        data: id,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SAVE_ERROR',
          message: `Failed to save entry: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async load(id: string): Promise<StorageResult<ConversationEntry>> {
    try {
      const document = await this.loadDocument();
      const entry = document.entries.find((e) => e.id === id);

      if (!entry) {
        return {
          success: false,
          error: {
            code: 'NOT_FOUND',
            message: `Entry with ID ${id} not found`,
          },
        };
      }

      return {
        success: true,
        data: entry,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'LOAD_ERROR',
          message: `Failed to load entry: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async search(
    criteria: SearchCriteria,
  ): Promise<StorageResult<ConversationEntry[]>> {
    try {
      const document = await this.loadDocument();
      let results = [...document.entries];

      // Apply filters
      if (criteria.timeRange) {
        results = results.filter((entry) => {
          const entryDate = new Date(entry.timestamp);
          return (
            entryDate >= criteria.timeRange!.start &&
            entryDate <= criteria.timeRange!.end
          );
        });
      }

      if (criteria.contexts && criteria.contexts.length > 0) {
        results = results.filter((entry) => {
          const entryContexts = entry.choffDocument.contexts.map(
            (c) => c.value,
          );
          return criteria.contexts!.some((ctx) => entryContexts.includes(ctx));
        });
      }

      if (criteria.states && criteria.states.length > 0) {
        results = results.filter((entry) => {
          const entryStates = entry.choffDocument.states
            .filter((s) => s.type === 'simple')
            .map((s) => s.value);
          return criteria.states!.some((state) => entryStates.includes(state));
        });
      }

      if (criteria.query) {
        const query = criteria.query.toLowerCase();
        const queryWords = query.split(/\s+/).filter((word) => word.length > 0);
        results = results.filter((entry) => {
          const lowerContent = entry.content.toLowerCase();
          const lowerSummary = entry.summary?.toLowerCase() || '';
          const searchText = lowerContent + ' ' + lowerSummary;

          // Check if all query words are present
          return queryWords.every((word) => searchText.includes(word));
        });
      }

      // Sort by timestamp (newest first)
      results.sort(
        (a, b) =>
          new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
      );

      // Apply pagination
      if (criteria.offset) {
        results = results.slice(criteria.offset);
      }
      if (criteria.limit) {
        results = results.slice(0, criteria.limit);
      }

      return {
        success: true,
        data: results,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'SEARCH_ERROR',
          message: `Failed to search entries: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async delete(id: string): Promise<StorageResult<void>> {
    try {
      await this.withFileLock(async () => {
        const document = await this.loadDocument();
        const entryIndex = document.entries.findIndex((e) => e.id === id);

        if (entryIndex === -1) {
          throw new Error(`Entry with ID ${id} not found`);
        }

        // Soft delete - move to deleted entries for potential recovery
        document.deletedEntries.push(id);
        document.entries.splice(entryIndex, 1);
        document.lastModified = new Date();

        await this.saveDocument(document);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'DELETE_ERROR',
          message: `Failed to delete entry: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async loadAll(): Promise<StorageResult<ConversationEntry[]>> {
    try {
      const document = await this.loadDocument();
      return {
        success: true,
        data: document.entries,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'LOAD_ALL_ERROR',
          message: `Failed to load all entries: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async clear(): Promise<StorageResult<void>> {
    try {
      await this.withFileLock(async () => {
        const document = await this.loadDocument();
        document.entries = [];
        document.deletedEntries = [];
        document.lastModified = new Date();
        await this.saveDocument(document);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'CLEAR_ERROR',
          message: `Failed to clear storage: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async getStats(): Promise<StorageResult<StorageStats>> {
    try {
      const document = await this.loadDocument();
      const entries = document.entries;

      if (entries.length === 0) {
        return {
          success: true,
          data: {
            totalEntries: 0,
            totalSize: 0,
            averageTokensPerEntry: 0,
            totalAnchors: 0,
            backupCount: 0,
          },
        };
      }

      const timestamps = entries.map((e) => new Date(e.timestamp));
      const totalTokens = entries.reduce(
        (sum, e) => sum + e.metadata.tokensProcessed,
        0,
      );
      const totalAnchors = entries.reduce(
        (sum, e) => sum + e.metadata.anchorsExtracted,
        0,
      );

      // Get file size
      let totalSize = 0;
      try {
        const stats = await fs.stat(this.filePath);
        totalSize = stats.size;
      } catch {
        // File might not exist yet
      }

      // Count backups
      const backupCount = await this.countBackups();

      return {
        success: true,
        data: {
          totalEntries: entries.length,
          totalSize,
          oldestEntry: new Date(
            Math.min(...timestamps.map((t) => t.getTime())),
          ),
          newestEntry: new Date(
            Math.max(...timestamps.map((t) => t.getTime())),
          ),
          averageTokensPerEntry: totalTokens / entries.length,
          totalAnchors,
          backupCount,
        },
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'STATS_ERROR',
          message: `Failed to get stats: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async createBackup(): Promise<StorageResult<string>> {
    try {
      const now = new Date();
      const dateStr = now.toISOString().slice(0, 10); // YYYY-MM-DD
      const timeStr = now.toISOString().slice(11, 19).replace(/:/g, ''); // HHMMSS
      const backupFileName = `conversations-backup-${dateStr}-${timeStr}.json`;
      const backupPath = path.join(path.dirname(this.filePath), backupFileName);

      // Copy current file to backup
      try {
        await fs.copyFile(this.filePath, backupPath);
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
          // Source file doesn't exist, create empty backup
          const emptyDocument = this.createEmptyDocument();
          await fs.writeFile(
            backupPath,
            JSON.stringify(emptyDocument, null, 2),
          );
        } else {
          throw error;
        }
      }

      // Cleanup old backups if needed
      if (this.backupConfig.maxBackups > 0) {
        await this.cleanupOldBackups();
      }

      return {
        success: true,
        data: backupFileName,
      };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'BACKUP_ERROR',
          message: `Failed to create backup: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async restoreFromBackup(backupPath: string): Promise<StorageResult<void>> {
    try {
      // Validate backup file
      const backupContent = await fs.readFile(backupPath, 'utf-8');
      const backupDocument = JSON.parse(backupContent) as StorageDocument;

      // Basic validation
      if (!backupDocument.entries || !Array.isArray(backupDocument.entries)) {
        throw new Error('Invalid backup format');
      }

      // Restore backup
      await this.withFileLock(async () => {
        await fs.copyFile(backupPath, this.filePath);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'RESTORE_ERROR',
          message: `Failed to restore from backup: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async vacuum(): Promise<StorageResult<void>> {
    try {
      await this.withFileLock(async () => {
        const document = await this.loadDocument();

        // Clear deleted entries list (permanent deletion)
        document.deletedEntries = [];
        document.metadata.lastVacuum = new Date();
        document.lastModified = new Date();

        await this.saveDocument(document);
      });

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'VACUUM_ERROR',
          message: `Failed to vacuum storage: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  async rotate(): Promise<StorageResult<void>> {
    try {
      // Check if rotation is needed
      let needsRotation = false;
      try {
        const stats = await fs.stat(this.filePath);
        needsRotation = stats.size > this.backupConfig.rotationSizeLimit;
      } catch {
        // File doesn't exist, no rotation needed
        return { success: true };
      }

      if (needsRotation) {
        // Create backup before rotation
        await this.createBackup();

        // For now, just mark as rotated (could implement more sophisticated rotation)
        await this.withFileLock(async () => {
          const document = await this.loadDocument();
          document.metadata.lastRotation = new Date();
          await this.saveDocument(document);
        });
      }

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: {
          code: 'ROTATION_ERROR',
          message: `Failed to rotate storage: ${error instanceof Error ? error.message : String(error)}`,
          details: error,
        },
      };
    }
  }

  // Private helper methods
  private async loadDocument(): Promise<StorageDocument> {
    try {
      const content = await fs.readFile(this.filePath, 'utf-8');
      const doc = JSON.parse(content) as StorageDocument;

      // Ensure entries array exists
      if (!doc.entries) {
        doc.entries = [];
      }
      if (!doc.deletedEntries) {
        doc.deletedEntries = [];
      }

      return doc;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        // File doesn't exist, create new document
        return this.createEmptyDocument();
      }
      throw error;
    }
  }

  private createEmptyDocument(): StorageDocument {
    return {
      version: '1.0.0',
      created: new Date(),
      lastModified: new Date(),
      entries: [],
      deletedEntries: [],
      metadata: {
        totalWrites: 0,
      },
    };
  }

  private async saveDocument(document: StorageDocument): Promise<void> {
    // Ensure directory exists
    await fs.mkdir(path.dirname(this.filePath), { recursive: true });

    // Atomic write: write to temp file, then rename
    const tempFile = `${this.filePath}.tmp`;
    await fs.writeFile(tempFile, JSON.stringify(document, null, 2));
    await fs.rename(tempFile, this.filePath);
  }

  private async withFileLock<T>(operation: () => Promise<T>): Promise<T> {
    // Simple file-based locking for concurrent write protection
    const maxRetries = 10;
    const retryDelay = 50; // ms

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      try {
        // Try to create lock file
        await fs.writeFile(this.lockFile, process.pid.toString(), {
          flag: 'wx',
        });

        try {
          const result = await operation();
          return result;
        } finally {
          // Always remove lock file
          try {
            await fs.unlink(this.lockFile);
          } catch {
            // Ignore errors removing lock file
          }
        }
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
          // Lock file exists, wait and retry
          await new Promise((resolve) => setTimeout(resolve, retryDelay));
          continue;
        }
        throw error;
      }
    }

    throw new Error('Could not acquire file lock after maximum retries');
  }

  private async countBackups(): Promise<number> {
    try {
      const dir = path.dirname(this.filePath);
      const files = await fs.readdir(dir);
      return files.filter((f) => f.startsWith('conversations-backup-')).length;
    } catch {
      return 0;
    }
  }

  private async cleanupOldBackups(): Promise<void> {
    try {
      const dir = path.dirname(this.filePath);
      const files = await fs.readdir(dir);
      const backupFiles = files
        .filter((f) => f.startsWith('conversations-backup-'))
        .map((f) => path.join(dir, f));

      if (backupFiles.length > this.backupConfig.maxBackups) {
        // Get file stats and sort by creation time
        const fileStats = await Promise.all(
          backupFiles.map(async (f) => ({
            path: f,
            stats: await fs.stat(f),
          })),
        );

        fileStats.sort(
          (a, b) => a.stats.mtime.getTime() - b.stats.mtime.getTime(),
        );

        // Remove oldest files
        const filesToRemove = fileStats.slice(
          0,
          fileStats.length - this.backupConfig.maxBackups,
        );
        await Promise.all(filesToRemove.map((f) => fs.unlink(f.path)));
      }
    } catch {
      // Ignore cleanup errors
    }
  }
}
