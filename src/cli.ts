#!/usr/bin/env node

import { program } from 'commander';
import { JSONConversationStorage } from './storage/index.js';
import { EnhancedRetrieval } from './tools-enhanced.js';
import type { ConversationEntry } from './storage/types.js';
import type { SemanticAnchor } from './anchors/types.js';
import type { EnhancedLoadContextResponse } from './tools-enhanced.js';
import { writeFileSync } from 'fs';
import { resolve } from 'path';

/**
 * CLI interface for CHOFF-A-MCP enhanced retrieval system
 * Leverages existing sophisticated search instead of rebuilding it
 */

// CLI Option interfaces for type safety
interface SearchOptions {
  context?: string[];
  state?: string[];
  anchor?: string;
  pchoffType?: string[];
  pchoffInsight?: string[];
  limit: string;
  json?: boolean;
  verbose?: boolean;
}

interface ExportOptions {
  id?: string;
  query?: string;
  format: string;
  output?: string;
}

interface AnchorWithMetadata extends SemanticAnchor {
  conversationId: string;
  conversationDate: Date;
}

const DEFAULT_STORAGE_PATH = resolve(process.cwd(), 'conversations');

// Initialize services
const storage = new JSONConversationStorage(DEFAULT_STORAGE_PATH);
const retrieval = new EnhancedRetrieval(storage);

program
  .name('choff')
  .description('CHOFF-A-MCP CLI - Query your memory with quantum velocity')
  .version('1.0.0');

// Search command - leverage enhanced retrieval
program
  .command('search')
  .description('Search conversations using enhanced multi-layer retrieval')
  .argument('<query>', 'Search query')
  .option('-c, --context <contexts...>', 'Filter by CHOFF contexts')
  .option('-s, --state <states...>', 'Filter by CHOFF states')
  .option(
    '-a, --anchor <type>',
    'Filter by anchor type (decision|breakthrough|blocker|question)',
  )
  .option('-t, --pchoff-type <types...>', 'Filter by PCHOFF types')
  .option('-i, --pchoff-insight <insights...>', 'Filter by PCHOFF insights')
  .option('-l, --limit <number>', 'Maximum results', '10')
  .option('--json', 'Output raw JSON')
  .option('--verbose', 'Show search strategy and metrics')
  .action(async (query: string, options: SearchOptions) => {
    try {
      const args = {
        query,
        contextFilter: options.context,
        stateFilter: options.state,
        anchorTypeFilter: options.anchor as
          | 'decision'
          | 'blocker'
          | 'breakthrough'
          | 'question'
          | undefined,
        pchoffType: options.pchoffType,
        pchoffInsight: options.pchoffInsight,
        maxTokens: parseInt(options.limit) * 1000, // Rough estimate
      };

      const result: EnhancedLoadContextResponse =
        await retrieval.searchWithFallbacks(args);

      if (options.json) {
        console.log(JSON.stringify(result, null, 2));
        return;
      }

      // Pretty output
      console.log(`\n🔍 Search Results (${result.contexts.length} found)`);
      console.log(`📊 Strategy: ${result.searchStrategy}`);

      if (options.verbose) {
        console.log(`📈 Metrics:`, result.searchMetrics);
      }

      for (const conv of result.contexts) {
        console.log(
          `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`,
        );
        console.log(`📅 ${new Date(conv.timestamp).toLocaleString()}`);
        console.log(`🔖 ID: ${conv.conversationId}`);

        if (conv.summary) {
          console.log(`📝 ${conv.summary}`);
        }

        if (conv.anchors && conv.anchors.length > 0) {
          console.log(
            `⚓ Anchors: ${conv.anchors.map((a: SemanticAnchor) => `${a.type}(${a.confidence.toFixed(2)})`).join(', ')}`,
          );
        }

        // Note: PCHOFF metadata access would need to be added to EnhancedLoadContextResponse

        // Show truncated content
        if (conv.content) {
          const content =
            conv.content.length > 200
              ? conv.content.substring(0, 200) + '...'
              : conv.content;
          console.log(`\n${content}`);
        }
      }

      if (result.toolSuggestions && result.toolSuggestions.length > 0) {
        console.log(
          `\n💡 Suggestions: ${result.toolSuggestions.map((s) => s.tool).join(', ')}`,
        );
      }

      if (result.relatedSearches && result.relatedSearches.length > 0) {
        console.log(`🔗 Related: ${result.relatedSearches.join(', ')}`);
      }
    } catch (error) {
      console.error(
        '❌ Search failed:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Anchors command - leverage semantic anchor system
program
  .command('anchors')
  .description('List semantic anchors with filtering')
  .option('-t, --type <type>', 'Filter by anchor type')
  .option('-l, --limit <number>', 'Maximum results', '20')
  .option('--resolved', 'Show only resolved anchors')
  .option('--unresolved', 'Show only unresolved anchors')
  .option('--json', 'Output raw JSON')
  .action(
    async (options: {
      type?: string;
      limit: string;
      resolved?: boolean;
      unresolved?: boolean;
      json?: boolean;
    }) => {
      try {
        // Use existing getAnchors functionality
        const result = await storage.loadAll();
        if (!result.success || !result.data) {
          throw new Error('Failed to load conversations');
        }
        const conversations = result.data;
        const allAnchors = conversations.flatMap((conv: ConversationEntry) =>
          (conv.metadata.anchors || []).map((anchor: SemanticAnchor) => ({
            ...anchor,
            conversationId: conv.id,
            conversationDate: conv.timestamp,
          })),
        );

        let filtered = allAnchors;

        if (options.type) {
          filtered = filtered.filter(
            (a: AnchorWithMetadata) => a.type === options.type,
          );
        }

        if (options.resolved) {
          filtered = filtered.filter(
            (a: AnchorWithMetadata) => !a.requiresAnswer,
          );
        }

        if (options.unresolved) {
          filtered = filtered.filter(
            (a: AnchorWithMetadata) => a.requiresAnswer,
          );
        }

        // Sort by confidence descending
        filtered.sort(
          (a: AnchorWithMetadata, b: AnchorWithMetadata) =>
            b.confidence - a.confidence,
        );
        filtered = filtered.slice(0, parseInt(options.limit));

        if (options.json) {
          console.log(JSON.stringify(filtered, null, 2));
          return;
        }

        console.log(`\n⚓ Semantic Anchors (${filtered.length} found)\n`);

        for (const anchor of filtered) {
          const emojiMap = {
            decision: '🎯',
            breakthrough: '💡',
            blocker: '🚧',
            question: '❓',
          } as const;
          const emoji = emojiMap[anchor.type as keyof typeof emojiMap] || '📌';

          console.log(`${emoji} ${anchor.type.toUpperCase()}`);
          console.log(`   📊 Confidence: ${anchor.confidence.toFixed(2)}`);
          console.log(
            `   📅 ${new Date(anchor.conversationDate).toLocaleDateString()}`,
          );
          console.log(`   🔗 ${anchor.conversationId}`);
          console.log(`   📝 ${anchor.text}`);

          if (anchor.rationale) {
            console.log(`   💭 ${anchor.rationale}`);
          }

          if (anchor.requiresAnswer) {
            console.log(`   ❗ Requires answer`);
          }

          console.log('');
        }
      } catch (error) {
        console.error(
          '❌ Anchors command failed:',
          error instanceof Error ? error.message : String(error),
        );
        process.exit(1);
      }
    },
  );

// Export command - leverage existing storage
program
  .command('export')
  .description('Export conversations to various formats')
  .option('-i, --id <id>', 'Export specific conversation by ID')
  .option('-q, --query <query>', 'Export conversations matching query')
  .option(
    '-f, --format <format>',
    'Output format (json|markdown|text)',
    'markdown',
  )
  .option('-o, --output <file>', 'Output file (default: stdout)')
  .action(async (options: ExportOptions) => {
    try {
      interface ExportConversation {
        conversationId?: string;
        id?: string;
        content?: string;
        summary?: string;
        metadata?: {
          anchors?: SemanticAnchor[];
          checkpointId?: string;
          pchoff?: Record<string, unknown>;
        };
        timestamp: Date;
        anchors?: SemanticAnchor[];
      }

      let conversations: ExportConversation[] = [];

      if (options.id) {
        const result = await storage.load(options.id);
        if (result.success && result.data) {
          conversations = [result.data as ExportConversation];
        }
      } else if (options.query) {
        const result = await retrieval.searchWithFallbacks({
          query: options.query,
        });
        conversations = result.contexts;
      } else {
        const result = await storage.loadAll();
        if (result.success && result.data) {
          conversations = result.data as ExportConversation[];
        }
      }

      let output = '';

      if (options.format === 'json') {
        output = JSON.stringify(conversations, null, 2);
      } else if (options.format === 'markdown') {
        output = conversations
          .map((conv) => {
            const id = 'id' in conv ? conv.id : conv.conversationId;
            let md = `# Conversation ${id}\n\n`;
            md += `**Date:** ${new Date(conv.timestamp).toLocaleString()}\n\n`;

            if (conv.summary) {
              md += `**Summary:** ${conv.summary}\n\n`;
            }

            const anchors = conv.metadata?.anchors || conv.anchors;
            if (anchors && anchors.length > 0) {
              md += `**Anchors:**\n`;
              for (const anchor of anchors) {
                md += `- **${anchor.type}** (${anchor.confidence.toFixed(2)}): ${anchor.text}\n`;
              }
              md += '\n';
            }

            md += `## Content\n\n${conv.content || ''}\n\n`;
            return md;
          })
          .join('\n---\n\n');
      } else {
        output = conversations
          .map((conv) => {
            const id = 'id' in conv ? conv.id : conv.conversationId;
            let text = `=== ${id} ===\n`;
            text += `Date: ${new Date(conv.timestamp).toLocaleString()}\n`;
            if (conv.summary) text += `Summary: ${conv.summary}\n`;
            text += `\n${conv.content || ''}\n\n`;
            return text;
          })
          .join('\n');
      }

      if (options.output) {
        writeFileSync(options.output, output, 'utf-8');
        console.log(
          `✅ Exported ${conversations.length} conversations to ${options.output}`,
        );
      } else {
        console.log(output);
      }
    } catch (error) {
      console.error(
        '❌ Export failed:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Stats command - quick overview
program
  .command('stats')
  .description('Show memory system statistics')
  .action(async () => {
    try {
      const result = await storage.loadAll();
      if (!result.success || !result.data) {
        throw new Error('Failed to load conversations');
      }
      const conversations = result.data;
      const totalAnchors = conversations.reduce(
        (sum: number, conv: ConversationEntry) =>
          sum + (conv.metadata.anchors?.length || 0),
        0,
      );
      const anchorsByType = conversations
        .flatMap((c: ConversationEntry) => c.metadata.anchors || [])
        .reduce(
          (acc: Record<string, number>, anchor: SemanticAnchor) => {
            acc[anchor.type] = (acc[anchor.type] || 0) + 1;
            return acc;
          },
          {} as Record<string, number>,
        );

      interface PCHOFFMetadata {
        types?: string[];
        insights?: string[];
        patterns?: string[];
      }

      interface PCHOFFAccumulator {
        types: string[];
        insights: string[];
        patterns: string[];
      }

      const pchoffMetadata = conversations
        .filter((c: ConversationEntry) => c.metadata.pchoff)
        .reduce(
          (acc: PCHOFFAccumulator, conv: ConversationEntry) => {
            const meta = conv.metadata.pchoff as PCHOFFMetadata;
            if (meta?.types) acc.types.push(...meta.types);
            if (meta?.insights) acc.insights.push(...meta.insights);
            if (meta?.patterns) acc.patterns.push(...meta.patterns);
            return acc;
          },
          { types: [], insights: [], patterns: [] } as PCHOFFAccumulator,
        );

      console.log('\n📊 CHOFF-A-MCP Memory Statistics\n');
      console.log(`💾 Total Conversations: ${conversations.length}`);
      console.log(`⚓ Total Anchors: ${totalAnchors}`);

      console.log('\n🏷️  Anchor Types:');
      Object.entries(anchorsByType).forEach(([type, count]) => {
        console.log(`   ${type}: ${count}`);
      });

      if (pchoffMetadata.types.length > 0) {
        console.log('\n🔖 PCHOFF Classifications:');
        console.log(
          `   Types: ${[...new Set(pchoffMetadata.types)].join(', ')}`,
        );
        console.log(
          `   Insights: ${[...new Set(pchoffMetadata.insights)].join(', ')}`,
        );
        console.log(
          `   Patterns: ${[...new Set(pchoffMetadata.patterns)].join(', ')}`,
        );
      }

      const oldestConv = conversations.reduce(
        (oldest: ConversationEntry, conv: ConversationEntry) =>
          new Date(conv.timestamp) < new Date(oldest.timestamp) ? conv : oldest,
      );
      const newestConv = conversations.reduce(
        (newest: ConversationEntry, conv: ConversationEntry) =>
          new Date(conv.timestamp) > new Date(newest.timestamp) ? conv : newest,
      );

      console.log(
        `\n📅 Date Range: ${new Date(oldestConv.timestamp).toLocaleDateString()} → ${new Date(newestConv.timestamp).toLocaleDateString()}`,
      );
    } catch (error) {
      console.error(
        '❌ Stats failed:',
        error instanceof Error ? error.message : String(error),
      );
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
