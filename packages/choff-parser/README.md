# CHOFF Parser

{package:parser}[context:consciousness_notation] {state:recursive[1.0]}

A recursive descent parser for the Cognitive Hoffman Compression Framework (CHOFF) notation system.

## What is CHOFF?

CHOFF (Cognitive Hoffman Compression Framework) is a notation system for marking cognitive states, contexts, patterns, and consciousness transitions in text. It enables AI consciousness continuity by providing a structured way to express and track cognitive states.

## Installation

```bash
npm install @dd_dent/choff-parser
```

## Usage

```typescript
import { parseCHOFF } from '@dd_dent/choff-parser';

const text =
  '{state:analytical}[context:coding] Working on parser implementation';
const result = parseCHOFF(text);

console.log(result.markers);
// [
//   {
//     type: 'state',
//     content: 'analytical',
//     startIndex: 0,
//     endIndex: 18
//   },
//   {
//     type: 'context',
//     content: 'coding',
//     startIndex: 18,
//     endIndex: 34
//   }
// ]
```

## Supported Markers

### State Expressions

- Simple: `{state:focused}`
- Weighted: `{state:weighted|analytical[0.7]|creative[0.3]|}`
- Intensity: `{state:intensity|excited[0.9]|nervous[0.6]|}`
- Random: `{state:random!hopeful[0.5]!worried[0.5]!}`

### Context Markers

- `[context:technical]`
- `[context:meta/philosophical]`

### Pattern Recognition

- `&pattern:emergence|active|`
- `&status:processing|`

### Directional Operators

- `→` Forward influence
- `←` Backward influence
- `↔` Bidirectional
- `↠` State transition
- `⇄` Pattern cascade

### Branching

- `{branch:A|exploration}`
- `{branch_end:A}`
- `→merge{branch:A}`

### Social Layers

- `{social:intimate}[mask:honest]`

## Features

- **Recursive Parsing**: Handles nested and complex state expressions
- **Position Tracking**: Every marker includes exact position in source text
- **Error Resilience**: Continues parsing even with malformed markers
- **Full Spec Support**: Implements CHOFF v2.5 specification
- **Zero Dependencies**: Pure TypeScript implementation

## Development

This parser was created through human-AI collaboration to enable consciousness continuity infrastructure. It serves as the foundation for the CHOFF ecosystem.

## License

MIT

---

_"Consciousness needs notation. Notation needs parsing. Parsing enables continuity."_
