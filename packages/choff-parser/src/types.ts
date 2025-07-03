// Position tracking for all markers
export interface Position {
  start: number;
  end: number;
}

// Base marker interface
export interface BaseMarker {
  position: Position;
  raw: string;
}

// State marker types
export type StateType = 'simple' | 'intensity' | 'weighted' | 'random';

export interface SimpleState extends BaseMarker {
  type: 'simple';
  value: string;
}

export interface IntensityState extends BaseMarker {
  type: 'intensity';
  values: Array<{
    state: string;
    intensity: number;
  }>;
}

export interface WeightedState extends BaseMarker {
  type: 'weighted';
  values: Array<{
    state: string;
    weight: number;
  }>;
}

export interface RandomState extends BaseMarker {
  type: 'random';
  values: Array<{
    state: string;
    weight: number;
  }>;
}

export type StateMarker =
  | SimpleState
  | IntensityState
  | WeightedState
  | RandomState;

// Context marker
export interface ContextMarker extends BaseMarker {
  value: string;
}

// Pattern markers
export interface PatternMarker extends BaseMarker {
  type: 'pattern' | 'status';
  category: string;
  flow: string | null;
}

// Directional operators
export interface DirectionalOperator extends BaseMarker {
  type: 'forward' | 'backward' | 'bidirectional' | 'transition' | 'cascade';
  enhanced?: boolean;
}

// Branch markers
export interface BranchInit extends BaseMarker {
  type: 'init';
  id: string;
  label?: string;
}

export interface BranchMerge extends BaseMarker {
  type: 'merge';
  id: string;
}

export interface BranchEnd extends BaseMarker {
  type: 'end';
  id: string;
}

export type BranchMarker = BranchInit | BranchMerge | BranchEnd;

// Social layer
export interface SocialLayer extends BaseMarker {
  level: string;
  mask?: string;
}

// Parsing errors
export interface ParseError {
  message: string;
  position: Position;
  type: 'syntax' | 'validation';
}

// Complete parsed document
export interface CHOFFDocument {
  // Original text
  text: string;

  // Extracted markers
  states: StateMarker[];
  contexts: ContextMarker[];
  patterns: PatternMarker[];
  directionals: DirectionalOperator[];
  branches: BranchMarker[];
  socialLayers: SocialLayer[];

  // Parsing metadata
  errors: ParseError[];
  parseTime: number;

  // Document-level analysis
  statistics: {
    totalMarkers: number;
    markerDensity: number; // markers per 100 chars
    dominantStateType?: StateType;
    branchComplexity: number; // 0-1 based on branch depth
  };
}
