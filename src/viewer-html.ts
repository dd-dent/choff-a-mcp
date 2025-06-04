export const VIEWER_HTML = `<!DOCTYPE html>
<html>
<head>
  <title>CHOFF Memory Viewer</title>
  <style>
    /* Minimal, clean CSS */
    body { font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif; max-width: 1200px; margin: 0 auto; padding: 20px; }
    h1 { color: #333; }
    .search-box { margin-bottom: 20px; }
    .search-box input { width: 400px; padding: 8px 12px; font-size: 16px; border: 1px solid #ddd; border-radius: 4px; }
    .search-box button { padding: 8px 16px; font-size: 16px; background: #4CAF50; color: white; border: none; border-radius: 4px; cursor: pointer; margin-left: 8px; }
    .search-box button:hover { background: #45a049; }
    .filters { display: flex; gap: 10px; margin: 10px 0; flex-wrap: wrap; }
    .filters select { padding: 6px 10px; font-size: 14px; border: 1px solid #ddd; border-radius: 4px; background: white; }
    .result { border: 1px solid #e0e0e0; padding: 15px; margin: 10px 0; border-radius: 4px; background: #fafafa; }
    .anchor { margin-left: 20px; color: #666; font-style: italic; }
    .error { color: #d32f2f; background: #ffebee; padding: 15px; border-radius: 4px; margin: 20px 0; }
    .loading { color: #666; text-align: center; padding: 40px; font-size: 18px; }
    .empty-state { text-align: center; color: #666; padding: 40px; background: #f5f5f5; border-radius: 4px; margin: 20px 0; }
    .empty-state ul { list-style: none; padding: 0; }
    .empty-state li { margin: 8px 0; }
    .result-count { font-weight: bold; margin-bottom: 10px; color: #4CAF50; }
    button:disabled { opacity: 0.6; cursor: not-allowed; background: #ccc; }
    pre { background: #f5f5f5; padding: 15px; border-radius: 4px; overflow-x: auto; }
    .metadata { color: #666; font-size: 14px; }
    /* HTML format styling */
    .result h3 { margin-top: 0; color: #2196F3; }
    .anchors { margin-top: 10px; }
    .anchors h4 { margin: 10px 0 5px 0; font-size: 14px; }
  </style>
</head>
<body>
  <h1>🧠 CHOFF Memory Viewer</h1>
  
  <div class="search-box">
    <input type="text" id="query" placeholder="Search your memory..." autofocus />
    <button onclick="search()">Search</button>
  </div>
  
  <div class="filters">
    <select id="context">
      <option value="">All contexts</option>
      <option value="technical">Technical</option>
      <option value="meta">Meta</option>
      <option value="exploration">Exploration</option>
      <option value="planning">Planning</option>
      <option value="implementation">Implementation</option>
    </select>
    
    <select id="anchorType">
      <option value="">All anchor types</option>
      <option value="decision">Decisions</option>
      <option value="breakthrough">Breakthroughs</option>
      <option value="blocker">Blockers</option>
      <option value="question">Questions</option>
    </select>
    
    <select id="format">
      <option value="html">HTML</option>
      <option value="json">JSON</option>
      <option value="markdown">Markdown</option>
      <option value="text">Text</option>
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
        const response = await fetch(\`\${API_URL}?\${params}&_t=\${Date.now()}\`);
        
        if (!response.ok) {
          throw new Error(\`Server error: \${response.status} \${response.statusText}\`);
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
          console.log('API Response:', data); // Debug log
          resultsDiv.innerHTML = \`
            <div class="result-count">Found \${resultCount} results (Strategy: \${data.data?.metadata?.searchType || 'unknown'})</div>
            <pre>\${JSON.stringify(data, null, 2)}</pre>
          \`;
        } else {
          const text = await response.text();
          resultsDiv.innerHTML = \`<pre>\${text}</pre>\`;
        }
        
        // Handle empty results
        if (resultsDiv.innerHTML.trim() === '' || 
            resultsDiv.textContent.includes('Found 0 results')) {
          resultsDiv.innerHTML = \`
            <div class="empty-state">
              <h3>No results found</h3>
              <p>Try:</p>
              <ul>
                <li>🔍 Using different search terms</li>
                <li>🎯 Removing filters</li>
                <li>✅ Checking if the server is running at <code>\${window.location.origin}</code></li>
              </ul>
            </div>
          \`;
        }
      } catch (error) {
        console.error('Search error:', error);
        resultsDiv.innerHTML = \`
          <div class="error">
            <strong>Error:</strong> \${error.message}
            <p>Make sure the CHOFF server is running:</p>
            <pre>choff serve --port \${window.location.port || 3000}</pre>
          </div>
        \`;
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
    document.getElementById('query').addEventListener('input', debouncedSearch);
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
</html>`;
