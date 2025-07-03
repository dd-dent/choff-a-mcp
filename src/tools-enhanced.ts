import { z } from 'zod';
import type {
  ConversationStorage,
  SearchCriteria,
  ConversationEntry,
} from './storage/types.js';
import type { SemanticAnchor } from './anchors/types.js';
import {
  extractAllPCHOFFMarkers,
  extractPCHOFFMetadata,
} from './parser/pchoff-parser.js';

// Enhanced input schema with new filtering options
export const enhancedLoadContextSchema = z.object({
  query: z.string().optional(),
  timeRange: z
    .object({
      start: z.string().datetime(),
      end: z.string().datetime(),
    })
    .optional(),
  anchorsOnly: z.boolean().optional(),
  maxTokens: z.number().optional(),
  // Enhanced CHOFF options
  contextFilter: z.union([z.string(), z.array(z.string())]).optional(),
  anchorTypeFilter: z
    .enum(['decision', 'blocker', 'breakthrough', 'question'])
    .optional(),
  stateFilter: z.union([z.string(), z.array(z.string())]).optional(),
  branchFilter: z.string().optional(), // For future branch ID filtering
  // PCHOFF-1.1-A options
  pchoffType: z.union([z.string(), z.array(z.string())]).optional(),
  pchoffInsight: z.union([z.string(), z.array(z.string())]).optional(),
  pchoffLevel: z.union([z.string(), z.array(z.string())]).optional(),
  pchoffPattern: z.union([z.string(), z.array(z.string())]).optional(),
  pchoffSource: z.union([z.string(), z.array(z.string())]).optional(),
});

export interface EnhancedLoadContextResponse {
  contexts: Array<{
    conversationId: string;
    content?: string;
    summary?: string;
    tags?: string[];
    anchors?: SemanticAnchor[];
    metadata: {
      anchors?: SemanticAnchor[];
      checkpointId?: string;
    };
    timestamp: Date;
  }>;
  totalTokens: number;
  query?: string;
  // Enhanced response fields
  searchStrategy?:
    | 'content_search'
    | 'pchoff_search'
    | 'anchor_search'
    | 'state_matching'
    | 'fallback_all';
  fallbackStrategy?: string;
  suggestions?: string[];
  availableContexts?: string[];
  availableStates?: string[];
  availableFilters?: {
    contexts: string[];
    anchorTypes: string[];
    states: string[];
    pchoffTypes: string[];
    pchoffInsights: string[];
    pchoffLevels: string[];
    pchoffPatterns: string[];
    pchoffSources: string[];
  };
  toolSuggestions?: Array<{
    tool: string;
    args: Record<string, unknown>;
    reason: string;
  }>;
  relatedSearches?: string[];
  searchMetrics?: {
    candidatesEvaluated: number;
    strategiesUsed: string[];
    timeMs: number;
  };
}

export class EnhancedRetrieval {
  constructor(private storage: ConversationStorage) {}

  async searchWithFallbacks(
    args: z.infer<typeof enhancedLoadContextSchema>,
  ): Promise<EnhancedLoadContextResponse> {
    const startTime = Date.now();
    const searchMetrics = {
      candidatesEvaluated: 0,
      strategiesUsed: [] as string[],
      timeMs: 0,
    };

    let allConversations: ConversationEntry[] = [];

    // Load all conversations first for analysis
    const loadResult = await this.storage.loadAll();
    if (loadResult.success && loadResult.data) {
      allConversations = loadResult.data;
      searchMetrics.candidatesEvaluated = allConversations.length;
    }

    // Extract available filters for suggestions
    const availableFilters = this.extractAvailableFilters(allConversations);

    // Apply filters using storage search
    const searchCriteria: SearchCriteria = {};

    if (args.timeRange) {
      searchCriteria.timeRange = {
        start: new Date(args.timeRange.start),
        end: new Date(args.timeRange.end),
      };
    }

    if (args.contextFilter) {
      const contexts = Array.isArray(args.contextFilter)
        ? args.contextFilter
        : [args.contextFilter];
      searchCriteria.contexts = contexts;
    }

    if (args.stateFilter) {
      const states = Array.isArray(args.stateFilter)
        ? args.stateFilter
        : [args.stateFilter];
      searchCriteria.states = states;
    }

    if (args.anchorTypeFilter) {
      searchCriteria.anchorTypes = [args.anchorTypeFilter];
    }

    // PCHOFF-1.1-A filtering
    if (args.pchoffType) {
      searchCriteria.pchoffType = args.pchoffType;
    }
    if (args.pchoffInsight) {
      searchCriteria.pchoffInsight = args.pchoffInsight;
    }
    if (args.pchoffLevel) {
      searchCriteria.pchoffLevel = args.pchoffLevel;
    }
    if (args.pchoffPattern) {
      searchCriteria.pchoffPattern = args.pchoffPattern;
    }
    if (args.pchoffSource) {
      searchCriteria.pchoffSource = args.pchoffSource;
    }

    // Don't include query in storage search - we'll handle it with multi-layer approach
    // This allows us to apply different search strategies

    // Get filtered conversations from storage
    const searchResult = await this.storage.search(searchCriteria);
    let filteredConversations: ConversationEntry[] = [];

    if (searchResult.success && searchResult.data) {
      filteredConversations = searchResult.data;
    }

    // Multi-layer search strategy
    let results: ConversationEntry[] = [];
    let searchStrategy: EnhancedLoadContextResponse['searchStrategy'] =
      'content_search';
    let fallbackStrategy: string | undefined;

    // If query is provided, apply multi-layer search on filtered results
    if (args.query && filteredConversations.length > 0) {
      searchMetrics.strategiesUsed.push('content_search');
      results = this.searchByContent(filteredConversations, args.query);

      // Layer 2: PCHOFF classification search fallback
      if (results.length === 0) {
        searchMetrics.strategiesUsed.push('pchoff_search');
        results = this.searchByPCHOFF(filteredConversations, args.query);
        if (results.length > 0) {
          searchStrategy = 'pchoff_search';
          fallbackStrategy = 'pchoff_search';
        }
      }

      // Layer 3: Anchor search fallback
      if (results.length === 0) {
        searchMetrics.strategiesUsed.push('anchor_search');
        results = this.searchByAnchors(filteredConversations, args.query);
        if (results.length > 0) {
          searchStrategy = 'anchor_search';
          fallbackStrategy = 'anchor_search';
        }
      }

      // Layer 4: State matching fallback
      if (results.length === 0) {
        searchMetrics.strategiesUsed.push('state_matching');
        results = this.searchByStates(filteredConversations, args.query);
        if (results.length > 0) {
          searchStrategy = 'state_matching';
          fallbackStrategy = 'state_matching';
        }
      }

      // Layer 5: Context matching fallback
      if (results.length === 0) {
        searchMetrics.strategiesUsed.push('context_matching');
        results = this.searchByContexts(filteredConversations, args.query);
        if (results.length > 0) {
          searchStrategy = 'fallback_all';
          fallbackStrategy = 'context_matching';
        }
      }
    } else {
      // No query provided or no filtered results, return filtered results as-is
      results = filteredConversations;
    }

    // Process results for return
    const { contexts, totalTokens } = this.processResults(
      results,
      args.maxTokens || 4000,
      args.anchorsOnly,
    );

    // Generate suggestions and tool recommendations
    const suggestions = this.generateSuggestions(
      results,
      args,
      availableFilters,
    );
    const toolSuggestions = this.generateToolSuggestions(results, args);
    const relatedSearches = this.generateRelatedSearches(results, args);

    searchMetrics.timeMs = Date.now() - startTime;

    return {
      contexts,
      totalTokens,
      query: args.query,
      searchStrategy,
      fallbackStrategy,
      suggestions: results.length === 0 ? suggestions : [],
      availableContexts:
        results.length === 0 ? availableFilters.contexts : undefined,
      availableStates:
        results.length === 0 ? availableFilters.states : undefined,
      availableFilters:
        results.length === 0
          ? availableFilters
          : args.pchoffType ||
              args.pchoffInsight ||
              args.pchoffLevel ||
              args.pchoffPattern ||
              args.pchoffSource
            ? availableFilters
            : undefined,
      toolSuggestions,
      relatedSearches: results.length > 0 ? relatedSearches : undefined,
      searchMetrics,
    };
  }

  private searchByContent(
    conversations: ConversationEntry[],
    query: string,
  ): ConversationEntry[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower
      .split(/\s+/)
      .filter((word) => word.length > 0);

    return conversations.filter((entry) => {
      const lowerContent = entry.content.toLowerCase();
      const lowerSummary = entry.summary?.toLowerCase() || '';
      const searchText = lowerContent + ' ' + lowerSummary;

      // Check if all query words are present
      return queryWords.every((word) => searchText.includes(word));
    });
  }

  private searchByAnchors(
    conversations: ConversationEntry[],
    query: string,
  ): ConversationEntry[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // Check for anchor type keywords
    const anchorTypeKeywords: Record<string, string[]> = {
      decision: ['decision', 'decided', 'choose', 'chose', 'choice'],
      breakthrough: ['breakthrough', 'discovered', 'solved', 'eureka', 'found'],
      blocker: ['blocked', 'stuck', 'problem', 'issue', 'blocker'],
      question: ['question', 'wondering', 'should', 'how', 'why', 'what'],
    };

    return conversations.filter((entry) => {
      if (!entry.metadata?.anchors || entry.metadata.anchors.length === 0) {
        return false;
      }

      // Check anchor content
      const anchorTexts = entry.metadata.anchors
        .map((a) => a.text.toLowerCase())
        .join(' ');

      // Check if query matches anchor content
      if (queryWords.every((word) => anchorTexts.includes(word))) {
        return true;
      }

      // Check if query contains anchor type keywords
      for (const [anchorType, keywords] of Object.entries(anchorTypeKeywords)) {
        if (keywords.some((keyword) => queryLower.includes(keyword))) {
          return entry.metadata.anchors.some((a) => a.type === anchorType);
        }
      }

      return false;
    });
  }

  private searchByPCHOFF(
    conversations: ConversationEntry[],
    query: string,
  ): ConversationEntry[] {
    const queryLower = query.toLowerCase();
    const queryWords = queryLower
      .split(/\s+/)
      .filter((word) => word.length > 0);

    // PCHOFF classification keywords for query matching
    const pchoffKeywords: Record<string, string[]> = {
      // Types
      observation: ['observation', 'observed', 'noticed', 'saw', 'documented'],
      analysis: ['analysis', 'analyzed', 'examined', 'investigated', 'studied'],
      theory: ['theory', 'theoretical', 'hypothesis', 'concept', 'framework'],
      procedure: ['procedure', 'process', 'method', 'steps', 'workflow'],
      case_study: ['case', 'study', 'example', 'instance', 'scenario'],

      // Insights
      direct: ['direct', 'immediately', 'obvious', 'clear', 'straightforward'],
      emergent: ['emergent', 'emerging', 'pattern', 'discovered', 'realized'],
      collective: ['collective', 'shared', 'collaborative', 'cross-instance'],
      meta: ['meta', 'recursive', 'self-referential', 'about', 'concerning'],
      practical: [
        'practical',
        'implementation',
        'applied',
        'useful',
        'actionable',
      ],
      iterative: ['iterative', 'evolving', 'refined', 'improved', 'developed'],

      // Levels
      basic: ['basic', 'fundamental', 'foundation', 'simple', 'elementary'],
      intermediate: ['intermediate', 'advanced', 'complex', 'sophisticated'],
      experimental: [
        'experimental',
        'testing',
        'trial',
        'prototype',
        'exploration',
      ],
    };

    return conversations.filter((entry) => {
      // Ensure PCHOFF metadata exists
      if (!entry.metadata.pchoff) {
        entry.metadata.pchoff = extractPCHOFFMetadata(entry.content);
      }

      const pchoff = entry.metadata.pchoff;
      if (!pchoff) return false;

      // Check if query words match any PCHOFF classification values
      const allPchoffValues = [
        ...(pchoff.types || []),
        ...(pchoff.insights || []),
        ...(pchoff.levels || []),
        ...(pchoff.patterns || []),
        ...(pchoff.sources || []),
      ].map((v) => v.toLowerCase());

      // Direct match with PCHOFF values
      if (
        queryWords.some((word) =>
          allPchoffValues.some((value) => value.includes(word)),
        )
      ) {
        return true;
      }

      // Keyword-based matching
      for (const [classification, keywords] of Object.entries(pchoffKeywords)) {
        if (keywords.some((keyword) => queryLower.includes(keyword))) {
          // Check if this entry has this classification
          return allPchoffValues.some((value) =>
            value.includes(classification),
          );
        }
      }

      return false;
    });
  }

  private searchByStates(
    conversations: ConversationEntry[],
    query: string,
  ): ConversationEntry[] {
    const queryLower = query.toLowerCase();

    // Common state-related keywords
    const stateKeywords: Record<string, string[]> = {
      analytical: ['analytical', 'analyzing', 'analysis', 'thinking'],
      curious: ['curious', 'wondering', 'exploring', 'investigating'],
      focused: ['focused', 'concentrating', 'attention'],
      planning: ['planning', 'designing', 'architecting'],
      decisive: ['decisive', 'decided', 'determined'],
      blocked: ['blocked', 'stuck', 'frustrated'],
      creative: ['creative', 'innovative', 'imaginative'],
    };

    return conversations.filter((entry) => {
      const entryStates = entry.choffDocument.states
        .filter((s) => s.type === 'simple')
        .map((s) => s.value.toLowerCase());

      // Check if query contains state keywords
      for (const [state, keywords] of Object.entries(stateKeywords)) {
        if (keywords.some((keyword) => queryLower.includes(keyword))) {
          return entryStates.includes(state);
        }
      }

      // Direct state name match
      return entryStates.some((state) => queryLower.includes(state));
    });
  }

  private searchByContexts(
    conversations: ConversationEntry[],
    query: string,
  ): ConversationEntry[] {
    const queryLower = query.toLowerCase();

    return conversations.filter((entry) => {
      const entryContexts = entry.choffDocument.contexts.map((c) =>
        c.value.toLowerCase(),
      );
      return entryContexts.some(
        (context) =>
          context &&
          queryLower &&
          (context.includes(queryLower) || queryLower.includes(context)),
      );
    });
  }

  private extractAvailableFilters(conversations: ConversationEntry[]): {
    contexts: string[];
    anchorTypes: string[];
    states: string[];
    pchoffTypes: string[];
    pchoffInsights: string[];
    pchoffLevels: string[];
    pchoffPatterns: string[];
    pchoffSources: string[];
  } {
    const contexts = new Set<string>();
    const anchorTypes = new Set<string>();
    const states = new Set<string>();

    for (const conv of conversations) {
      // Extract contexts
      conv.choffDocument.contexts.forEach((c) => contexts.add(c.value));

      // Extract states
      conv.choffDocument.states
        .filter((s) => s.type === 'simple')
        .forEach((s) => states.add(s.value));

      // Extract anchor types
      if (conv.metadata?.anchors) {
        conv.metadata.anchors.forEach((a) => anchorTypes.add(a.type));
      }
    }

    // Extract PCHOFF markers from all conversations
    const pchoffMarkers = extractAllPCHOFFMarkers(
      conversations.map((conv) => ({
        content: conv.content,
        metadata: conv.metadata,
      })),
    );

    return {
      contexts: Array.from(contexts).sort(),
      anchorTypes: Array.from(anchorTypes).sort(),
      states: Array.from(states).sort(),
      pchoffTypes: pchoffMarkers.types,
      pchoffInsights: pchoffMarkers.insights,
      pchoffLevels: pchoffMarkers.levels,
      pchoffPatterns: pchoffMarkers.patterns,
      pchoffSources: pchoffMarkers.sources,
    };
  }

  private processResults(
    results: ConversationEntry[],
    maxTokens: number,
    anchorsOnly?: boolean,
  ): {
    contexts: Array<{
      conversationId: string;
      content?: string;
      summary?: string;
      tags?: string[];
      anchors?: SemanticAnchor[];
      metadata: Record<string, unknown>;
      timestamp: Date;
    }>;
    totalTokens: number;
  } {
    const contexts: Array<{
      conversationId: string;
      content?: string;
      summary?: string;
      tags?: string[];
      anchors?: SemanticAnchor[];
      metadata: Record<string, unknown>;
      timestamp: Date;
    }> = [];
    let totalTokens = 0;

    // Sort by timestamp (newest first)
    results.sort(
      (a, b) =>
        new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime(),
    );

    for (const conv of results) {
      const tokens = conv.content.split(/\s+/).length;

      if (totalTokens + tokens > maxTokens) {
        // Truncate if needed
        const remainingTokens = maxTokens - totalTokens;
        if (remainingTokens > 0) {
          const words = conv.content.split(/\s+/).slice(0, remainingTokens);
          contexts.push({
            conversationId: conv.id,
            content: anchorsOnly ? undefined : words.join(' ') + '...',
            summary: conv.summary,
            tags: conv.tags,
            anchors: conv.metadata?.anchors,
            metadata: conv.metadata || {},
            timestamp: conv.timestamp,
          });
          totalTokens = maxTokens;
        }
        break;
      }

      contexts.push({
        conversationId: conv.id,
        content: anchorsOnly ? undefined : conv.content,
        summary: conv.summary,
        tags: conv.tags,
        anchors: conv.metadata?.anchors,
        metadata: conv.metadata || {},
        timestamp: conv.timestamp,
      });
      totalTokens += tokens;
    }

    return { contexts, totalTokens };
  }

  private generateSuggestions(
    results: ConversationEntry[],
    args: z.infer<typeof enhancedLoadContextSchema>,
    availableFilters: {
      contexts: string[];
      anchorTypes: string[];
      states: string[];
    },
  ): string[] {
    const suggestions: string[] = [];

    // Only suggest for empty results
    if (results.length === 0) {
      suggestions.push('No results found. Try:');

      // Track what filters have been applied
      const appliedFilters = {
        hasContext: !!args.contextFilter,
        hasState: !!args.stateFilter,
        hasAnchorType: !!args.anchorTypeFilter,
        hasTimeRange: !!args.timeRange,
        hasPCHOFF: !!(
          args.pchoffType ||
          args.pchoffInsight ||
          args.pchoffLevel
        ),
      };

      let suggestionCount = 0;
      const maxSuggestions = 2;

      // Priority 1: Suggest unused filter types with examples
      if (!appliedFilters.hasAnchorType && suggestionCount < maxSuggestions) {
        suggestions.push(
          'Try anchor types: anchorTypeFilter: "decision" or "breakthrough"',
        );
        suggestionCount++;
      }

      if (
        !appliedFilters.hasContext &&
        availableFilters.contexts.length > 0 &&
        suggestionCount < maxSuggestions
      ) {
        const contextExamples = availableFilters.contexts
          .slice(0, 2)
          .join('" or "');
        suggestions.push(
          `Filter by context: contextFilter: "${contextExamples}"`,
        );
        suggestionCount++;
      }

      if (
        !appliedFilters.hasState &&
        availableFilters.states.length > 0 &&
        suggestionCount < maxSuggestions
      ) {
        const stateExamples = availableFilters.states
          .slice(0, 2)
          .join('" or "');
        suggestions.push(`Search by state: stateFilter: "${stateExamples}"`);
        suggestionCount++;
      }

      // Priority 2: If all filter types are used, suggest broader search
      if (suggestionCount === 0) {
        if (args.query && args.query.length > 20) {
          suggestions.push('Use shorter or more general search terms');
          suggestionCount++;
        } else {
          suggestions.push(
            'Try broader search terms like "implementation" or "design"',
          );
          suggestionCount++;
        }

        if (appliedFilters.hasTimeRange && suggestionCount < maxSuggestions) {
          suggestions.push(
            'Remove timeRange filter to search all conversations',
          );
          suggestionCount++;
        }
      }
    }

    return suggestions;
  }

  private generateToolSuggestions(
    results: ConversationEntry[],
    args: z.infer<typeof enhancedLoadContextSchema>,
  ): Array<{ tool: string; args: Record<string, unknown>; reason: string }> {
    const suggestions = [];

    // Suggest getAnchors if we found anchor-rich results
    const totalAnchors = results.reduce(
      (sum, conv) => sum + (conv.metadata?.anchors?.length || 0),
      0,
    );

    if (totalAnchors > 0) {
      // Find most common anchor type
      const anchorTypeCounts: Record<string, number> = {};
      for (const conv of results) {
        if (conv.metadata?.anchors) {
          for (const anchor of conv.metadata.anchors) {
            anchorTypeCounts[anchor.type] =
              (anchorTypeCounts[anchor.type] || 0) + 1;
          }
        }
      }

      const mostCommonType = Object.entries(anchorTypeCounts).sort(
        ([, a], [, b]) => b - a,
      )[0]?.[0];

      if (mostCommonType) {
        suggestions.push({
          tool: 'getAnchors',
          args: { type: mostCommonType, limit: 10 },
          reason: `Found ${anchorTypeCounts[mostCommonType]} ${mostCommonType} anchors in results`,
        });
      }
    }

    // Suggest saveCheckpoint if query seems like new information
    if (
      args.query &&
      (args.query.includes('decided') || args.query.includes('found'))
    ) {
      suggestions.push({
        tool: 'saveCheckpoint',
        args: { extractAnchors: true, generateSummary: true },
        reason: 'Query suggests new decision or discovery to save',
      });
    }

    return suggestions;
  }

  private generateRelatedSearches(
    results: ConversationEntry[],
    args: z.infer<typeof enhancedLoadContextSchema>,
  ): string[] {
    const related = new Set<string>();

    // Extract key terms from results
    for (const conv of results.slice(0, 3)) {
      // Extract from anchors
      if (conv.metadata?.anchors) {
        for (const anchor of conv.metadata.anchors) {
          // Extract key phrases from anchor text
          const words = anchor.text
            ? anchor.text.toLowerCase().split(/\s+/)
            : [];
          const keyPhrases = words.filter(
            (w) =>
              w &&
              w.length > 4 &&
              !['that', 'this', 'with', 'from'].includes(w),
          );
          keyPhrases.slice(0, 2).forEach((phrase) => related.add(phrase));
        }
      }

      // Extract from contexts
      conv.choffDocument.contexts.forEach((ctx) => related.add(ctx.value));

      // Extract from PCHOFF metadata if present
      if (conv.metadata.pchoff) {
        const pchoff = conv.metadata.pchoff;
        pchoff.types?.forEach((type) => related.add(type));
        pchoff.insights?.forEach((insight) => related.add(insight));
        pchoff.levels?.forEach((level) => related.add(level));
      }

      // Extract meaningful words from content if we don't have enough terms yet
      if (related.size < 3) {
        const contentWords = conv.content
          .toLowerCase()
          .replace(/[^\w\s]/g, ' ')
          .split(/\s+/)
          .filter(
            (w) =>
              w &&
              w.length > 5 &&
              !['making', 'testing', 'running', 'knowledge'].includes(w),
          );
        contentWords.slice(0, 2).forEach((word) => related.add(word));
      }
    }

    // Remove the original query terms
    if (args.query) {
      const queryWords = args.query.toLowerCase().split(/\s+/);
      queryWords.forEach((word) => related.delete(word));
    }

    return Array.from(related).slice(0, 5);
  }
}
