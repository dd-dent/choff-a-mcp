import { CHOFFParser } from '../parser/index.js';
import { CHOFFDocument } from '../parser/types.js';
import {
  SemanticAnchor,
  AnchorType,
  AnchorExtractionConfig,
  ANCHOR_PATTERNS,
  CHOFF_ANCHOR_MAPPINGS,
} from './types.js';

export class SemanticAnchorDetector {
  private parser: CHOFFParser;
  private config: Required<AnchorExtractionConfig>;
  private anchorIdCounter = 0;

  constructor(config: AnchorExtractionConfig = {}) {
    this.parser = new CHOFFParser();
    this.config = {
      minConfidence: config.minConfidence ?? 0.5,
      weights: {
        choffMarker: config.weights?.choffMarker ?? 0.9,
        explicitPhrase: config.weights?.explicitPhrase ?? 0.8,
        contextClue: config.weights?.contextClue ?? 0.6,
        punctuation: config.weights?.punctuation ?? 0.7,
      },
      includeRelationships: config.includeRelationships ?? true,
      mergeAdjacentAnchors: config.mergeAdjacentAnchors ?? true,
      maxAnchorsPerType: config.maxAnchorsPerType ?? 100,
    };
  }

  /**
   * Extract semantic anchors from text content
   */
  extract(content: string): SemanticAnchor[] {
    if (!content.trim()) {
      return [];
    }

    const anchors: SemanticAnchor[] = [];

    // First, parse CHOFF document
    const choffDoc = this.parser.parse(content);

    // Extract anchors from CHOFF markers
    anchors.push(...this.extractFromCHOFF(choffDoc, content));

    // Extract anchors from text patterns
    anchors.push(...this.extractFromPatterns(content, choffDoc));

    // Extract relationships if enabled
    if (this.config.includeRelationships) {
      this.extractRelationships(anchors, content);
    }

    // Merge adjacent anchors if enabled
    if (this.config.mergeAdjacentAnchors) {
      return this.mergeAdjacent(anchors, content);
    }

    // Filter by confidence and limit per type
    return this.filterAndLimit(anchors);
  }

  /**
   * Extract anchors from CHOFF markers
   */
  private extractFromCHOFF(
    choffDoc: CHOFFDocument,
    fullText: string,
  ): SemanticAnchor[] {
    const anchors: SemanticAnchor[] = [];

    // Process state markers
    for (const state of choffDoc.states) {
      // Only handle simple states for now (most common case)
      if (state.type !== 'simple') continue;

      const mapping = this.findCHOFFMapping(state.value);
      if (mapping) {
        // Find surrounding text for context
        const contextText = this.extractSurroundingText(
          fullText,
          state.position.end,
          100, // Look ahead 100 chars
        );

        anchors.push({
          id: this.generateAnchorId(),
          type: mapping.type,
          text: contextText.text,
          confidence: mapping.confidence,
          position: {
            start: state.position.start,
            end: state.position.start + contextText.text.length,
          },
          choffContext: state.value,
          extractedAt: new Date(),
          extractionMethod: 'choff',
        });
      }
    }

    // Process pattern markers
    for (const pattern of choffDoc.patterns) {
      const mapping = this.findCHOFFMapping(pattern.category);
      if (mapping) {
        const contextText = this.extractSurroundingText(
          fullText,
          pattern.position.end,
          100,
        );

        anchors.push({
          id: this.generateAnchorId(),
          type: mapping.type,
          text: contextText.text,
          confidence: mapping.confidence * 0.9, // Slightly lower for patterns
          position: {
            start: pattern.position.start,
            end: pattern.position.start + contextText.text.length,
          },
          choffContext: pattern.category,
          extractedAt: new Date(),
          extractionMethod: 'choff',
        });
      }

      // Also check the flow field for pattern markers (if present)
      if (pattern.flow && !mapping) {
        const flowMapping = this.findCHOFFMapping(pattern.flow);
        if (flowMapping) {
          // Don't double-add
          const contextText = this.extractSurroundingText(
            fullText,
            pattern.position.end,
            100,
          );

          anchors.push({
            id: this.generateAnchorId(),
            type: flowMapping.type,
            text: contextText.text,
            confidence: flowMapping.confidence * 0.85,
            position: {
              start: pattern.position.start,
              end: pattern.position.start + contextText.text.length,
            },
            choffContext: pattern.flow,
            extractedAt: new Date(),
            extractionMethod: 'choff',
          });
        }
      }
    }

    return anchors;
  }

  /**
   * Extract anchors using regex patterns
   */
  private extractFromPatterns(
    content: string,
    choffDoc: CHOFFDocument,
  ): SemanticAnchor[] {
    const anchors: SemanticAnchor[] = [];
    const processedRanges = new Set<string>(); // Avoid duplicate extractions

    for (const anchorPattern of ANCHOR_PATTERNS) {
      for (const pattern of anchorPattern.patterns) {
        const regex = new RegExp(pattern.source, pattern.flags);
        let match;

        while ((match = regex.exec(content)) !== null) {
          // In a while loop with !== null check, match.index is guaranteed to be a number
          const matchIndex = match.index;
          const rangeKey = `${matchIndex}-${matchIndex + match[0].length}`;
          if (processedRanges.has(rangeKey)) {
            continue;
          }
          processedRanges.add(rangeKey);

          // Calculate confidence based on various factors
          let confidence = anchorPattern.confidenceBase;

          // Boost confidence if within CHOFF context
          if (this.isWithinCHOFFContext(matchIndex, choffDoc)) {
            confidence *=
              this.config.weights.choffMarker /
              this.config.weights.explicitPhrase;
          }

          // Extract the main content (usually in capture group 1 for full match)
          const text = match[1] || match[0];

          const anchor: SemanticAnchor = {
            id: this.generateAnchorId(),
            type: anchorPattern.type,
            text: text.trim(),
            confidence,
            position: {
              start: matchIndex,
              end: matchIndex + match[0].length,
            },
            extractedAt: new Date(),
            extractionMethod: 'regex',
          };

          // Extract rationale for decisions if present
          if (
            anchorPattern.extractRationale &&
            anchorPattern.type === 'decision'
          ) {
            const rationale = this.extractRationale(
              content,
              matchIndex + match[0].length,
            );
            if (rationale) {
              anchor.rationale = rationale;
            }
          }

          // Mark questions as requiring answers
          if (anchorPattern.type === 'question') {
            anchor.requiresAnswer = true;
          }

          anchors.push(anchor);
        }
      }
    }

    return anchors;
  }

  /**
   * Extract relationships between anchors
   */
  private extractRelationships(
    anchors: SemanticAnchor[],
    content: string,
  ): void {
    // Look for directional operators connecting anchors
    const directionalPattern = /→|←|↔|↠|⇄/g;
    let match;

    while ((match = directionalPattern.exec(content)) !== null) {
      // In a while loop with !== null check, match.index is guaranteed to be a number
      const matchIndex = match.index;
      const beforeAnchor = this.findAnchorBefore(anchors, matchIndex);
      const afterAnchor = this.findAnchorAfter(
        anchors,
        matchIndex + match[0].length,
      );

      if (beforeAnchor && afterAnchor) {
        // Create bidirectional relationship
        if (!afterAnchor.relatedTo) afterAnchor.relatedTo = [];
        if (!beforeAnchor.relatedTo) beforeAnchor.relatedTo = [];

        afterAnchor.relatedTo.push(beforeAnchor.id);

        // If decision → breakthrough, mark the breakthrough as solving the decision
        if (
          beforeAnchor.type === 'decision' &&
          afterAnchor.type === 'breakthrough'
        ) {
          afterAnchor.confidence = Math.min(1, afterAnchor.confidence * 1.1);
        }

        // If question → decision, mark decision as answering the question
        if (
          beforeAnchor.type === 'question' &&
          afterAnchor.type === 'decision'
        ) {
          afterAnchor.answersQuestion = beforeAnchor.id;
          beforeAnchor.requiresAnswer = false;
        }
      }
    }

    // Also look for conversational patterns (question followed by answer)
    for (let i = 0; i < anchors.length - 1; i++) {
      const current = anchors[i];
      const next = anchors[i + 1];

      // If question followed by decision within reasonable distance
      if (current.type === 'question' && next.type === 'decision') {
        const distance = next.position.start - current.position.end;
        if (distance < 200) {
          // Within ~200 chars
          next.answersQuestion = current.id;
          current.requiresAnswer = false;
        }
      }
    }
  }

  /**
   * Merge adjacent anchors of the same type
   */
  private mergeAdjacent(
    anchors: SemanticAnchor[],
    content: string,
  ): SemanticAnchor[] {
    const sorted = anchors.sort((a, b) => a.position.start - b.position.start);
    const merged: SemanticAnchor[] = [];

    for (let i = 0; i < sorted.length; i++) {
      const current = sorted[i];

      // Look for adjacent anchor of same type
      if (i < sorted.length - 1) {
        const next = sorted[i + 1];
        const gap = next.position.start - current.position.end;

        // Check if there's text between the anchors
        const textBetween = content.substring(
          current.position.end,
          next.position.start,
        );

        // Don't merge if:
        // 1. Gap is too large (> 50 chars)
        // 2. There's a sentence boundary (period) between them
        // 3. They're different types
        const hasSentenceBoundary = textBetween.includes('.');

        if (current.type === next.type && gap < 50 && !hasSentenceBoundary) {
          merged.push({
            ...current,
            text: current.text + ' ' + next.text,
            position: {
              start: current.position.start,
              end: next.position.end,
            },
            confidence: Math.max(current.confidence, next.confidence),
            relatedTo: [
              ...(current.relatedTo || []),
              ...(next.relatedTo || []),
            ],
          });
          i++; // Skip next anchor
          continue;
        }
      }

      merged.push(current);
    }

    return merged;
  }

  /**
   * Filter by confidence and limit per type
   */
  private filterAndLimit(anchors: SemanticAnchor[]): SemanticAnchor[] {
    // Filter by minimum confidence
    const filtered = anchors.filter(
      (a) => a.confidence >= this.config.minConfidence,
    );

    // Group by type and limit
    const byType = new Map<AnchorType, SemanticAnchor[]>();
    for (const anchor of filtered) {
      if (!byType.has(anchor.type)) {
        byType.set(anchor.type, []);
      }
      byType.get(anchor.type)!.push(anchor);
    }

    // Sort each type by confidence and take top N
    const limited: SemanticAnchor[] = [];
    for (const [, typeAnchors] of byType) {
      const sorted = typeAnchors.sort((a, b) => b.confidence - a.confidence);
      limited.push(...sorted.slice(0, this.config.maxAnchorsPerType));
    }

    return limited.sort((a, b) => a.position.start - b.position.start);
  }

  // Helper methods

  private findCHOFFMapping(
    value: string,
  ): { type: AnchorType; confidence: number } | null {
    const normalized = value.toLowerCase();
    return CHOFF_ANCHOR_MAPPINGS[normalized] || null;
  }

  private extractSurroundingText(
    text: string,
    startPos: number,
    maxLength: number,
  ): { text: string } {
    // Find sentence boundaries
    const start = startPos;
    let end = Math.min(startPos + maxLength, text.length);

    // Look for sentence end
    const sentenceEnd = text.indexOf('.', startPos);
    if (sentenceEnd !== -1 && sentenceEnd < end) {
      end = sentenceEnd + 1;
    }

    return { text: text.substring(start, end).trim() };
  }

  private isWithinCHOFFContext(
    position: number,
    choffDoc: CHOFFDocument,
  ): boolean {
    // Check if position is near any CHOFF marker
    const threshold = 50; // characters

    for (const state of choffDoc.states) {
      if (Math.abs(position - state.position.end) < threshold) {
        return true;
      }
    }

    for (const context of choffDoc.contexts) {
      if (Math.abs(position - context.position.end) < threshold) {
        return true;
      }
    }

    return false;
  }

  private extractRationale(content: string, startPos: number): string | null {
    const rationalePattern =
      /\b(because|since|due to|as|given that)\s+(.+?)(?:\.|$)/i;
    // Look both within the match and shortly after
    const searchStart = Math.max(0, startPos - 100);
    const searchText = content.substring(
      searchStart,
      Math.min(startPos + 200, content.length),
    );
    const match = rationalePattern.exec(searchText);

    return match ? match[2].trim() : null;
  }

  private findAnchorBefore(
    anchors: SemanticAnchor[],
    position: number,
  ): SemanticAnchor | null {
    const candidates = anchors.filter((a) => a.position.end <= position);
    return candidates.length > 0
      ? candidates.reduce((closest, current) =>
          current.position.end > closest.position.end ? current : closest,
        )
      : null;
  }

  private findAnchorAfter(
    anchors: SemanticAnchor[],
    position: number,
  ): SemanticAnchor | null {
    const candidates = anchors.filter((a) => a.position.start >= position);
    return candidates.length > 0
      ? candidates.reduce((closest, current) =>
          current.position.start < closest.position.start ? current : closest,
        )
      : null;
  }

  private generateAnchorId(): string {
    return `anchor_${Date.now()}_${++this.anchorIdCounter}`;
  }
}

/**
 * Convenience function for extracting anchors
 */
export function extractSemanticAnchors(
  content: string,
  config?: AnchorExtractionConfig,
): SemanticAnchor[] {
  const detector = new SemanticAnchorDetector(config);
  return detector.extract(content);
}
