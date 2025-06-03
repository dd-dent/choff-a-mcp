# CHOFF-A-MCP (Anamnesis)

[![Tests](https://img.shields.io/badge/tests-130%20passing-brightgreen)](./tests/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue)](https://www.typescriptlang.org/)
[![MCP](https://img.shields.io/badge/MCP-1.12-purple)](https://modelcontextprotocol.io/)

> _Anamnesis (ἀνάμνησις): The philosophical concept of recollection - the soul's ability to recall eternal truths from past experience._

**CHOFF-A-MCP** is a Model Context Protocol (MCP) server that provides AI assistants with persistent memory across conversations using the Cognitive Hoffman Compression Framework (CHOFF) notation.

{state:proud}[context:project_showcase] &pattern:achievement|complete|

## 🎯 What It Does

- **Persistent Memory**: Remember important decisions, breakthroughs, and context across chat sessions
- **Enhanced Retrieval**: Multi-layer search with content → PCHOFF → anchor → state → context fallbacks
- **CHOFF + PCHOFF Integration**: Advanced parsing with classification-aware memory retrieval
- **Semantic Anchors**: Automatically detect and categorize decisions, blockers, breakthroughs, and questions
- **Smart Storage**: JSON-based conversation persistence with atomic operations
- **MCP Integration**: Seamless integration with Claude Code and other MCP-compatible tools

## 🚀 Quick Start

### Installation

```bash
npm install -g choff-a-mcp
```

### Configuration

Add to your MCP configuration (e.g., for Claude Code):

```json
{
  "mcpServers": {
    "choff-a-mcp": {
      "command": "choff-a-mcp",
      "args": ["--storage-path", "~/.choff/conversations"]
    }
  }
}
```

### Usage

Once configured, your AI assistant gains access to these tools:

- `mcp__choff-a-mcp__saveCheckpoint` - Save important conversation segments with CHOFF parsing
- `mcp__choff-a-mcp__loadContext` - Enhanced multi-layer search with rich filtering
- `mcp__choff-a-mcp__getAnchors` - Retrieve semantic anchors with classification support

### CLI Interface

Query your memory directly from the command line:

```bash
# Search with enhanced multi-layer retrieval
choff search "quantum velocity" --context technical --anchor breakthrough

# Browse semantic anchors with filtering
choff anchors --type decision --limit 10

# Export conversations in multiple formats
choff export --query "PCHOFF integration" --format markdown

# View memory system statistics
choff stats
```

## 📖 CHOFF Notation

CHOFF (Cognitive Hoffman Compression Framework) is a notation system for expressing cognitive states and context:

```
{state:analytical}[context:coding]
→ Exploring implementation patterns
← Insight: Use visitor pattern for parsing
&pattern:breakthrough|solution_found|
```

**Key Components:**

- `{state:type}` - Cognitive state markers
- `[context:domain]` - Contextual framing
- `→←↔` - Directional flow indicators
- `&pattern:type|status|` - Pattern recognition markers

See [docs/choff-2-5.md](./docs/choff-2-5.md) for the complete specification.

## 🏗️ Architecture

```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   CHOFF Parser  │───▶│  PCHOFF Classifier│───▶│ Enhanced Storage│
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│ Semantic Anchors│    │ Multi-Layer Search│    │  Relationship   │
│   Extraction    │───▶│   & Retrieval     │───▶│   Resolution    │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                        │                       │
         ▼                        ▼                       ▼
┌─────────────────────────────────────────────────────────────────┐
│                     MCP Tools Layer                             │
│ saveCheckpoint │ loadContext (enhanced) │ getAnchors           │
└─────────────────────────────────────────────────────────────────┘
```

### Components

- **Parser** (`src/parser/`): Recursive CHOFF notation parser with full v2.5 support
- **Storage** (`src/storage/`): Atomic JSON-based persistence with backup management
- **Semantic Anchors** (`src/anchors/`): Intelligent detection of key conversation elements
- **Enhanced Retrieval** (`src/tools-enhanced.ts`): Multi-layer search with PCHOFF classification
- **CLI** (`src/cli.ts`): Command-line interface for direct memory queries
- **MCP Tools** (`src/tools.ts`): Protocol integration and tool implementations

## 🧪 Development

Built with TDD principles - all 130 tests passing!

```bash
# Install dependencies
npm install

# Run tests
npm test

# Watch mode during development
npm run test:watch

# Type checking
npm run type-check

# Linting
npm run lint:fix

# Build for production
npm run build
```

### Project Structure

```
choff-a-mcp/
├── src/
│   ├── parser/           # CHOFF notation parsing
│   ├── storage/          # Conversation persistence
│   ├── anchors/          # Semantic anchor detection
│   ├── tools.ts          # MCP tool implementations
│   └── server.ts         # MCP server setup
├── tests/
│   ├── unit/             # Component tests
│   └── integration/      # End-to-end tests
├── docs/
│   ├── choff-2-5.md      # CHOFF specification
│   └── retro/            # Development retrospectives
└── examples/             # Usage examples
```

## 📋 Semantic Anchors

The system automatically detects and categorizes these conversation elements:

- **Decisions** - Choices made with rationale
- **Blockers** - Problems preventing progress
- **Breakthroughs** - Solutions to previous blockers
- **Questions** - Open items needing answers

Each anchor includes confidence scoring and contextual metadata.

## 🔧 Configuration Options

Command-line arguments:

- `--storage-path` - Directory for conversation storage (default: `./conversations`)
- `--max-conversations` - Maximum stored conversations (default: 1000)
- `--backup-interval` - Backup frequency in hours (default: 24)

Environment variables:

- `CHOFF_STORAGE_PATH` - Alternative to --storage-path
- `CHOFF_LOG_LEVEL` - Logging verbosity (debug, info, warn, error)

## 🚦 Status

**Phase 1 Complete!** ✅

- Core CHOFF parsing ✅
- JSON storage layer ✅
- Semantic anchor detection ✅
- MCP tool integration ✅
- Comprehensive test coverage (130 tests) ✅
- Enhanced multi-layer retrieval system ✅
- PCHOFF-1.1-A classification integration ✅
- Relationship extraction with deduplication ✅

**Phase 2 - Coming Soon:**

- Vector embeddings for semantic search
- Conversation clustering and relationships
- Performance optimization for large datasets

## 🤝 Contributing

We follow strict TDD practices:

1. Write failing tests first
2. Implement minimal code to pass
3. Refactor with confidence
4. Maintain >90% test coverage

See [WORKFLOW.md](./WORKFLOW.md) for detailed development practices.

## 📚 Documentation

- [CHOFF 2.5 Specification](./docs/choff-2-5.md) - Complete notation reference
- [Development Workflow](./WORKFLOW.md) - Process and conventions
- [Project Context](./CLAUDE.md) - AI assistant guidance
- [Retrospectives](./docs/retro/) - Development insights and lessons

## 🎭 Philosophy

> "Context is that which is scarce." - Every AI ever

This project embodies the belief that AI assistants need persistent memory to truly assist humans effectively. By preserving not just conversation content but cognitive state and decision rationale, we enable richer, more contextual AI interactions.

## 📄 License

MIT License - see [LICENSE](./LICENSE) file for details.

## 🙏 Acknowledgments

- The CHOFF notation system for cognitive state representation
- The Model Context Protocol team for extensible AI tool integration
- Test-driven development practices that kept us sane

---

{state:ready}[context:deployment] &pattern:memory_system|operational|

_"The best memory system is the one you actually use."_
