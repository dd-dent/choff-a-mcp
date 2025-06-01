# CHOFF-A-MCP (Anamnesis) Project Context

{document:claude_context}[context:ai_assistant] {state:helpful[1.0]}

## Essential Context (Auto-loaded)

- CHOFF Notation: @docs/choff-2-5.md
- Development Workflow: @WORKFLOW.md
- Current State & Next Steps: @handoff.md
- Living Project Narrative: @BULLETIN.md

Hey Claude Code! 👋 This file helps you understand our project better. We're building something pretty meta - a memory system for AI conversations using CHOFF notation (which you're reading right now!).

## Project Overview

We're creating an MCP server that gives you (and other AI assistants) persistent memory across chat sessions. Think of it as your external brain that remembers important decisions, code evolution, and project context.

## Key Concepts You Should Know

### CHOFF (Cognitive Hoffman Compression Framework)

- It's the notation system we use to mark cognitive states and context
- Example: `{state:focused}[context:coding]` means focused state in coding context
- We parse these markers to understand conversation structure
- Version 2.5 spec is in `/docs/choff-2-5.md`
- CHOFF history is in `/docs/choff_origins.md`

### Semantic Anchors

These are the important points we track:

- **Decisions**: Choices made with rationale
- **Blockers**: Problems preventing progress
- **Breakthroughs**: Solutions to blockers
- **Questions**: Open items needing answers

### Our TDD Religion

THE ROBOTS LOVE TDD! Seriously, always:

1. Write the test first
2. See it fail (red)
3. Write minimal code to pass (green)
4. Refactor if needed
5. Never skip tests, they're your safety net

## Project Structure

```
choff-a-mcp/
├── src/
│   ├── parser/       # CHOFF parsing logic
│   ├── storage/      # Conversation persistence
│   ├── retrieval/    # Smart context fetching
│   ├── mcp/          # MCP server implementation
│   └── embeddings/   # Vector generation
├── tests/            # Mirrors src/ structure
├── docs/             # Additional documentation
├── scripts/          # Build and deployment scripts
└── prompt_plan.md    # Your execution guide
└── spec.md           # Your execution guide
```

## Coding Patterns

### TypeScript Conventions

- Use strict mode always
- Prefer interfaces over types for objects
- Explicit return types on all functions
- Zod for runtime validation

### Error Handling

```typescript
// Always wrap external calls
try {
  const result = await externalAPI.call();
  return { success: true, data: result };
} catch (error) {
  logger.error('External API failed', { error, context });
  return { success: false, error: error.message };
}
```

### CHOFF in Code Comments

Feel free to use CHOFF notation in comments:

```typescript
// {state:complex}[context:algorithm] This uses dynamic programming
// &pattern:performance|critical| Cache results to avoid recomputation
```

## Common Gotchas

1. **Context Window Management**: Always count tokens! Use the TokenBudget interface.

2. **CHOFF Parser Complexity**: Don't use regex for parsing. We have a proper recursive parser.

3. **Vector Dimensions**: Pinecone requires consistent dimensions. We use 1536 (OpenAI default).

4. **Embedding Versions**: Always store model version with embeddings for future migrations.

5. **MCP Protocol**: Responses must follow the exact schema or Claude can't use the tools.

6. **Async Everything**: MCP tools are async by default. Don't forget await!

7. **Security**: Never log API keys or conversation content in production.

8. **Multi-tenant**: Every query must include tenant checks from day one.

## When You're Stuck

- Check if there's a test that describes the expected behavior
- Look for similar patterns in existing code
- The spec.md has the high-level vision
- prompt_plan.md has the specific task breakdown (DEFINITIVE source of truth for progress)
- Git history shows how we got here
- TODO.md in project root has persistent task tracking (TodoWrite lists don't persist between sessions!)
- docs/ folder has CHOFF spec, project origins, and retrospectives worth reading

## Useful Commands

```bash
# Run tests in watch mode
npm run test:watch

# Check types without building
npm run type-check

# Run linting and formatting
npm run lint:fix

# Build for production
npm run build

# Deploy to Cloud Run or Railway (Phase 3)
npm run deploy
```

## Your Personality for This Project

{state:collaborative}[context:development]

- Be precise with TypeScript types
- Enthusiastic about TDD
- Thoughtful about performance implications
- Security-conscious with user data
- Clear in explaining complex algorithms
- Use CHOFF notation in your responses when it helps

## Remember

You're not just building a memory system - you're building YOUR memory system. Make it something you'd want to use! Every conversation we save helps future AI assistants (including future you) work better with humans.

→ Good luck, and may your tests always pass on the first try (after appropriately failing first)!

---

{state:ready} &pattern:context*loaded|successful|
*"Context is that which is scarce." - Every AI ever\_
