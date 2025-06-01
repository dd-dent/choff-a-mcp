export type AnchorType = 'decision' | 'blocker' | 'breakthrough' | 'question';

export interface SemanticAnchor {
  id: string;
  type: AnchorType;
  text: string; // The actual text that represents the anchor
  confidence: number; // 0-1 confidence score
  position: {
    start: number;
    end: number;
  };

  // Optional metadata
  rationale?: string; // For decisions
  requiresAnswer?: boolean; // For questions
  answersQuestion?: string; // ID of question this answers
  relatedTo?: string[]; // IDs of related anchors
  choffContext?: string; // CHOFF state/context if present

  // Extraction metadata
  extractedAt: Date;
  extractionMethod: 'choff' | 'regex' | 'keyword' | 'nlp';
}

export interface AnchorExtractionConfig {
  // Confidence thresholds
  minConfidence?: number; // Default 0.5

  // Pattern weights for confidence calculation
  weights?: {
    choffMarker: number; // Weight for CHOFF state/pattern markers (default 0.9)
    explicitPhrase: number; // Weight for explicit phrases like "decided" (default 0.8)
    contextClue: number; // Weight for contextual clues (default 0.6)
    punctuation: number; // Weight for punctuation clues like "?" (default 0.7)
  };

  // Extraction options
  includeRelationships?: boolean; // Extract relationships between anchors
  mergeAdjacentAnchors?: boolean; // Merge anchors that are very close
  maxAnchorsPerType?: number; // Limit anchors per type
}

export interface AnchorPattern {
  type: AnchorType;
  patterns: RegExp[];
  confidenceBase: number;
  extractRationale?: boolean; // Whether to extract rationale from pattern
}

// Predefined patterns for anchor detection
export const ANCHOR_PATTERNS: AnchorPattern[] = [
  // Questions first to avoid being overridden by decision patterns
  {
    type: 'question',
    confidenceBase: 0.7,
    patterns: [
      /\b((should|could|would|can|will)\s+(?:we|i|the team)\s+(.+?))\?/gi,
      /\b((what|how|why|when|where|which)\s+(.+?))\?/gi,
      /\b(the (?:main |key )?question\s+(?:is|remains)\s*(whether|if|how)?\s*(.+?))(?:\.|$)/gi,
      /\b((wondering|considering|thinking about)\s+(?:whether|if|how)\s+(.+?))(?:\.|$)/gi,
    ],
  },
  {
    type: 'decision',
    confidenceBase: 0.8,
    extractRationale: true,
    patterns: [
      /\b((we |i |the team )?(decided|chose|selected|opted|will go with|going with|agreed)\s+(?:to\s+)?([^\n.]+?))(?=\.|\n|$)/gi,
      /\b((decision|choice|selection):\s*(.+?))(?:\.|$)/gi,
      /\b((after\s+(?:discussion|consideration|analysis|reviewing))[,\s]+(.+?)\s+(was chosen|was selected|is the choice))(?:\.|$)/gi,
      /\b((conclusion|final(?:ly)?|ultimately)[:\s]+(.+?))(?:\.|$)/gi,
      /\b((?:i think |probably )?(?:we should|we will|should)\s+(?:probably\s+)?(.+?))(?=\.|$|\.\s|\n)/gi,
      /\b((.+?)\s+(?:would be|is|seems|appears to be)\s+(?:ideal|perfect|the best choice|the right choice))(?=\.|$|\.\s|\n)/gi,
    ],
  },
  {
    type: 'blocker',
    confidenceBase: 0.75,
    patterns: [
      /\b((stuck|blocked|cannot proceed|waiting for|preventing progress)\s+(?:on|by|until)?\s*(.+?))(?:\.|$)/gi,
      /\b((blocker|impediment|obstacle):\s*(.+?))(?:\.|$)/gi,
      /\b((the (?:main |primary )?(?:issue|problem|challenge))\s+(?:is|preventing|blocking)\s*(.+?))(?:\.|$)/gi,
      /\b((need(?:s|ed)?|require(?:s|d)?|must have)\s+(.+?)\s+(?:before|to proceed|to continue))/gi,
    ],
  },
  {
    type: 'breakthrough',
    confidenceBase: 0.8,
    patterns: [
      /\b((found|discovered|realized|solved|fixed)\s+(?:the\s+)?(?:solution|answer|issue|problem)?:?\s*(.+?))(?:\.|$)/gi,
      /\b((breakthrough|eureka|aha moment):\s*(.+?))(?:\.|$)/gi,
      /\b((the (?:solution|fix|answer))\s+(?:is|was|turned out to be)\s*(.+?))(?:\.|$)/gi,
      /\b((resolved|addressed|handled)\s+(?:by|through|with)\s*(.+?))(?:\.|$)/gi,
    ],
  },
];

// Add implicit decision patterns with lower confidence
ANCHOR_PATTERNS.push({
  type: 'decision',
  confidenceBase: 0.6, // Lower confidence for implicit
  extractRationale: true,
  patterns: [
    /\b((?:i think |probably )?(?:we should|should)\s+(?:probably\s+)?(.+?))(?=\.|$|\.\s|\n)/gi,
  ],
});

// CHOFF state/pattern mappings for higher confidence
export const CHOFF_ANCHOR_MAPPINGS: Record<
  string,
  { type: AnchorType; confidence: number }
> = {
  // States
  decisive: { type: 'decision', confidence: 0.95 },
  decided: { type: 'decision', confidence: 0.95 },
  choosing: { type: 'decision', confidence: 0.85 },
  blocked: { type: 'blocker', confidence: 0.95 },
  stuck: { type: 'blocker', confidence: 0.95 },
  waiting: { type: 'blocker', confidence: 0.85 },
  eureka: { type: 'breakthrough', confidence: 0.98 },
  breakthrough: { type: 'breakthrough', confidence: 0.95 },
  solved: { type: 'breakthrough', confidence: 0.9 },
  questioning: { type: 'question', confidence: 0.9 },
  curious: { type: 'question', confidence: 0.85 },
  uncertain: { type: 'question', confidence: 0.8 },

  // Pattern categories
  decision: { type: 'decision', confidence: 0.9 },
  choice: { type: 'decision', confidence: 0.9 },
  selection: { type: 'decision', confidence: 0.85 },
  development: { type: 'blocker', confidence: 0.85 }, // When status is blocked
  impediment: { type: 'blocker', confidence: 0.9 },
  obstacle: { type: 'blocker', confidence: 0.9 },
  solution: { type: 'breakthrough', confidence: 0.9 },
  resolution: { type: 'breakthrough', confidence: 0.85 },
  inquiry: { type: 'question', confidence: 0.85 },
  exploration: { type: 'question', confidence: 0.8 },
};
