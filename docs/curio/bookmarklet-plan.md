# Browser Bookmarklet Implementation Plan (REVISED)

{state:focused}[context:final_piece] &pattern:pragmatic_simplicity|embraced|

## Overview

Create a minimal viewer solution that provides a simple UI for querying the CHOFF memory system via our HTTP API. Based on critique feedback, we'll pivot to a simpler, more reliable approach.

## Design Principles

1. **Minimal Complexity**: Single HTML file, inline CSS/JS
2. **Zero Build Process**: No webpack, no React, just vanilla JS
3. **Leverage API**: Let the server do all the work
4. **Browser Native**: Use fetch API and modern DOM methods
5. **Bookmarklet Friendly**: Can be dragged to bookmarks bar

## Revised Approach

Given browser restrictions on bookmarklets and the need for static file serving, we'll take a more pragmatic approach:

1. **Standalone HTML file** that users can bookmark directly
2. **Add static file serving** to our HTTP server
3. **Provide simple installation instructions**
4. **Focus on core functionality first**

## Architecture

### Updated HTTP Server

First, add static file serving to http-api.ts:

```typescript
// In handleRequest method, add before the switch statement:
if (url.pathname === '/viewer' || url.pathname === '/viewer.html') {
  await this.serveViewer(res);
  return;
}

// New method:
private serveViewer(res: ServerResponse): void {
  res.statusCode = 200;
  res.setHeader('Content-Type', 'text/html');
  res.end(VIEWER_HTML); // Inline HTML constant
}
```

### File Structure

```
src/
├── http-api.ts          # Add static serving + inline HTML
└── viewer-html.ts       # Export the HTML as a constant
```

### Viewer Interface

**Single HTML File Structure:**

```html
<!DOCTYPE html>
<html>
  <head>
    <title>CHOFF Memory Viewer</title>
    <style>
      /* Minimal, clean CSS */
      body {
        font-family: sans-serif;
        margin: 20px;
        max-width: 1200px;
        margin: 0 auto;
        padding: 20px;
      }
      .search-box {
        margin-bottom: 20px;
      }
      .search-box input {
        width: 400px;
        padding: 8px;
        font-size: 16px;
      }
      .search-box button {
        padding: 8px 16px;
        font-size: 16px;
      }
      .filters {
        display: flex;
        gap: 10px;
        margin: 10px 0;
        flex-wrap: wrap;
      }
      .filters select {
        padding: 6px;
        font-size: 14px;
      }
      .result {
        border: 1px solid #ccc;
        padding: 10px;
        margin: 10px 0;
        border-radius: 4px;
      }
      .anchor {
        margin-left: 20px;
        color: #666;
      }
      .error {
        color: #d32f2f;
        background: #ffebee;
        padding: 10px;
        border-radius: 4px;
      }
      .loading {
        color: #999;
        text-align: center;
        padding: 40px;
      }
      .empty-state {
        text-align: center;
        color: #666;
        padding: 40px;
      }
      .result-count {
        font-weight: bold;
        margin-bottom: 10px;
      }
      button:disabled {
        opacity: 0.6;
        cursor: not-allowed;
      }
    </style>
  </head>
  <body>
    <h1>🧠 CHOFF Memory Search</h1>

    <div class="search-box">
      <input type="text" id="query" placeholder="Search your memory..." />
      <button onclick="search()">Search</button>
    </div>

    <div class="filters">
      <select id="context">
        <option value="">All contexts</option>
        <option value="technical">Technical</option>
        <option value="meta">Meta</option>
        <option value="exploration">Exploration</option>
      </select>

      <select id="anchorType">
        <option value="">All anchors</option>
        <option value="decision">Decisions</option>
        <option value="breakthrough">Breakthroughs</option>
        <option value="blocker">Blockers</option>
        <option value="question">Questions</option>
      </select>

      <select id="format">
        <option value="html">HTML</option>
        <option value="json">JSON</option>
        <option value="markdown">Markdown</option>
      </select>
    </div>

    <div id="results"></div>

    <script>
      // Configuration
      const API_URL = window.location.origin + '/api/query';
      let searchTimeout;

      async function search() {
        const query = document.getElementById('query').value;
        const context = document.getElementById('context').value;
        const anchorType = document.getElementById('anchorType').value;
        const format = document.getElementById('format').value;

        const params = new URLSearchParams();
        if (query) params.append('q', query);
        if (context) params.append('context', context);
        if (anchorType) params.append('anchorType', anchorType);
        params.append('format', format);

        const resultsDiv = document.getElementById('results');
        const searchButton = document.querySelector('button');

        // Update UI state
        resultsDiv.innerHTML = '<div class="loading">Searching...</div>';
        searchButton.disabled = true;

        try {
          const response = await fetch(`${API_URL}?${params}`);

          if (!response.ok) {
            throw new Error(
              `Server error: ${response.status} ${response.statusText}`,
            );
          }

          const contentType = response.headers.get('content-type') || '';

          if (format === 'html' && contentType.includes('html')) {
            const html = await response.text();
            // More robust HTML extraction
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const bodyContent = doc.body ? doc.body.innerHTML : html;
            resultsDiv.innerHTML = bodyContent;
          } else if (format === 'json') {
            const data = await response.json();
            const resultCount = data.data?.metadata?.total || 0;
            resultsDiv.innerHTML = `
            <div class="result-count">Found ${resultCount} results</div>
            <pre>${JSON.stringify(data, null, 2)}</pre>
          `;
          } else {
            const text = await response.text();
            resultsDiv.innerHTML = `<pre>${text}</pre>`;
          }

          // Handle empty results
          if (
            resultsDiv.innerHTML.trim() === '' ||
            resultsDiv.textContent.includes('Found 0 results')
          ) {
            resultsDiv.innerHTML = `
            <div class="empty-state">
              <p>No results found. Try:</p>
              <ul>
                <li>Using different search terms</li>
                <li>Removing filters</li>
                <li>Checking if the server is running</li>
              </ul>
            </div>
          `;
          }
        } catch (error) {
          resultsDiv.innerHTML = `
          <div class="error">
            <strong>Error:</strong> ${error.message}
            <p>Make sure the CHOFF server is running on ${window.location.origin}</p>
          </div>
        `;
        } finally {
          searchButton.disabled = false;
        }
      }

      // Debounced search
      function debouncedSearch() {
        clearTimeout(searchTimeout);
        searchTimeout = setTimeout(search, 300);
      }

      // Event listeners
      document
        .getElementById('query')
        .addEventListener('input', debouncedSearch);
      document.getElementById('query').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
          clearTimeout(searchTimeout);
          search();
        }
      });

      // Filter change triggers immediate search
      document.getElementById('context').addEventListener('change', search);
      document.getElementById('anchorType').addEventListener('change', search);
      document.getElementById('format').addEventListener('change', search);

      // Initial search on load
      window.addEventListener('load', search);
    </script>
  </body>
</html>
```

## Implementation Strategy

1. **Update HTTP Server**:

   - Add `/viewer` route to serve HTML
   - Store HTML as TypeScript constant
   - No external file dependencies

2. **Create Viewer HTML**:

   - All improvements from critique integrated
   - Proper error handling and empty states
   - Debounced search
   - Result counts
   - Loading states

3. **Installation Instructions**:
   - Users navigate to `http://localhost:3000/viewer`
   - Bookmark the page (Cmd+D / Ctrl+D)
   - Access anytime from bookmarks

## Testing Strategy

1. **Manual Browser Testing**:

   - Test in Chrome, Firefox, Safari
   - Verify bookmarklet installation
   - Test all filter combinations
   - Verify error handling

2. **Integration Testing**:
   - Ensure HTTP server serves static files
   - Test CORS works from file:// URLs
   - Verify all output formats render correctly

## Security Considerations

1. **CORS Already Configured**: HTTP API supports localhost origins
2. **Read-Only**: No write operations exposed
3. **Local Only**: Defaults to localhost:3000
4. **No External Dependencies**: No CDN risks

## Time Estimate

Based on revised approach with all improvements:

- Update HTTP server with static route: 5 minutes
- Create viewer HTML constant: 10 minutes
- Test and debug: 5 minutes
- **Total: 20 minutes**

This is more realistic given:

- Proper error handling added
- Debounce implementation
- Empty states and result counts
- Better HTML parsing
- Loading states

## Success Criteria

1. Viewer accessible at http://localhost:3000/viewer
2. All searches work with proper error handling
3. Debounced input prevents excessive requests
4. Empty states guide users
5. Result counts show for JSON format
6. All output formats display correctly
7. Works in Chrome, Firefox, Safari

## Usage Instructions

1. Start the server: `choff serve --port 3000`
2. Navigate to: `http://localhost:3000/viewer`
3. Bookmark the page for easy access
4. Search your memory with filters and formats

## Future Enhancements

- Configurable server URL via localStorage
- Search history
- Keyboard shortcuts for power users
- Export results functionality
- Dark mode

---

{state:confident}[context:simplicity_wins] &pattern:minimal_viable|optimal|
