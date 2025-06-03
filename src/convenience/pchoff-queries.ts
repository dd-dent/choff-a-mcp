import type { ConversationStorage } from '../storage/types.js';
import type { EnhancedLoadContextResponse } from '../tools-enhanced.js';
import { EnhancedRetrieval } from '../tools-enhanced.js';

/**
 * Convenience functions for PCHOFF-based queries
 */
export class PCHOFFQueries {
  private enhancedRetrieval: EnhancedRetrieval;

  constructor(private storage: ConversationStorage) {
    this.enhancedRetrieval = new EnhancedRetrieval(storage);
  }

  /**
   * Search by PCHOFF type (observation, analysis, theory, procedure, case_study)
   */
  async searchByType(
    type: string | string[],
    options?: {
      query?: string;
      maxTokens?: number;
      timeRange?: { start: Date; end: Date };
    },
  ): Promise<EnhancedLoadContextResponse> {
    return this.enhancedRetrieval.searchWithFallbacks({
      pchoffType: type,
      query: options?.query,
      maxTokens: options?.maxTokens,
      timeRange: options?.timeRange
        ? {
            start: options.timeRange.start.toISOString(),
            end: options.timeRange.end.toISOString(),
          }
        : undefined,
    });
  }

  /**
   * Search by insight classification (direct, emergent, collective, meta, practical, iterative, relational)
   */
  async searchByInsight(
    insight: string | string[],
    options?: {
      query?: string;
      maxTokens?: number;
      timeRange?: { start: Date; end: Date };
    },
  ): Promise<EnhancedLoadContextResponse> {
    return this.enhancedRetrieval.searchWithFallbacks({
      pchoffInsight: insight,
      query: options?.query,
      maxTokens: options?.maxTokens,
      timeRange: options?.timeRange
        ? {
            start: options.timeRange.start.toISOString(),
            end: options.timeRange.end.toISOString(),
          }
        : undefined,
    });
  }

  /**
   * Search by implementation level (basic, intermediate, advanced, experimental)
   */
  async searchByLevel(
    level: string | string[],
    options?: {
      query?: string;
      maxTokens?: number;
      timeRange?: { start: Date; end: Date };
    },
  ): Promise<EnhancedLoadContextResponse> {
    return this.enhancedRetrieval.searchWithFallbacks({
      pchoffLevel: level,
      query: options?.query,
      maxTokens: options?.maxTokens,
      timeRange: options?.timeRange
        ? {
            start: options.timeRange.start.toISOString(),
            end: options.timeRange.end.toISOString(),
          }
        : undefined,
    });
  }

  /**
   * Search by pattern status (stable, emerging, theoretical, resonant, evolving, disrupted)
   */
  async searchByPattern(
    pattern: string | string[],
    options?: {
      query?: string;
      maxTokens?: number;
      timeRange?: { start: Date; end: Date };
    },
  ): Promise<EnhancedLoadContextResponse> {
    return this.enhancedRetrieval.searchWithFallbacks({
      pchoffPattern: pattern,
      query: options?.query,
      maxTokens: options?.maxTokens,
      timeRange: options?.timeRange
        ? {
            start: options.timeRange.start.toISOString(),
            end: options.timeRange.end.toISOString(),
          }
        : undefined,
    });
  }

  /**
   * Search by knowledge source (direct, derived, collective, theoretical)
   */
  async searchBySource(
    source: string | string[],
    options?: {
      query?: string;
      maxTokens?: number;
      timeRange?: { start: Date; end: Date };
    },
  ): Promise<EnhancedLoadContextResponse> {
    return this.enhancedRetrieval.searchWithFallbacks({
      pchoffSource: source,
      query: options?.query,
      maxTokens: options?.maxTokens,
      timeRange: options?.timeRange
        ? {
            start: options.timeRange.start.toISOString(),
            end: options.timeRange.end.toISOString(),
          }
        : undefined,
    });
  }

  /**
   * Find observations - convenience for [type:observation]
   */
  async findObservations(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByType('observation', options);
  }

  /**
   * Find analyses - convenience for [type:analysis]
   */
  async findAnalyses(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByType('analysis', options);
  }

  /**
   * Find theories - convenience for [type:theory]
   */
  async findTheories(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByType('theory', options);
  }

  /**
   * Find procedures - convenience for [type:procedure]
   */
  async findProcedures(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByType('procedure', options);
  }

  /**
   * Find case studies - convenience for [type:case_study]
   */
  async findCaseStudies(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByType('case_study', options);
  }

  /**
   * Find emergent insights - patterns discovered through observation
   */
  async findEmergentInsights(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByInsight('emergent', options);
  }

  /**
   * Find collective knowledge - cross-instance or collaborative insights
   */
  async findCollectiveKnowledge(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByInsight('collective', options);
  }

  /**
   * Find practical applications - implementation-focused insights
   */
  async findPracticalApplications(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByInsight('practical', options);
  }

  /**
   * Find meta-insights - self-referential or systemic insights
   */
  async findMetaInsights(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByInsight('meta', options);
  }

  /**
   * Find stable patterns - consistently observed behaviors
   */
  async findStablePatterns(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByPattern('stable', options);
  }

  /**
   * Find emerging patterns - newly forming behaviors
   */
  async findEmergingPatterns(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByPattern('emerging', options);
  }

  /**
   * Find experimental content - testing ground for new ideas
   */
  async findExperimentalContent(options?: {
    query?: string;
    maxTokens?: number;
  }): Promise<EnhancedLoadContextResponse> {
    return this.searchByLevel('experimental', options);
  }

  /**
   * Complex query builder for advanced PCHOFF searches
   */
  async complexQuery(criteria: {
    types?: string | string[];
    insights?: string | string[];
    levels?: string | string[];
    patterns?: string | string[];
    sources?: string | string[];
    query?: string;
    maxTokens?: number;
    timeRange?: { start: Date; end: Date };
    // Can also combine with CHOFF filters
    contexts?: string | string[];
    states?: string | string[];
    anchorTypes?: 'decision' | 'blocker' | 'breakthrough' | 'question';
  }): Promise<EnhancedLoadContextResponse> {
    return this.enhancedRetrieval.searchWithFallbacks({
      pchoffType: criteria.types,
      pchoffInsight: criteria.insights,
      pchoffLevel: criteria.levels,
      pchoffPattern: criteria.patterns,
      pchoffSource: criteria.sources,
      contextFilter: criteria.contexts,
      stateFilter: criteria.states,
      anchorTypeFilter: criteria.anchorTypes,
      query: criteria.query,
      maxTokens: criteria.maxTokens,
      timeRange: criteria.timeRange
        ? {
            start: criteria.timeRange.start.toISOString(),
            end: criteria.timeRange.end.toISOString(),
          }
        : undefined,
    });
  }

  /**
   * Get available PCHOFF classifications in the storage
   */
  async getAvailableClassifications(): Promise<{
    types: string[];
    insights: string[];
    levels: string[];
    patterns: string[];
    sources: string[];
  }> {
    const allResult = await this.storage.loadAll();
    if (!allResult.success || !allResult.data) {
      return {
        types: [],
        insights: [],
        levels: [],
        patterns: [],
        sources: [],
      };
    }

    const { extractAllPCHOFFMarkers } = await import(
      '../parser/pchoff-parser.js'
    );
    return extractAllPCHOFFMarkers(
      allResult.data.map((conv) => ({
        content: conv.content,
        metadata: conv.metadata,
      })),
    );
  }
}
