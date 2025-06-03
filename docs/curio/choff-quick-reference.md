# CHOFF v2.5 Quick Reference Card

{document:reference}[context:documentation] {state:concise}

## Basic State Markers

```
{state:analytical}                  # Single state
{state:focused&curious}             # Combined states
```

## Intensity-Based States

```
{state:intensity|analytical[0.8]|creative[0.5]|}  # Independent intensities (don't sum to 1)
```

## Weighted/Proportional States

```
{state:weighted|analytical[0.6]|intuitive[0.4]|}  # Must sum to 1.0
{state:weighted:balanced|work[0.5]|rest[0.5]|}    # Shorthand for equal weights
```

## Context Markers

```
[context:technical]                 # Single context
[context:technical/security]        # Nested context
[context:phase:implementation]      # Categorized context
```

## Pattern Recognition

```
&pattern:TYPE|STATUS|              # Dynamic patterns
&pattern:performance|critical|     # Example: performance is critical
&status:processing|                # Static status
```

## Directional Operators

```
→  Forward influence/causation     A → B (A causes B)
←  Backward influence/effect       A ← B (A is caused by B)
↔  Bidirectional relationship     A ↔ B (A and B influence each other)
↠  State transition (temporal)     {state:confused} ↠ {state:clarity}
⇄  Pattern cascade                Complex multi-step influence
```

## Branching

```
{branch:1|Exploration}             # Start branch with ID and label
{branch_end:1}                     # End specific branch
→merge{branch:1}                   # Merge branch back
```

## Common Semantic Anchors

```
DECISION: {state:decisive}[context:architecture] Chose PostgreSQL for ACID compliance
BLOCKER: {state:blocked}[context:implementation] API authentication failing
BREAKTHROUGH: {state:eureka}[context:solution] Fixed by updating credentials
QUESTION: {state:uncertain}[context:design] Should we use microservices?
```

## Conversation Flow Example

```
{state:analytical}[context:problem_solving]
→ Exploring options
  → Found three approaches
    {branch:A|Traditional}
    SQL-based solution
    {branch_end:A}

    {branch:B|Modern}
    NoSQL with eventual consistency
    {branch_end:B}

→merge{branch:A}
→merge{branch:B}
↠ {state:decisive} Choosing traditional approach for reliability
```

## In Code Comments

```typescript
// {state:complex}[context:algorithm]
// This implements Dijkstra's shortest path
// &pattern:performance|O(n²)|

function findShortestPath() {
  // {state:careful} ← Edge case handling critical here
}
```

## Best Practices

1. **Be Consistent**: Pick a style and stick with it
2. **Be Meaningful**: Only tag what adds value
3. **Be Concise**: CHOFF should compress, not expand
4. **Be Clear**: Future you should understand it

## Parser Regex Patterns

```typescript
STATE: /\{state:([^}]+)\}/g;
CONTEXT: /\[context:([^\]]+)\]/g;
PATTERN: /&pattern:([^|]+)\|([^|]+)\|/g;
BRANCH: /\{branch:(\w+)(?:\|([^}]+))?\}/g;
DIRECTION: /[→←↔↠⇄]/g;
```

---

Remember: CHOFF is about making thought visible and computable! 🧠
