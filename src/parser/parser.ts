import {
  CHOFFDocument,
  StateMarker,
  ContextMarker,
  PatternMarker,
  DirectionalOperator,
  BranchMarker,
  BranchInit,
  SocialLayer,
  ParseError,
  Position,
  StateType,
} from './types.js';

export class CHOFFParser {
  private text: string = '';
  private position: number = 0;
  private errors: ParseError[] = [];

  // Regular expressions for different CHOFF elements
  private readonly patterns = {
    // State patterns
    simpleState: /\{state:([a-zA-Z_]+)\}/g,
    intensityState: /\{state:intensity\|((?:[a-zA-Z_]+\[\d+\.?\d*\]\|)*)\}/g,
    weightedState:
      /\{state:weighted(?::([a-zA-Z_]+))?\|((?:[a-zA-Z_]+(?:\[\d+\.?\d*\])?\|)*)\}/g,
    randomState: /\{state:random!((?:[a-zA-Z_]+\[\d+\.?\d*\]!)*)\}/g,

    // Context pattern
    context: /\[context:([a-zA-Z_]+)\]/g,

    // Pattern markers
    pattern: /&pattern:([a-zA-Z_]+)\|([a-zA-Z_]+)\|/g,
    status: /&status:([a-zA-Z_]+)\|/g,

    // Directional operators - order matters (check enhanced first)
    enhancedForward: /⇉/g,
    enhancedBackward: /⇇/g,
    enhancedBidirectional: /⇋/g,
    strongBilateral: /↔↔/g,
    strongForward: /→→/g,
    strongBackward: /←←/g,
    cascade: /⇄/g,
    transition: /↠/g,
    bidirectional: /↔/g,
    forward: /→/g,
    backward: /←/g,

    // Branch markers
    branchInit: /\{branch:([a-zA-Z0-9_]+)(?:\|([^}]+))?\}/g,
    branchMerge: /→merge\{branch:([a-zA-Z0-9_]+)\}/g,
    branchEnd: /\{branch_end:([a-zA-Z0-9_]+)\}/g,

    // Social layer
    socialLayer: /\{social:([a-zA-Z_]+)\}(?:\[mask:([a-zA-Z_]+)\])?/g,
  };

  parse(text: string): CHOFFDocument {
    const startTime = performance.now();
    this.text = text;
    this.position = 0;
    this.errors = [];

    const document: CHOFFDocument = {
      text,
      states: [],
      contexts: [],
      patterns: [],
      directionals: [],
      branches: [],
      socialLayers: [],
      errors: [],
      parseTime: 0,
      statistics: {
        totalMarkers: 0,
        markerDensity: 0,
        branchComplexity: 0,
      },
    };

    // Parse all elements
    document.states = this.parseStates();
    document.contexts = this.parseContexts();
    document.patterns = this.parsePatterns();
    document.directionals = this.parseDirectionals();
    document.branches = this.parseBranches();
    document.socialLayers = this.parseSocialLayers();

    // Calculate statistics
    const totalMarkers =
      document.states.length +
      document.contexts.length +
      document.patterns.length +
      document.directionals.length +
      document.branches.length +
      document.socialLayers.length;

    document.statistics = {
      totalMarkers,
      markerDensity: (totalMarkers / text.length) * 100,
      dominantStateType: this.calculateDominantStateType(document.states),
      branchComplexity: this.calculateBranchComplexity(document.branches),
    };

    document.errors = this.errors;
    document.parseTime = performance.now() - startTime;

    return document;
  }

  private parseStates(): StateMarker[] {
    const states: StateMarker[] = [];

    // Parse simple states
    this.patterns.simpleState.lastIndex = 0;
    let match;
    while ((match = this.patterns.simpleState.exec(this.text))) {
      states.push({
        type: 'simple',
        value: match[1],
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    // Parse intensity states
    this.patterns.intensityState.lastIndex = 0;
    while ((match = this.patterns.intensityState.exec(this.text))) {
      const values = this.parseIntensityValues(match[1]);
      states.push({
        type: 'intensity',
        values,
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    // Parse weighted states
    this.patterns.weightedState.lastIndex = 0;
    while ((match = this.patterns.weightedState.exec(this.text))) {
      const shorthandState = match[1];
      const valuesPart = match[2];
      const values = this.parseWeightedValues(valuesPart, shorthandState);

      // Validate weights sum to 1.0
      const sum = values.reduce((acc, v) => acc + v.weight, 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        this.errors.push({
          message: `Weighted state values must sum to 1.0, got ${sum}`,
          position: { start: match.index, end: match.index + match[0].length },
          type: 'validation',
        });
      }

      states.push({
        type: 'weighted',
        values,
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    // Parse random states
    this.patterns.randomState.lastIndex = 0;
    while ((match = this.patterns.randomState.exec(this.text))) {
      const values = this.parseRandomValues(match[1]);

      // Validate weights sum to 1.0
      const sum = values.reduce((acc, v) => acc + v.weight, 0);
      if (Math.abs(sum - 1.0) > 0.001) {
        this.errors.push({
          message: `Random state values must sum to 1.0, got ${sum}`,
          position: { start: match.index, end: match.index + match[0].length },
          type: 'validation',
        });
      }

      states.push({
        type: 'random',
        values,
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    // Check for malformed states
    const malformedPattern = /\{state:\s*\}|\{state:\s+[^}]*\}|\{state:[^}]*$/g;
    malformedPattern.lastIndex = 0;
    while ((match = malformedPattern.exec(this.text))) {
      this.errors.push({
        message: 'Malformed state marker',
        position: { start: match.index, end: match.index + match[0].length },
        type: 'syntax',
      });
    }

    // Check for nested structures in states (not allowed)
    const nestedPattern = /\{state:[^}]*\{[^}]*\}[^}]*\}/g;
    nestedPattern.lastIndex = 0;
    while ((match = nestedPattern.exec(this.text))) {
      this.errors.push({
        message: 'Nested structures are not allowed within state markers',
        position: { start: match.index, end: match.index + match[0].length },
        type: 'syntax',
      });

      // Try to parse it anyway as a weighted state, treating the nested part as text
      const weightedMatch = /\{state:weighted\|(.+)\}/g.exec(match[0]);
      if (weightedMatch) {
        // Create a simplified version without the nested structure
        const simplifiedValues = weightedMatch[1].replace(
          /\{[^}]*\}/g,
          'nested',
        );
        const values = this.parseWeightedValues(simplifiedValues);

        states.push({
          type: 'weighted',
          values,
          position: { start: match.index, end: match.index + match[0].length },
          raw: match[0],
        });
      }
    }

    return states.sort((a, b) => a.position.start - b.position.start);
  }

  private parseIntensityValues(
    valuesPart: string,
  ): Array<{ state: string; intensity: number }> {
    const values: Array<{ state: string; intensity: number }> = [];
    const valuePattern = /([a-zA-Z_]+)\[(\d+\.?\d*)\]/g;
    let valueMatch;

    while ((valueMatch = valuePattern.exec(valuesPart))) {
      values.push({
        state: valueMatch[1],
        intensity: parseFloat(valueMatch[2]),
      });
    }

    return values;
  }

  private parseWeightedValues(
    valuesPart: string,
    shorthandState?: string,
  ): Array<{ state: string; weight: number }> {
    const values: Array<{ state: string; weight: number }> = [];
    const valuePattern = /([a-zA-Z_]+)(?:\[(\d+\.?\d*)\])?/g;
    let valueMatch;
    let totalSpecifiedWeight = 0;
    const statesInOrder: Array<{
      state: string;
      hasWeight: boolean;
      weight?: number;
    }> = [];

    // If we have a shorthand state, add it first
    if (shorthandState) {
      statesInOrder.push({ state: shorthandState, hasWeight: false });
    }

    while ((valueMatch = valuePattern.exec(valuesPart))) {
      if (valueMatch[1]) {
        // Skip empty matches
        if (valueMatch[2]) {
          // Has explicit weight
          const weight = parseFloat(valueMatch[2]);
          statesInOrder.push({ state: valueMatch[1], hasWeight: true, weight });
          totalSpecifiedWeight += weight;
        } else {
          // No explicit weight
          statesInOrder.push({ state: valueMatch[1], hasWeight: false });
        }
      }
    }

    // Count unspecified states
    const unspecifiedCount = statesInOrder.filter((s) => !s.hasWeight).length;

    // Distribute remaining weight equally among unspecified states
    const remainingWeight = 1.0 - totalSpecifiedWeight;
    const weightPerState =
      unspecifiedCount > 0 ? remainingWeight / unspecifiedCount : 0;

    // Build final values array in order
    for (const item of statesInOrder) {
      values.push({
        state: item.state,
        weight: item.hasWeight ? item.weight! : weightPerState,
      });
    }

    return values;
  }

  private parseRandomValues(
    valuesPart: string,
  ): Array<{ state: string; weight: number }> {
    const values: Array<{ state: string; weight: number }> = [];
    const valuePattern = /([a-zA-Z_]+)\[(\d+\.?\d*)\]/g;
    let valueMatch;

    while ((valueMatch = valuePattern.exec(valuesPart))) {
      values.push({
        state: valueMatch[1],
        weight: parseFloat(valueMatch[2]),
      });
    }

    return values;
  }

  private parseContexts(): ContextMarker[] {
    const contexts: ContextMarker[] = [];
    this.patterns.context.lastIndex = 0;
    let match;

    while ((match = this.patterns.context.exec(this.text))) {
      contexts.push({
        value: match[1],
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    // Check for invalid curly brace patterns that aren't valid CHOFF
    const invalidCurlyPattern =
      /\{(?!state:|branch:|branch_end:|social:)[^}]*\}/g;
    invalidCurlyPattern.lastIndex = 0;
    while ((match = invalidCurlyPattern.exec(this.text))) {
      this.errors.push({
        message: 'Invalid marker syntax',
        position: { start: match.index, end: match.index + match[0].length },
        type: 'syntax',
      });
    }

    // Check for malformed contexts
    const malformedPattern =
      /\[context:\s*\]|\[context:\s+[^\]]*\]|\[context:[^\]]*$/g;
    malformedPattern.lastIndex = 0;
    while ((match = malformedPattern.exec(this.text))) {
      this.errors.push({
        message: 'Malformed context marker',
        position: { start: match.index, end: match.index + match[0].length },
        type: 'syntax',
      });
    }

    return contexts;
  }

  private parsePatterns(): PatternMarker[] {
    const patterns: PatternMarker[] = [];

    // Parse dynamic patterns
    this.patterns.pattern.lastIndex = 0;
    let match;
    while ((match = this.patterns.pattern.exec(this.text))) {
      patterns.push({
        type: 'pattern',
        category: match[1],
        flow: match[2],
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    // Parse static status
    this.patterns.status.lastIndex = 0;
    while ((match = this.patterns.status.exec(this.text))) {
      patterns.push({
        type: 'status',
        category: match[1],
        flow: null,
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    return patterns.sort((a, b) => a.position.start - b.position.start);
  }

  private parseDirectionals(): DirectionalOperator[] {
    const directionals: DirectionalOperator[] = [];

    // First, get all branch merge positions to exclude them
    const branchMergePositions: Position[] = [];
    this.patterns.branchMerge.lastIndex = 0;
    let mergeMatch;
    while ((mergeMatch = this.patterns.branchMerge.exec(this.text))) {
      branchMergePositions.push({
        start: mergeMatch.index,
        end: mergeMatch.index + mergeMatch[0].length,
      });
    }

    // Enhanced operators (check these first)
    const enhancedChecks = [
      {
        pattern: this.patterns.enhancedForward,
        type: 'forward' as const,
        enhanced: true,
      },
      {
        pattern: this.patterns.enhancedBackward,
        type: 'backward' as const,
        enhanced: true,
      },
      {
        pattern: this.patterns.enhancedBidirectional,
        type: 'bidirectional' as const,
        enhanced: true,
      },
      {
        pattern: this.patterns.strongBilateral,
        type: 'bidirectional' as const,
        enhanced: true,
      },
      {
        pattern: this.patterns.strongForward,
        type: 'forward' as const,
        enhanced: true,
      },
      {
        pattern: this.patterns.strongBackward,
        type: 'backward' as const,
        enhanced: true,
      },
    ];

    for (const check of enhancedChecks) {
      check.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = check.pattern.exec(this.text))) {
        directionals.push({
          type: check.type,
          enhanced: check.enhanced,
          position: { start: match.index, end: match.index + match[0].length },
          raw: match[0],
        });
      }
    }

    // Basic operators
    const basicChecks = [
      { pattern: this.patterns.cascade, type: 'cascade' as const },
      { pattern: this.patterns.transition, type: 'transition' as const },
      { pattern: this.patterns.bidirectional, type: 'bidirectional' as const },
      { pattern: this.patterns.forward, type: 'forward' as const },
      { pattern: this.patterns.backward, type: 'backward' as const },
    ];

    for (const check of basicChecks) {
      check.pattern.lastIndex = 0;
      let match: RegExpExecArray | null;
      while ((match = check.pattern.exec(this.text))) {
        // Skip if this position was already matched by an enhanced operator
        const alreadyMatched = directionals.some(
          (d) =>
            d.position.start <= match.index && d.position.end > match.index,
        );

        // Skip if this is part of a branch merge
        const partOfBranchMerge = branchMergePositions.some(
          (pos) => match.index >= pos.start && match.index < pos.end,
        );

        if (!alreadyMatched && !partOfBranchMerge) {
          directionals.push({
            type: check.type,
            position: {
              start: match.index,
              end: match.index + match[0].length,
            },
            raw: match[0],
          });
        }
      }
    }

    return directionals.sort((a, b) => a.position.start - b.position.start);
  }

  private parseBranches(): BranchMarker[] {
    const branches: BranchMarker[] = [];

    // First parse merges to know what to exclude
    const mergePositions: Position[] = [];
    this.patterns.branchMerge.lastIndex = 0;
    let match;
    while ((match = this.patterns.branchMerge.exec(this.text))) {
      mergePositions.push({
        start: match.index,
        end: match.index + match[0].length,
      });
      branches.push({
        type: 'merge',
        id: match[1],
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    // Parse branch init, excluding those within merges
    this.patterns.branchInit.lastIndex = 0;
    let initMatch: RegExpExecArray | null;
    while ((initMatch = this.patterns.branchInit.exec(this.text))) {
      // Check if this init is within a merge
      const withinMerge = mergePositions.some(
        (pos) => initMatch.index >= pos.start && initMatch.index < pos.end,
      );

      if (!withinMerge) {
        const marker: BranchInit = {
          type: 'init',
          id: initMatch[1],
          position: {
            start: initMatch.index,
            end: initMatch.index + initMatch[0].length,
          },
          raw: initMatch[0],
        };

        if (initMatch[2]) {
          marker.label = initMatch[2];
        }

        branches.push(marker);
      }
    }

    // Already parsed merges above, no need to do it again

    // Parse branch end
    this.patterns.branchEnd.lastIndex = 0;
    while ((match = this.patterns.branchEnd.exec(this.text))) {
      branches.push({
        type: 'end',
        id: match[1],
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      });
    }

    return branches.sort((a, b) => a.position.start - b.position.start);
  }

  private parseSocialLayers(): SocialLayer[] {
    const socialLayers: SocialLayer[] = [];
    this.patterns.socialLayer.lastIndex = 0;
    let match;

    while ((match = this.patterns.socialLayer.exec(this.text))) {
      const layer: SocialLayer = {
        level: match[1],
        position: { start: match.index, end: match.index + match[0].length },
        raw: match[0],
      };

      if (match[2]) {
        layer.mask = match[2];
      }

      socialLayers.push(layer);
    }

    return socialLayers;
  }

  private calculateDominantStateType(
    states: StateMarker[],
  ): StateType | undefined {
    if (states.length === 0) return undefined;

    const typeCounts: Record<StateType, number> = {
      simple: 0,
      intensity: 0,
      weighted: 0,
      random: 0,
    };

    for (const state of states) {
      typeCounts[state.type]++;
    }

    let maxCount = 0;
    let dominantType: StateType | undefined;

    for (const [type, count] of Object.entries(typeCounts)) {
      if (count > maxCount) {
        maxCount = count;
        dominantType = type as StateType;
      }
    }

    return dominantType;
  }

  private calculateBranchComplexity(branches: BranchMarker[]): number {
    if (branches.length === 0) return 0;

    // Count unique branch IDs
    const uniqueIds = new Set(branches.map((b) => b.id));

    // Count init/end pairs (for future complexity calculations)
    // const initCount = branches.filter((b) => b.type === 'init').length;
    // const endCount = branches.filter((b) => b.type === 'end').length;
    // const mergeCount = branches.filter((b) => b.type === 'merge').length;

    // Simple complexity metric: ratio of branches to total markers
    const complexity = Math.min(1, uniqueIds.size / 10);

    return complexity;
  }
}
