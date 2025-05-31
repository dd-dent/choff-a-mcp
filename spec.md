# CHOFF-A-MCP (Anamnesis) Specification
{document:specification}[context:technical] {state:comprehensive[0.9]|structured[0.8]}

## Executive Summary
We're building an MCP server that gives Claude (and other AI assistants) persistent memory across sessions using CHOFF (Cognitive Hoffman Compression Framework) for structured context management. Think of it as Git for conversation state - every decision, blocker, and breakthrough gets tracked, versioned, and made searchable.

## Core Problem
{state:analytical} [context:problem_definition]
AI assistants have goldfish memory. Every new session starts from zero. We lose:
- Project decisions and their rationale
- Code evolution and debugging history  
- Semantic connections between conversations
- Team knowledge and context

## Solution Architecture
{state:decisive} [context:architecture]

### Phase 1: Local Memory
**Goal**: Prove the concept with minimal complexity
- JSON-based storage with CHOFF metadata extraction
- Basic checkpoint/restore functionality
- Simple keyword search
- Local MCP server running alongside Claude
- *Deliverable*: Working demo that remembers yesterday's conversation

### Phase 2: Semantic Intelligence  
**Goal**: Make memory actually smart
- Vector embeddings for semantic search (Pinecone)
- CHOFF parser with full v2.5 support
- Semantic anchor detection (Decisions, Blockers, Breakthroughs)
- Pattern recognition across conversations
- *Deliverable*: "What did we decide about the database?" returns the right answer

### Phase 3: Production Scale
**Goal**: Team-ready, cloud-deployed system
- Cloudflare Workers deployment
- GitHub integration for artifact versioning
- Multi-project context isolation
- Real-time collaboration features
- *Deliverable*: Multiple developers sharing context seamlessly

## Technical Stack
{state:technical} [context:implementation]
- **Language**: TypeScript (MCP SDK requirement)
- **Storage**: PostgreSQL + pgvector (Phase 2+)
- **Vector DB**: Pinecone (semantic search)
- **Deployment**: Cloud Run or Railway (Phase 3)
- **Testing**: Vitest with 100% coverage target
- **Linting**: ESLint + Prettier with pre-commit hooks

## Database Schema Design
{state:structured} [context:data_model]
```sql
-- Conversations table
CREATE TABLE conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL,
  content TEXT NOT NULL,
  choff_metadata JSONB NOT NULL,
  embedding vector(1536),
  embedding_model VARCHAR(255),
  embedding_version VARCHAR(50),
  token_count INTEGER NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Semantic anchors
CREATE TABLE semantic_anchors (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  type VARCHAR(50) NOT NULL, -- 'decision', 'blocker', 'breakthrough', 'question'
  content TEXT NOT NULL,
  confidence FLOAT NOT NULL CHECK (confidence >= 0 AND confidence <= 1),
  resolved_at TIMESTAMP,
  related_anchors UUID[] DEFAULT '{}',
  created_at TIMESTAMP DEFAULT NOW()
);

-- Branches for conversation flow
CREATE TABLE conversation_branches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES conversations(id),
  parent_branch_id UUID REFERENCES conversation_branches(id),
  branch_name VARCHAR(255),
  merge_status VARCHAR(50), -- 'active', 'merged', 'abandoned'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX idx_conversations_session ON conversations(session_id);
CREATE INDEX idx_conversations_choff ON conversations USING GIN (choff_metadata);
CREATE INDEX idx_conversations_embedding ON conversations USING hnsw (embedding vector_cosine_ops);
CREATE INDEX idx_anchors_type ON semantic_anchors(type);
CREATE INDEX idx_anchors_conversation ON semantic_anchors(conversation_id);
```

## Token Budget Management
{state:practical} [context:constraints]
```typescript
interface TokenBudget {
  maxTokens: number;              // Claude's context limit
  systemReserve: number;          // Reserved for system prompts
  
  allocate(entries: ContextEntry[]): ContextEntry[];
  count(text: string): number;
  
  // Priority-based allocation
  prioritize(entries: ContextEntry[]): {
    critical: ContextEntry[];    // Must include
    important: ContextEntry[];   // Should include
    optional: ContextEntry[];    // Nice to have
  };
}

## CHOFF Integration
{state:detailed} [context:choff_semantics]

### Semantic Anchors
```typescript
type SemanticAnchor = {
  id: string;
  type: 'decision' | 'blocker' | 'breakthrough' | 'question';
  content: string;
  confidence: number;
  timestamp: Date;
  resolution?: string;
  relatedAnchors: string[];
}
```

### CHOFF State Tracking
Every conversation entry includes:
- `{state:type}` - Current cognitive state
- `[context:domain]` - Problem domain context
- `&pattern:type|status|` - Recurring patterns
- `→` Directional markers for causal chains
- Branch tracking for parallel explorations

### Example Memory Entry
```json
{
  "id": "conv_2025_05_31_001",
  "content": "Decided to use PostgreSQL over MongoDB",
  "choff": {
    "state": "decisive",
    "context": "architecture",
    "confidence": 0.95
  },
  "anchor": {
    "type": "decision",
    "rationale": "ACID compliance required for financial data"
  },
  "embedding": {
    "vector": [0.123, 0.456, ...],
    "model": "openai/text-embedding-3-small",
    "version": "2024-01-25",
    "dimensions": 1536
  },
  "tokens": 127,
  "timestamp": "2025-05-31T10:45:00Z"
}
```

## API Design
{state:structured} [context:api]

### Core MCP Tools
```typescript
// Save conversation checkpoint
saveCheckpoint({
  content: string,
  extractAnchors?: boolean,
  generateSummary?: boolean
}) → CheckpointId

// Load relevant context
loadContext({
  query?: string,
  timeRange?: TimeRange,
  anchorsOnly?: boolean,
  maxTokens?: number
}) → Context[]

// Track progress
updateProgress({
  phase: string,
  status: string,
  blockers?: string[]
}) → void

// Generate handoff document
createHandoff({
  targetBranch?: string,
  includeCode?: boolean
}) → HandoffDocument
```

### Error Handling Pattern
```typescript
type ToolResult<T> = {
  success: boolean;
  data?: T;
  error?: {
    code: string;
    message: string;
    details?: any;
    retryable?: boolean;
  };
  metadata?: {
    tokensUsed: number;
    latencyMs: number;
  };
}
```

## Success Metrics
{state:measurable} [context:goals]
1. **Context Retrieval Speed**: <200ms for semantic search
2. **Relevance Score**: Measurable improvement over keyword search with continuous iteration
3. **Developer Adoption**: Active usage across multiple team members
4. **Memory Efficiency**: <5MB per 1000 conversations
5. **Zero Data Loss**: Full backup/restore capability

## Security & Privacy
{state:security_conscious} [context:requirements]
- All conversation data encrypted at rest
- API key rotation every 90 days
- Audit logging for all access
- GDPR-compliant data retention
- Automatic PII detection and masking

## Testing Strategy
{state:tdd_focused} [context:quality]
**THE ROBOTS LOVE TDD!** Every feature follows:
1. Write failing test describing desired behavior
2. Implement minimal code to pass
3. Refactor for clarity and performance
4. Integration tests for MCP protocol compliance
5. End-to-end tests with real Claude interactions

## Non-Goals
{state:focused} [context:scope]
- General purpose memory for all AI tools (MCP-specific)
- Real-time collaboration editing (async handoffs only)
- Natural language memory queries (structured tools only)
- Automatic conversation summarization (explicit checkpoints)

## Future Possibilities
{state:visionary} [context:roadmap]
- Visual conversation graph navigation
- Automatic PR generation from decisions
- Team knowledge base aggregation
- Cross-project pattern detection
- "Replay" mode for onboarding

---
*"Memory is the treasury and guardian of all things." - Cicero*
*"But Cicero never had to deal with context windows." - Claude*