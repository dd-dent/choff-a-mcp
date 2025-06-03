import type { PCHOFFMetadata } from '../storage/types.js';

// PCHOFF marker patterns for extraction
const PCHOFF_PATTERNS = {
  type: /\[type:([^\]]+)\]/g,
  insight: /\[insight:([^\]]+)\]/g,
  level: /\[level:([^\]]+)\]/g,
  pattern: /&pattern:([^@\s]+)(?:@([^@\s]*)@?)?(?=\s|$|&|\[|\{)/g,
  source: /\{source:([^}]+)\}/g,
  anchor: /\[anchor:([^\]]+)\]/g,
  resonance: /&resonance:([^@\s]+)(?:@([^@\s]*)@?)?(?=\s|$|&|\[|\{)/g,
  temporal: /\[temporal:([^\]]+)\]/g,
} as const;

/**
 * Extract PCHOFF classification metadata from text content
 */
export function extractPCHOFFMetadata(content: string): PCHOFFMetadata {
  const metadata: PCHOFFMetadata = {};

  // Extract type markers: [type:observation], [type:analysis], etc.
  const typeMatches = [...content.matchAll(PCHOFF_PATTERNS.type)];
  if (typeMatches.length > 0) {
    metadata.types = [...new Set(typeMatches.map((match) => match[1].trim()))];
  }

  // Extract insight markers: [insight:direct], [insight:emergent], etc.
  const insightMatches = [...content.matchAll(PCHOFF_PATTERNS.insight)];
  if (insightMatches.length > 0) {
    metadata.insights = [
      ...new Set(insightMatches.map((match) => match[1].trim())),
    ];
  }

  // Extract level markers: [level:basic], [level:intermediate], etc.
  const levelMatches = [...content.matchAll(PCHOFF_PATTERNS.level)];
  if (levelMatches.length > 0) {
    metadata.levels = [
      ...new Set(levelMatches.map((match) => match[1].trim())),
    ];
  }

  // Extract pattern markers: &pattern:stable@, &pattern:emerging@active@, etc.
  const patternMatches = [...content.matchAll(PCHOFF_PATTERNS.pattern)];
  if (patternMatches.length > 0) {
    metadata.patterns = [
      ...new Set(
        patternMatches.map((match) => {
          const name = match[1].trim();
          const status = match[2]?.trim();
          return status ? `${name}@${status}` : name;
        }),
      ),
    ];
  }

  // Extract source markers: {source:direct}, {source:collective}, etc.
  const sourceMatches = [...content.matchAll(PCHOFF_PATTERNS.source)];
  if (sourceMatches.length > 0) {
    metadata.sources = [
      ...new Set(sourceMatches.map((match) => match[1].trim())),
    ];
  }

  // Extract anchor references: [anchor:anc_123], [anchor:type:breakthrough], etc.
  const anchorMatches = [...content.matchAll(PCHOFF_PATTERNS.anchor)];
  if (anchorMatches.length > 0) {
    metadata.anchorRefs = [
      ...new Set(anchorMatches.map((match) => match[1].trim())),
    ];
  }

  // Extract resonance markers: &resonance:strong@, &resonance:partial@0.7@, etc.
  const resonanceMatches = [...content.matchAll(PCHOFF_PATTERNS.resonance)];
  if (resonanceMatches.length > 0) {
    metadata.resonance = [
      ...new Set(
        resonanceMatches.map((match) => {
          const type = match[1].trim();
          const metric = match[2]?.trim();
          return metric ? `${type}@${metric}` : type;
        }),
      ),
    ];
  }

  // Extract temporal markers: [temporal:past], [temporal:present], etc.
  const temporalMatches = [...content.matchAll(PCHOFF_PATTERNS.temporal)];
  if (temporalMatches.length > 0) {
    metadata.temporal = [
      ...new Set(temporalMatches.map((match) => match[1].trim())),
    ];
  }

  return metadata;
}

/**
 * Check if content has any PCHOFF markers
 */
export function hasPCHOFFMarkers(content: string): boolean {
  return Object.values(PCHOFF_PATTERNS).some((pattern) => {
    pattern.lastIndex = 0; // Reset regex state
    return pattern.test(content);
  });
}

/**
 * Extract all unique PCHOFF markers for filter suggestions
 */
export function extractAllPCHOFFMarkers(
  conversations: Array<{
    content: string;
    metadata?: { pchoff?: PCHOFFMetadata };
  }>,
): {
  types: string[];
  insights: string[];
  levels: string[];
  patterns: string[];
  sources: string[];
  resonance: string[];
  temporal: string[];
} {
  const allMarkers = {
    types: new Set<string>(),
    insights: new Set<string>(),
    levels: new Set<string>(),
    patterns: new Set<string>(),
    sources: new Set<string>(),
    resonance: new Set<string>(),
    temporal: new Set<string>(),
  };

  for (const conv of conversations) {
    // Always extract from content to ensure completeness, but prefer cached when available
    const extractedPchoff = extractPCHOFFMetadata(conv.content);
    const cachedPchoff = conv.metadata?.pchoff;

    // Merge cached and extracted data, preferring cached when available
    const pchoff: PCHOFFMetadata = {
      types: cachedPchoff?.types || extractedPchoff.types,
      insights: cachedPchoff?.insights || extractedPchoff.insights,
      levels: cachedPchoff?.levels || extractedPchoff.levels,
      patterns: cachedPchoff?.patterns || extractedPchoff.patterns,
      sources: cachedPchoff?.sources || extractedPchoff.sources,
      anchorRefs: cachedPchoff?.anchorRefs || extractedPchoff.anchorRefs,
      resonance: cachedPchoff?.resonance || extractedPchoff.resonance,
      temporal: cachedPchoff?.temporal || extractedPchoff.temporal,
    };

    pchoff.types?.forEach((type) => allMarkers.types.add(type));
    pchoff.insights?.forEach((insight) => allMarkers.insights.add(insight));
    pchoff.levels?.forEach((level) => allMarkers.levels.add(level));
    pchoff.patterns?.forEach((pattern) => allMarkers.patterns.add(pattern));
    pchoff.sources?.forEach((source) => allMarkers.sources.add(source));
    pchoff.resonance?.forEach((resonance) =>
      allMarkers.resonance.add(resonance),
    );
    pchoff.temporal?.forEach((temporal) => allMarkers.temporal.add(temporal));
  }

  return {
    types: [...allMarkers.types].sort(),
    insights: [...allMarkers.insights].sort(),
    levels: [...allMarkers.levels].sort(),
    patterns: [...allMarkers.patterns].sort(),
    sources: [...allMarkers.sources].sort(),
    resonance: [...allMarkers.resonance].sort(),
    temporal: [...allMarkers.temporal].sort(),
  };
}

/**
 * Check if a conversation matches PCHOFF search criteria
 */
export function matchesPCHOFFCriteria(
  metadata: PCHOFFMetadata | undefined,
  criteria: {
    pchoffType?: string | string[];
    pchoffInsight?: string | string[];
    pchoffLevel?: string | string[];
    pchoffPattern?: string | string[];
    pchoffSource?: string | string[];
  },
): boolean {
  if (!metadata) return false;

  // Helper to check if any value in array matches any filter
  const arrayMatchesFilter = (
    values: string[] | undefined,
    filter: string | string[] | undefined,
  ): boolean => {
    if (!filter || !values || values.length === 0) return !filter; // No filter = match all

    const filterArray = Array.isArray(filter) ? filter : [filter];
    return values.some((value) => filterArray.includes(value));
  };

  return (
    arrayMatchesFilter(metadata.types, criteria.pchoffType) &&
    arrayMatchesFilter(metadata.insights, criteria.pchoffInsight) &&
    arrayMatchesFilter(metadata.levels, criteria.pchoffLevel) &&
    arrayMatchesFilter(metadata.patterns, criteria.pchoffPattern) &&
    arrayMatchesFilter(metadata.sources, criteria.pchoffSource)
  );
}
