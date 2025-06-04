# Curio Directory Index

{state:curatorial}[context:knowledge_organization] &pattern:curation_complete|systematic|

---

## Purpose

The `/docs/curio/` directory contains documents of historical, experimental, or contextually specific nature that are valuable for deep understanding but not part of the core working knowledge. These documents were moved here to keep the main docs directory focused on active specifications and current work.

[type:index][insight:practical][level:basic]

---

## Contents

### CHOFF Framework Evolution

#### `PCHOFF-1.1.md`

[type:specification][insight:direct][level:intermediate][temporal:past]
**Original PCHOFF specification** - The vanilla version of PCHOFF 1.1, now superseded by PCHOFF-1.1-A which adds anamnesis anchor references. Useful for understanding the base classification system without anchor extensions.

**When to reference**: Understanding pure PCHOFF without anamnesis integration, historical context of classification evolution.

#### `PCHOFF-2.0-draft.md`

[type:theory][insight:experimental][level:experimental][temporal:future-potential]
**Overengineered complexity draft** - An ambitious but ultimately abandoned attempt at PCHOFF 2.0 with excessive complexity. Serves as a cautionary tale about feature creep in notation systems.

**When to reference**: Avoiding overengineering pitfalls, understanding what NOT to build, examples of specification scope creep.

&pattern:pitfall_documentation@stable@

#### `choff_origins.md`

[type:case_study][insight:collective][level:basic][temporal:past]
**Historical context of CHOFF development** - Chronicles the evolution and philosophical foundations of the Cognitive Hoffman Compression Framework.

**When to reference**: Understanding design rationale, historical context, philosophical foundations of cognitive state notation.

### Contextual CHOFF Documentation

#### `choff-private-space.md`

[type:observation][insight:emergent][level:intermediate][temporal:past-present]
**Private reasoning space concepts** - Very contextual exploration of how CHOFF can create private cognitive spaces. Not generally applicable but insightful for specific use cases.

**When to reference**: Private reasoning implementations, cognitive privacy concerns, advanced CHOFF applications.

#### `choff-quick-reference.md`

[type:procedure][insight:practical][level:basic][temporal:past]
**Contextual quick reference** - A condensed CHOFF reference created for specific contextual needs. Superseded by main documentation but shows practical application patterns.

**When to reference**: Examples of practical CHOFF usage patterns, condensed notation examples.

#### `semantic-anchoring-treatise.md`

[type:analysis][insight:meta][level:advanced][temporal:past-present]
**Deep dive into semantic anchoring theory** - Extensive theoretical exploration of semantic anchor concepts. Very contextual and specific to certain implementation approaches.

**When to reference**: Deep semantic anchor theory, advanced anchoring strategies, philosophical underpinnings of memory systems.

### Implementation Reports

#### `subagent-tool-integration-report.md`

[type:case_study][insight:iterative][level:intermediate][temporal:past]
**Sub-agent collaboration documentation** - Report on working with sub-agents during tool integration phases. Contains insights about AI-AI collaboration patterns.

**When to reference**: Sub-agent collaboration strategies, debugging AI implementation issues, development process insights.

#### `what_the_user_really_meant_when_they_put_branches_in_quotation_marks.md`

[type:analysis][insight:emergent][level:intermediate][temporal:past]
**Branch notation interpretation insights** - Analysis of user intent and specification interpretation for CHOFF branching notation. Highly contextual but illuminating for notation design.

**When to reference**: Specification interpretation challenges, user intent analysis, notation ambiguity resolution.

### After Action Evaluations & Post-Mortems

#### `aae-cli-linting-crisis.md`

[type:case_study][insight:practical][level:intermediate][temporal:past]
**CLI linting crisis resolution** - Comprehensive post-mortem of resolving 167 ESLint errors in CLI implementation. Documents automated vs. manual fixes, TypeScript safety improvements, and prevention strategies.

**When to reference**: Linting crisis situations, technical debt resolution strategies, development workflow enforcement.

### Implementation Plans (Historical)

#### `bookmarklet-plan.md`

[type:procedure][insight:direct][level:basic][temporal:past]
**Browser bookmarklet viewer plan (revised)** - Pragmatic approach to creating minimal viewer solution using inline HTML/CSS/JS served via HTTP API. Represents pivot to simplicity over complexity.

**When to reference**: Simple UI implementation strategies, anti-complexity examples, pragmatic architecture decisions.

#### `viewer-implementation-plan.md`

[type:theory][insight:experimental][level:intermediate][temporal:past]
**Original viewer implementation plan v1.0** - Initial complex approach using 11ty, Prism.js, and static site generation. Useful as example of architecture planning but represents over-engineering that was later simplified.

**When to reference**: Architecture planning examples, static site generation approaches, complexity vs. simplicity trade-offs.

---

## Curation Rationale

[type:procedure][insight:practical][level:intermediate]

These documents were moved to curio/ because they:

1. **Historical Value**: Important for understanding evolution but not current practice
2. **Contextual Specificity**: Valuable in specific situations but not generally applicable
3. **Experimental Nature**: Represent explorations that may or may not be pursued
4. **Reference Material**: Useful for deep dives but not day-to-day development

The main docs directory now focuses on:

- **Active specifications** (`choff-2-5.md`, `PCHOFF-1.1-A.md`)
- **Current work** (`tangent-1.7-retrieval-curation.md`)
- **Essential reference** (`anamnesis-primer.md`)

&pattern:knowledge_architecture@stable@

---

## Navigation Guidance

[type:procedure][insight:practical][level:basic]

**For New Claudes**: Start with main docs, reference curio/ only when:

- Investigating historical decisions
- Needing deep theoretical context
- Debugging specification edge cases
- Understanding "why not" for abandoned approaches

**For Deep Research**: Curio contains the archaeological layers of project evolution - valuable for understanding the "why" behind current designs.

**For Practical Work**: Main docs directory has everything needed for active development.

---

{state:organized}[context:curation_complete] &pattern:navigation_ready|available|

_"The attic holds the memories; the living room holds the life."_
