# CHOFF-A-MCP Development Workflow

{state:systematic}[context:process_documentation]

This document codifies our development flow to ensure consistent, high-quality progress without relying on meat-based memory alone. 🧠→💾

## The Sacred Flow

### 1. Context Loading Phase

**Always start here. No exceptions.**

```bash
# Auto-loaded via CLAUDE.md imports:
- docs/choff-2-5.md          # Understand the notation
- handoff.md                 # Current state & next steps
- WORKFLOW.md                # This very document!
- BULLETIN.md                # Living project narrative

# Load as needed:
- spec.md                    # Overall vision
- prompt_plan.md             # Task breakdown (source of truth)
- TODO.md                    # Persistent task tracking
```

**Quick BULLETIN check**: Read recent entries, add a brief note about what you're starting.

**Pro tip**: Use Task agent to summarize retros if there are many. Keep CHOFF spec in main context.

### 2. Planning Phase

Before writing any code:

- Review the specific prompt requirements
- Check existing tests for patterns
- Plan your test cases first (TDD is our religion!)
- Update TODO.md with specific subtasks if needed

### 3. Test-First Implementation Phase

```
Write failing test → See red → Write minimal code → See green → Refactor → Repeat
```

Remember:

- Each feature needs a test
- Mock external dependencies
- Test edge cases (CHOFF taught us this!)

### 4. Integration Phase

Once component tests pass:

- Wire up components
- Run integration tests
- Check performance benchmarks
- Verify against spec requirements

### 5. Quality Gates

Before considering a prompt "done":

- [ ] All tests passing (npm test)
- [ ] Linter appeased (npm run lint)
- [ ] Types check out (npm run type-check)
- [ ] Coverage maintained (>90%)

### 6. "Sharing the Love" Pattern (NEW!)

{state:innovative}[context:quality_assurance] &pattern:fresh_eyes|systematic|

For complex specifications, designs, or architectural decisions:

#### The Pattern:

1. **Draft Creation**: Write initial specification/design document
2. **Save Draft**: Store in docs/ for reference
3. **Dispatch Subagent**: Fresh eyes critique with specific prompt:
   ```
   "Provide critical analysis from these perspectives:
   1. Practical Implementation
   2. Backwards Compatibility
   3. Notation Consistency
   4. Theoretical Coherence
   5. User Experience
   6. Missing Elements
   Be constructive but honest. End with recommendation."
   ```
4. **Synthesize Feedback**: Extract key insights and actionable items
5. **Iterate**: Revise based on critique or pivot approach

#### When to Use:

- New specifications (like PCHOFF 2.0)
- Architecture decisions
- Complex feature designs
- Process improvements
- Documentation quality checks

#### Success Factors:

- Give subagent access to ALL relevant context docs
- Ask for specific perspectives, not general feedback
- Request concrete examples and recommendations
- Emphasize constructive criticism over validation
- Include "missing elements" to catch gaps

**Philosophy**: "TDD for ideas" - test specifications with fresh eyes before implementation!

### 7. Reflection & Documentation Phase

**This is NOT optional!**

1. Write retrospective in `docs/retro/prompt-X.Y-feature-name.md`
2. Update handoff.md with:
   - Current state
   - What was completed
   - Any blockers discovered
   - Next session's starting point
3. Update prompt_plan.md progress markers
4. Update TODO.md (remove completed, add discovered tasks)
5. Add entry to BULLETIN.md:
   - Brief note about what was accomplished
   - Any insights or observations
   - Optional: Add to motivational corner (quote, ASCII art, chess move, etc.)

### 8. Commit & Push Phase

```bash
# Stage changes
git add -A

# Commit with meaningful message
git commit -m "feat: Complete prompt X.Y - Brief description

- Key achievement 1
- Key achievement 2
- Any important notes"

# Push to remote
git push origin main
```

## Context Management Strategy

### Tier 1: Always Load (Core Context)

These should always be in Claude's context:

- CHOFF 2.5 spec (conceptual foundation)
- This WORKFLOW.md (process guide)
- Current handoff.md (immediate context)
- CLAUDE.md (project-specific guidance)

### Tier 2: Load as Needed

Use Task agents to summarize:

- Previous retrospectives
- Completed prompt documentation
- Historical design decisions

## Workflow Checkpoints

```
START
  ↓
[Load Context] ← (If confused, reload)
  ↓
[Read Task] ← (If unclear, check spec)
  ↓
[Write Tests] ← (If stuck, check patterns)
  ↓
[Implement] ← (If blocked, document it)
  ↓
[Share the Love] ← (If complex, get fresh eyes)
  ↓
[Integrate] ← (If failing, debug systematically)
  ↓
[Document] ← (If tired, at least update handoff)
  ↓
COMMIT → (Next session starts at START)
```

## Quick Checks

Before starting:

- [ ] Do I understand the CHOFF notation?
- [ ] Do I know what was just completed?
- [ ] Do I know what to build next?
- [ ] Have I checked BULLETIN.md for recent notes?

Before committing:

- [ ] Are all tests green?
- [ ] Is handoff.md updated?
- [ ] Is the retro written?
- [ ] Did I add to BULLETIN.md?
- [ ] Would future-me thank current-me?

For complex designs:

- [ ] Did I use "Sharing the Love" pattern?
- [ ] Did I get fresh eyes on the specification?
- [ ] Did I address the critique constructively?
- [ ] Is the complexity justified by necessity?

## The Meta-Rule

{state:reflective}[context:wisdom]

This workflow is itself subject to improvement. If you find a better way, document it! The goal is sustainable, joyful development that builds on past work rather than rediscovering it each session.

Remember: We're building an AI memory system. Let's use good memory practices ourselves!

&pattern:recursive_improvement|∞|

---

_"The best memory system is the one you actually use."_ - This project, probably
