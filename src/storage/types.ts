import { CHOFFDocument } from '../parser/types.js';

// Core conversation entry stored in JSON
export interface ConversationEntry {
  id: string;
  timestamp: Date;
  content: string;
  choffDocument: CHOFFDocument;
  metadata: {
    tokensProcessed: number;
    anchorsExtracted: number;
    checkpointId?: string;
    projectId?: string; // For future multi-tenancy
    userId?: string; // For future multi-tenancy
  };
  summary?: string;
  tags?: string[];
}

// Search and filter criteria
export interface SearchCriteria {
  query?: string;
  timeRange?: {
    start: Date;
    end: Date;
  };
  contexts?: string[]; // Filter by CHOFF contexts
  states?: string[]; // Filter by CHOFF states
  anchorTypes?: Array<'decision' | 'blocker' | 'breakthrough' | 'question'>;
  limit?: number;
  offset?: number;
}

// Storage operation results
export interface StorageResult<T> {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: unknown;
  };
}

// Storage statistics
export interface StorageStats {
  totalEntries: number;
  totalSize: number; // in bytes
  oldestEntry?: Date;
  newestEntry?: Date;
  averageTokensPerEntry: number;
  totalAnchors: number;
  backupCount: number;
  lastBackup?: Date;
}

// Backup configuration
export interface BackupConfig {
  enabled: boolean;
  maxBackups: number;
  rotationSizeLimit: number; // in bytes (default 10MB)
  dailyBackup: boolean;
}

// Main storage interface
export interface ConversationStorage {
  // Core operations
  save(
    entry: Omit<ConversationEntry, 'id' | 'timestamp'>,
  ): Promise<StorageResult<string>>; // returns ID
  load(id: string): Promise<StorageResult<ConversationEntry>>;
  search(criteria: SearchCriteria): Promise<StorageResult<ConversationEntry[]>>;
  delete(id: string): Promise<StorageResult<void>>;

  // Bulk operations
  loadAll(): Promise<StorageResult<ConversationEntry[]>>;
  clear(): Promise<StorageResult<void>>;

  // Storage management
  getStats(): Promise<StorageResult<StorageStats>>;
  createBackup(): Promise<StorageResult<string>>; // returns backup filename
  restoreFromBackup(backupPath: string): Promise<StorageResult<void>>;

  // Cleanup operations
  vacuum(): Promise<StorageResult<void>>; // Remove deleted entries, compact file
  rotate(): Promise<StorageResult<void>>; // Rotate if file too large
}

// Internal storage format (what's actually saved to JSON)
export interface StorageDocument {
  version: string;
  created: Date;
  lastModified: Date;
  entries: ConversationEntry[];
  deletedEntries: string[]; // Soft delete for recovery
  metadata: {
    totalWrites: number;
    lastVacuum?: Date;
    lastRotation?: Date;
  };
}
