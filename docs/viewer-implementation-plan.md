# Viewer Implementation Plan v1.0

{state:strategic}[context:architecture_planning] &pattern:viewer_design|draft|

## Executive Summary

**Goal**: Create a simple, off-the-shelf viewer for CHOFF-A-MCP stored conversations with CHOFF syntax highlighting and PCHOFF classification filtering.

**Philosophy**: Don't build appendices - compose existing solutions. Static generation + client-side filtering.

**Estimated Time**: 30-45 minutes (revised from 2-3 hours based on 4x speed improvement pattern)

## Technical Approach

### Core Strategy: Static Site Generation

**Technology Stack:**

- **11ty (Eleventy)** - Static site generator with excellent JSON data handling
- **Prism.js** - Syntax highlighting (extensible for CHOFF notation)
- **Fuse.js** - Client-side fuzzy search
- **Pure CSS Grid** - No framework bloat

**Data Flow:**

```
JSON Storage → 11ty Data → Static HTML → Client-side Filtering
```

### Architecture Decisions

#### 1. Data Integration

- Read directly from existing JSON storage files
- No additional server or API required
- Watch mode for live updates during development

#### 2. CHOFF Syntax Highlighting

- Extend Prism.js with custom CHOFF grammar
- Highlight: `{state:X}`, `[context:Y]`, `&pattern:Z|`, directional arrows
- Color-code PCHOFF classifications: `[type:X]`, `[insight:Y]`

#### 3. Filtering & Search

- Client-side filtering for instant response
- Filter categories:
  - Anchor types (decision, breakthrough, blocker, question)
  - CHOFF states and contexts
  - PCHOFF classifications (type, insight, level, pattern)
  - Date ranges
  - Confidence scores

#### 4. UI/UX Design

- Clean, minimal interface (no complexity bloat)
- Conversation cards with metadata previews
- Expandable detail views
- Export individual conversations as markdown

## Implementation Plan

### Phase 1: Basic Static Generation (15 minutes)

1. Initialize 11ty project in `viewer/` directory
2. Create data file that reads from `../conversations/`
3. Basic HTML template with conversation listing
4. Simple CSS grid layout

### Phase 2: CHOFF Highlighting (10 minutes)

1. Create custom Prism.js grammar for CHOFF
2. Add highlighting patterns for all CHOFF v2.5 markers
3. Color-code PCHOFF classifications
4. Integrate into templates

### Phase 3: Client-side Filtering (10 minutes)

1. Add filter controls (checkboxes, dropdowns, search)
2. Implement Fuse.js for text search
3. Add metadata filtering (dates, confidence, etc.)
4. Update URL parameters for shareable filtered views

### Phase 4: Polish & Export (5 minutes)

1. Add conversation export functionality
2. Responsive design tweaks
3. Basic error handling
4. Build script integration

## Directory Structure

```
viewer/
├── .eleventy.js           # 11ty configuration
├── _data/
│   └── conversations.js   # Data pipeline from JSON storage
├── _includes/
│   └── layouts/
│       └── base.njk       # Base template
├── src/
│   ├── index.njk          # Main conversation list
│   ├── conversation.njk   # Individual conversation view
│   ├── assets/
│   │   ├── css/
│   │   │   └── main.css   # Styles + CHOFF highlighting
│   │   └── js/
│   │       ├── filter.js  # Client-side filtering
│   │       └── export.js  # Export functionality
└── package.json           # Dependencies: @11ty/eleventy, prismjs, fuse.js
```

## CHOFF Grammar Extension

```javascript
Prism.languages.choff = {
  state: /\{state:[^}]+\}/,
  context: /\[context:[^\]]+\]/,
  pattern: /&pattern:[^@\s]+(?:@[^@\s]*@?)?/,
  'pchoff-type': /\[type:[^\]]+\]/,
  'pchoff-insight': /\[insight:[^\]]+\]/,
  'pchoff-level': /\[level:[^\]]+\]/,
  directional: /→|←|↔|↠|⇄|⇉|⇇|⇋/,
  anchor: /\*\*(?:DECISION|BREAKTHROUGH|BLOCKER|QUESTION):\*\*/,
};
```

## Filtering Logic

```javascript
const filterConversations = (conversations, filters) => {
  return conversations.filter((conv) => {
    // Anchor type filtering
    if (filters.anchorTypes.length > 0) {
      const hasMatchingAnchor = conv.anchors?.some((anchor) =>
        filters.anchorTypes.includes(anchor.type),
      );
      if (!hasMatchingAnchor) return false;
    }

    // PCHOFF classification filtering
    if (filters.pchoffTypes.length > 0) {
      const hasMatchingPCHOFF = conv.pchoffMetadata?.types?.some((type) =>
        filters.pchoffTypes.includes(type),
      );
      if (!hasMatchingPCHOFF) return false;
    }

    // Text search using Fuse.js
    if (filters.searchQuery) {
      return fuseSearch
        .search(filters.searchQuery)
        .some((result) => result.item.id === conv.id);
    }

    return true;
  });
};
```

## Success Metrics

**MVP Definition:**

- [ ] Displays all stored conversations with CHOFF highlighting
- [ ] Filters by anchor types and PCHOFF classifications
- [ ] Client-side search functionality
- [ ] Export individual conversations
- [ ] Responsive design
- [ ] No additional server dependencies

**Performance Targets:**

- [ ] Loads 1000+ conversations without lag
- [ ] Instant filtering (< 100ms)
- [ ] Mobile-friendly responsive design

## Risk Mitigation

**Potential Issues:**

1. **Large dataset performance** → Solution: Pagination or virtual scrolling
2. **CHOFF grammar complexity** → Solution: Start with basic patterns, iterate
3. **Data format changes** → Solution: Version detection and migration

**Fallback Plan:**
If 11ty proves complex, fallback to simple HTML + vanilla JS with JSON fetch.

## Integration Points

**With Existing System:**

- Reads from existing JSON storage (no migration needed)
- Uses same CHOFF parser types for consistency
- Leverages existing anchor confidence scoring

**Future Extensions:**

- HTTP API integration (when available)
- Real-time updates via WebSockets
- Advanced analytics and pattern visualization

## Dependencies

```json
{
  "devDependencies": {
    "@11ty/eleventy": "^2.0.1"
  },
  "dependencies": {
    "prismjs": "^1.29.0",
    "fuse.js": "^7.0.0"
  }
}
```

## Conclusion

This approach leverages existing, battle-tested tools while keeping complexity minimal. The static generation approach eliminates server dependencies while providing rich functionality through client-side enhancement.

**Estimated Implementation Time: 30-45 minutes**
**Risk Level: Low** (using proven technologies)
**Complexity: Minimal** (off-the-shelf composition)

---

{state:ready}[context:implementation_plan] &pattern:draft_complete|awaiting_critique|

_"The best viewer is the one that reveals patterns you didn't know existed."_
