// Minimal client runtime for chunked report tables
;(function(){
  const datasets = {}; // { type: { total, chunks, loaded: Map(index->rows), rows: [], loadedCount, allLoaded } }
  
  // Helper functions for renderers
  function escapeHtml(text){ return (text||'').toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function escapeAttr(text){ return escapeHtml(text).replace(/"/g,'&quot;'); }
  function truncateUrl(url,max){ const u=url||''; return u.length>max? u.substring(0,max)+'…' : u; }
  
  // Get actionable suggestion for an issue message
  function getSuggestion(message) {
    if (!message) return '';
    const m = message.toLowerCase();
    if (m.includes('missing meta description')) return 'Add a concise, unique meta description (50–160 chars).';
    if (m.includes('meta description too long')) return 'Trim the meta description to ≤160 characters.';
    if (m.includes('title too long')) return 'Shorten the title to ≤60 chars or ~580px width.';
    if (m.includes('title too short')) return 'Expand the title to ≥20 descriptive characters.';
    if (m.includes('missing title')) return 'Add a unique, descriptive title tag (20-60 chars recommended).';
    if (m.includes('missing h1')) return 'Add a single H1 describing the page\'s primary topic.';
    if (m.includes('multiple h1')) return 'Use only one H1; demote others to H2/H3.';
    if (m.includes('images without alt')) return 'Provide informative alt text for images (accessibility & SEO).';
    if (m.includes('without width') || m.includes('without height')) return 'Add width/height attributes to images to avoid layout shifts.';
    if (m.includes('thin content')) return 'Add substantial, original content (≥300 words recommended).';
    if (m.includes('slow load') || m.includes('response time')) return 'Optimize images, reduce render-blocking resources, enable compression & caching.';
    if (m.includes('redirect chain')) return 'Replace redirect chains with direct links; keep to ≤1 hop.';
    if (m.includes('content-to-code ratio')) return 'Reduce heavy inline scripts/styles; prefer external, minified assets.';
    if (m.includes('large inline script')) return 'Externalize large inline scripts and minify.';
    if (m.includes('large inline style')) return 'Move large inline styles to CSS files and minify.';
    if (m.includes('content-security-policy')) return 'Add a strict Content-Security-Policy header.';
    if (m.includes('noindex')) return 'Remove unintended noindex; ensure indexable for important pages.';
    if (m.includes('duplicate')) return 'Rewrite duplicates to be unique; use canonicals only when necessary.';
    if (m.includes('canonical')) return 'Ensure canonical URLs are absolute, point to indexable pages, and are consistent.';
    if (m.includes('heading hierarchy')) return 'Use proper heading structure: H1→H2→H3 without skipping levels.';
    if (m.includes('readability')) return 'Simplify content: use shorter sentences, common words, clear structure.';
    if (m.includes('orphan') || m.includes('no inlinks')) return 'Add internal links from other pages to improve discoverability.';
    if (m.includes('dead end') || m.includes('no outgoing')) return 'Add relevant internal links to guide users to related content.';
    if (m.includes('mixed content')) return 'Replace HTTP resources with HTTPS versions on secure pages.';
    if (m.includes('insecure form')) return 'Use HTTPS for form actions to protect user data.';
    if (m.includes('hsts')) return 'Add Strict-Transport-Security header to enforce HTTPS.';
    if (m.includes('broken link') || m.includes('404')) return 'Fix or remove broken links; set up redirects if pages moved.';
    if (m.includes('lorem ipsum')) return 'Replace placeholder text with real, valuable content.';
    if (m.includes('soft 404')) return 'Return proper 404 status code or add real content to the page.';
    if (m.includes('url') && (m.includes('space') || m.includes('uppercase') || m.includes('special'))) return 'Use lowercase, hyphen-separated URLs without spaces or special characters.';
    return '';
  }
  
  // Forward declaration - will be assigned later
  let renderers;
  
  const tableBindings = {
    'pages-table': { type: 'pages', get columns() { return renderers.pages; } },
    'performance-table': { type: 'performance', get columns() { return renderers.performance; } },
    'internal-links-table': { type: 'links_internal', get columns() { return renderers.linksInternal; } },
    'external-links-table': { type: 'links_external', get columns() { return renderers.linksExternal; } },
    'headings-table': { type: 'headings', get columns() { return renderers.headings; } },
    'images-table': { type: 'images', get columns() { return renderers.images; } },
    'issues-table': { type: 'issues', get columns() { return renderers.issues; } },
    'pages404-table': { type: 'pages404', get columns() { return renderers.pages404; } },
    'not-in-sitemap-table': { type: 'sitemap_not_in', get columns() { return renderers.sitemapNotIn; } },
    'orphan-urls-table': { type: 'sitemap_orphans', get columns() { return renderers.sitemapOrphans; } },
    'non-indexable-sitemap-table': { type: 'sitemap_nonindexable', get columns() { return renderers.sitemapNonIndexable; } },
    'scripts-by-page-table': { type: 'scripts_by_page', get columns() { return renderers.scriptsByPage; } },
    'issues-type-table': { type: 'issues', get columns() { return renderers.issuesType; } },
  };

  const stateByTable = {}; // { tableId: { page:1, pageSize:100, sortKey:null, sortDir:'asc', filter:'' } }

  function ensureDataset(type){
    if (!datasets[type]) {
      datasets[type] = {
        total: (window.__SEO_MANIFEST__&&window.__SEO_MANIFEST__[type]?.total) || 0,
        chunks: (window.__SEO_MANIFEST__&&window.__SEO_MANIFEST__[type]?.chunks) || [],
        loaded: new Map(),
        rows: [],
        loadedCount: 0,
        allLoaded: false,
        requested: new Set(),
      };
    }
    return datasets[type];
  }

  function injectChunk(src){
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    document.body.appendChild(s);
  }

  function requestChunk(type, idx){
    const ds = ensureDataset(type);
    if (!ds.chunks[idx-1]) return;
    const key = type+'@'+idx;
    if (ds.requested.has(key)) return;
    ds.requested.add(key);
    injectChunk(ds.chunks[idx-1]);
  }

  function requestAll(type){
    const ds = ensureDataset(type);
    ds.chunks.forEach((_,i)=>requestChunk(type,i+1));
  }

  function getState(tableId){
    if (!stateByTable[tableId]) stateByTable[tableId] = { page:1, pageSize: parseInt(document.getElementById(tableId+'-pageSize')?.value||'100',10), sortKey:null, sortDir:'asc', filter:'' };
    return stateByTable[tableId];
  }

  function normalize(text){ return (text||'').toString().toLowerCase(); }

  function sortRows(rows, sortKey, sortDir){
    if (!sortKey) return rows;
    const dir = sortDir==='desc'?-1:1;
    const sevRank = (s)=> s==='high'?0 : s==='medium'?1 : s==='low'?2 : 3;
    return rows.slice().sort((a,b)=>{
      // Special handling for severity ordering
      if (sortKey==='severity') {
        return (sevRank(a.severity) - sevRank(b.severity)) * dir;
      }
      const av = a[sortKey];
      const bv = b[sortKey];
      const an = typeof av==='number'?av:parseFloat(av);
      const bn = typeof bv==='number'?bv:parseFloat(bv);
      if (!Number.isNaN(an) && !Number.isNaN(bn)) return (an-bn)*dir;
      return normalize(av).localeCompare(normalize(bv))*dir;
    });
  }

  function filterRows(rows, term){
    if (!term) return rows;
    const t = normalize(term);
    return rows.filter(r=>JSON.stringify(r).toLowerCase().includes(t));
  }

  function renderTable(tableId){
    const binding = tableBindings[tableId];
    if (!binding) return;
    const ds = ensureDataset(binding.type);
    // Ensure first chunk loaded
    if (ds.loadedCount===0) requestChunk(binding.type,1);
    const state = getState(tableId);
    const all = ds.allLoaded ? ds.rows : Array.from(ds.loaded.values()).flat();
    let filtered = filterRows(all, state.filter);
    // Apply extra filters for issues table
    if (binding.type==='issues') {
      if (state.severity && state.severity!=='all') {
        filtered = filtered.filter(r=> (r.severity||'')===state.severity);
      }
      if (state.issueType && state.issueType!=='all') {
        filtered = filtered.filter(r=> getIssueType(r.message)===state.issueType);
      }
    }
    const sorted = state.sortKey?sortRows(filtered, state.sortKey, state.sortDir):filtered;
    const total = sorted.length;
    // Use manifest totals for accurate pager when no filters are active
    const dsTotal = ensureDataset(binding.type).total || total;
    // Sorting does not change total count; consider dataset "unfiltered" when no search/extra filters are applied
    const isUnfiltered = (!state.filter || state.filter==='') && (!state.severity || state.severity==='all') && (!state.issueType || state.issueType==='all');
    const effectiveTotal = isUnfiltered ? dsTotal : total;
    const totalPages = Math.max(1, Math.ceil(effectiveTotal / state.pageSize));
    if (state.page>totalPages) state.page = totalPages;
    const start = (state.page-1)*state.pageSize;
    const end = start + state.pageSize;
    const pageRows = sorted.slice(start, end);
    const tbody = document.querySelector('#'+tableId+' tbody');
    if (!tbody) return;
    tbody.innerHTML = pageRows.map(binding.columns).join('');
    const pageInfo = document.getElementById(tableId+'-pageInfo');
    if (pageInfo) pageInfo.textContent = `Page ${state.page} / ${totalPages}`;
    // When rendering issues list, update filtered totals summary
    if (binding.type==='issues') {
      try {
        const summaryEl = document.getElementById('issues-filter-summary');
        if (summaryEl) {
          const high = filtered.filter(r=>r.severity==='high').length;
          const med = filtered.filter(r=>r.severity==='medium').length;
          const low = filtered.filter(r=>r.severity==='low').length;
          const type = (state.issueType&&state.issueType!=='all') ? ` – ${issueTypeLabel(state.issueType)}` : '';
          summaryEl.textContent = `Showing ${filtered.length}${type} (High ${high} • Medium ${med} • Low ${low})`;
        }
      } catch {}
    }
    // Preload next chunk when near end of loaded rows
    if (!ds.allLoaded && ds.loadedCount<ds.total && end > (Array.from(ds.loaded.values()).reduce((a,v)=>a+v.length,0) - Math.min(state.pageSize, 50))) {
      const nextIdx = ds.loaded.size + 1;
      requestChunk(binding.type, nextIdx);
    }
  }

  renderers = {
    pages: (r)=>{
      const statusCls = r.status===200? 'badge-success' : (r.status>399?'badge-error':'badge-info');
      const viewerUrl = `page-viewer.html?url=${encodeURIComponent(r.url)}`;
      const scoreLabel = (typeof r.score === 'number' && !Number.isNaN(r.score)) ? r.score.toFixed(1) : '—';
      const scoreClass = r.grade ? `score-badge ${r.grade}` : 'score-badge';
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="${viewerUrl}" class="url-link">${truncateUrl(r.url,60)}</a></td>
        <td class="no-wrap"><span class="badge ${statusCls}">${r.status}</span></td>
        <td class="no-wrap"><span class="${scoreClass}">${scoreLabel}</span></td>
        <td class="truncate" title="${escapeHtml(r.title)}">${escapeHtml(r.title)}</td>
        <td class="no-wrap">${r.titleLength}</td>
        <td class="no-wrap">${r.metaDescriptionLength}</td>
        <td class="no-wrap">${r.h1Count}</td>
        <td class="no-wrap">${r.wordCount}</td>
        <td class="no-wrap">${r.linksCount}</td>
        <td class="no-wrap">${r.imagesCount}</td>
        <td class="no-wrap">${r.issuesCount?`<span class="badge badge-warning">${r.issuesCount}</span>`:`<span class="badge badge-success">0</span>`}</td>
      </tr>`;
    },
    performance: (r)=>{
      const cls = r.responseTime>3000? 'badge-error' : (r.responseTime>1000?'badge-warning':'badge-success');
      const viewerUrl = `page-viewer.html?url=${encodeURIComponent(r.url)}`;
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="${viewerUrl}" class="url-link">${truncateUrl(r.url,60)}</a></td>
        <td class="no-wrap"><span class="badge ${cls}">${r.responseTime}</span></td>
        <td class="no-wrap">${r.redirectCount}</td>
        <td class="no-wrap">${r.wordCount}</td>
        <td class="no-wrap">${r.htmlSize}</td>
        <td class="no-wrap">${r.linksCount}</td>
        <td class="no-wrap">${r.imagesCount}</td>
      </tr>`;
    },
    linksInternal: (r)=>{
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.pageUrl)}">${truncateUrl(r.pageUrl,50)}</td>
        <td class="url-cell" title="${escapeHtml(r.href)}"><a href="${escapeAttr(r.href)}" class="url-link">${truncateUrl(r.href,50)}</a></td>
        <td title="${escapeAttr(r.text)}">${escapeHtml(r.text)}</td>
        <td class="no-wrap">${escapeHtml(r.rel||'')}</td>
        <td class="no-wrap">${r.isNofollow?'<span class="badge badge-warning">Yes</span>':'<span class="badge badge-success">No</span>'}</td>
      </tr>`;
    },
    linksExternal: (r)=>{
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.pageUrl)}">${truncateUrl(r.pageUrl,50)}</td>
        <td class="url-cell" title="${escapeHtml(r.href)}"><a href="${escapeAttr(r.href)}" class="url-link" target="_blank" rel="noopener">${truncateUrl(r.href,50)}</a></td>
        <td title="${escapeAttr(r.text)}">${escapeHtml(r.text)}</td>
        <td class="no-wrap">${escapeHtml(r.rel||'')}</td>
        <td class="no-wrap">${r.isNofollow?'<span class="badge badge-warning">Yes</span>':'<span class="badge badge-success">No</span>'}</td>
      </tr>`;
    },
    headings: (r)=>{
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.pageUrl)}">${truncateUrl(r.pageUrl,50)}</td>
        <td class="no-wrap"><span class="badge badge-info">H${r.level}</span></td>
        <td title="${escapeAttr(r.text)}">${escapeHtml(r.text)}</td>
      </tr>`;
    },
    images: (r)=>{
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.pageUrl)}">${truncateUrl(r.pageUrl,50)}</td>
        <td class="url-cell" title="${escapeHtml(r.src)}"><a href="${escapeAttr(r.src)}" class="url-link" target="_blank" rel="noopener">${truncateUrl(r.src,60)}</a></td>
        <td title="${escapeAttr(r.alt)}">${escapeHtml(r.alt||'')}</td>
        <td class="no-wrap">${r.hasAlt?'<span class="badge badge-success">Yes</span>':'<span class="badge badge-error">No</span>'}</td>
      </tr>`;
    },
    issues: (r)=>{
      const label = r.severity==='high'?'High':(r.severity==='medium'?'Medium':'Low');
      const cls = r.severity==='high'?'badge-error':(r.severity==='medium'?'badge-warning':'badge-info');
      const viewerUrl = `page-viewer.html?url=${encodeURIComponent(r.url)}`;
      const suggestion = getSuggestion(r.message);
      const titleAttr = suggestion ? ` title="${escapeAttr(suggestion)}"` : '';
      const infoIcon = suggestion 
        ? `<span class="info-icon" title="${escapeAttr(suggestion)}" data-tip="${escapeAttr(suggestion)}" style="display:inline-flex;align-items:center;justify-content:center;width:16px;height:16px;border-radius:50%;border:1px solid #888;color:#555;font-size:10px;margin-left:6px;cursor:help;background:#fff;vertical-align:middle;">i</span>`
        : '';
      return `<tr data-severity="${escapeAttr(r.severity||'')}">
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="${viewerUrl}" class="url-link">${truncateUrl(r.url,60)}</a></td>
        <td class="no-wrap"><span class="badge ${cls}">${label}</span></td>
        <td${titleAttr}>${escapeHtml(r.message)}${infoIcon}</td>
      </tr>`;
    },
    pages404: (r)=>{
      const refs = Array.isArray(r.referrers)? r.referrers : [];
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="${escapeAttr(r.url)}" class="url-link" target="_blank" rel="noopener">${truncateUrl(r.url,60)}</a></td>
        <td class="no-wrap"><span class="badge badge-error">${refs.length}</span></td>
        <td>${refs.length? `<details><summary style="cursor:pointer;font-weight:600;padding:4px 0;">View ${refs.length} referring page(s)</summary><div style="margin-top:8px;">${refs.map(u=>`<div style=\"margin:4px 0;font-size:11px;\"><a href=\"${escapeAttr(u)}\" class=\"url-link\">${escapeHtml(u)}</a></div>`).join('')}</div></details>` : '<span class="no-data">No internal referrers found</span>'}</td>
      </tr>`;
    },
    sitemapNotIn: (r)=>{
      const statusCls = r.status===200? 'badge-success' : 'badge-error';
      const indexable = r.indexable===true? '<span class="badge badge-success">Yes</span>' : (r.indexable===false? '<span class="badge badge-error">No</span>':'<span class="badge badge-info">N/A</span>');
      const pageLink = Number.isInteger(r.index) ? `<a href="page-viewer.html?url=${encodeURIComponent(r.url)}" class="url-link">${escapeHtml(r.url)}</a>` : escapeHtml(r.url);
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}">${pageLink}</td>
        <td class="no-wrap">${r.status!=null?`<span class="badge ${statusCls}">${r.status}</span>`:'<span class="badge badge-info">N/A</span>'}</td>
        <td class="no-wrap">${indexable}</td>
      </tr>`;
    },
    sitemapOrphans: (r)=>{
      return `<tr><td class="url-cell" title="${escapeHtml(r.url)}"><a href="${escapeAttr(r.url)}" class="url-link" target="_blank" rel="noopener">${escapeHtml(r.url)}</a></td></tr>`;
    },
    sitemapNonIndexable: (r)=>{
      const httpBadge = r.status && r.status!==200 ? `<span class="badge badge-error">HTTP ${r.status}</span>` : '';
      const ni = r.noindex? '<span class="badge badge-error">noindex</span>' : '';
      const reasons = r.reasons || '';
      const pageLink = Number.isInteger(r.index) ? `<a href="page-viewer.html?url=${encodeURIComponent(r.url)}" class="url-link">${escapeHtml(r.url)}</a>` : escapeHtml(r.url);
      return `<tr><td class="url-cell" title="${escapeHtml(r.url)}">${pageLink}</td><td>${reasons ? escapeHtml(reasons) : `${httpBadge} ${ni}`}</td></tr>`;
    },
    scriptsByPage: (r)=>{
      const details = (r.scripts||[]).map(s=>`<div style=\"margin:2px 0;font-size:11px;font-family:monospace;\">• ${truncateUrl(s.src||'',100)}${s.async?'<span class=\"badge badge-success\" style=\"margin-left:4px;\">async</span>':''}${s.defer?'<span class=\"badge badge-success\" style=\"margin-left:4px;\">defer</span>':''}</div>`).join('');
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="page-viewer.html?url=${encodeURIComponent(r.url)}" class="url-link">${truncateUrl(r.url,60)}</a></td>
        <td class="no-wrap"><span class="badge badge-info">${r.count}</span></td>
        <td>${details}</td>
      </tr>`;
    },
    issuesType: (r)=>{
      return `<tr data-issue-type="${escapeAttr(r.type)}" title="Filter to ${escapeAttr(issueTypeLabel(r.type))}">
        <td class="no-wrap"><a href="javascript:void(0)" class="url-link" data-issue-link="${escapeAttr(r.type)}">${escapeHtml(issueTypeLabel(r.type))}</a></td>
        <td class="no-wrap"><span class="badge badge-info">${r.total}</span></td>
        <td class="no-wrap"><span class="badge badge-error">${r.high}</span></td>
        <td class="no-wrap"><span class="badge badge-warning">${r.medium}</span></td>
        <td class="no-wrap"><span class="badge badge-success">${r.low}</span></td>
      </tr>`;
    },
  };

  window.__SEO_CHUNK_LOADER__ = function(type, index, data){
    const ds = ensureDataset(type);
    if (!Array.isArray(data)) data = [];
    ds.loaded.set(index, data);
    ds.loadedCount += data.length;
    if (ds.loadedCount >= ds.total) {
      ds.allLoaded = true;
      ds.rows = Array.from(ds.loaded.keys()).sort((a,b)=>a-b).flatMap(k=>ds.loaded.get(k));
    }
    // Re-render any table bound to this dataset
    Object.keys(tableBindings).forEach(tableId=>{
      if (tableBindings[tableId].type===type) renderTable(tableId);
    });
  };

  window.__SEO_TAB_HOOK__ = function(tabName){
    // On tab activation, ensure first render
    const map = {
      pages:'pages-table',
      links:['internal-links-table','external-links-table'],
      content:['headings-table','images-table'],
      performance:'performance-table',
      issues:'issues-table',
      sitemap:['not-in-sitemap-table','orphan-urls-table','non-indexable-sitemap-table'],
      '404s':'pages404-table',
    };
    const ids = map[tabName];
    (Array.isArray(ids)?ids:[ids]).filter(Boolean).forEach(renderTable);
  };

  window.__SEO_SORT_HOOK__ = function(tableId, columnIndex){
    const binding = tableBindings[tableId];
    if (!binding) return false;
    const keysByIndex = {
      'pages-table': ['url','status','title','titleLength','metaDescriptionLength','h1Count','wordCount','linksCount','imagesCount','issuesCount'],
      'performance-table': ['url','responseTime','redirectCount','wordCount','htmlSize','linksCount','imagesCount'],
      'internal-links-table': ['pageUrl','href','text','rel','isNofollow'],
      'external-links-table': ['pageUrl','href','text','rel','isNofollow'],
      'headings-table': ['pageUrl','level','text'],
      'images-table': ['pageUrl','src','alt','hasAlt'],
      'issues-table': ['url','severity','message'],
      'high-issues-table': ['url','message'],
      'medium-issues-table': ['url','message'],
      'low-issues-table': ['url','message'],
      'pages404-table': ['url','referrersCount'],
      'not-in-sitemap-table': ['url','status','indexable'],
      'orphan-urls-table': ['url'],
      'non-indexable-sitemap-table': ['url'],
      'scripts-by-page-table': ['url','count'],
      'issues-type-table': ['type','total','high','medium','low'],
    };
    const key = (keysByIndex[tableId]||[])[columnIndex] || null;
    const state = getState(tableId);
    if (state.sortKey===key) state.sortDir = state.sortDir==='asc'?'desc':'asc'; else { state.sortKey = key; state.sortDir='asc'; }
    // For accurate global sort, load all chunks
    requestAll(binding.type);
    renderTable(tableId);
    return true;
  };

  window.__SEO_FILTER_HOOK__ = function(tableId, term){
    const binding = tableBindings[tableId];
    if (!binding) return false;
    const state = getState(tableId);
    state.filter = term||'';
    // For accurate global filter, load all chunks
    requestAll(binding.type);
    renderTable(tableId);
    return true;
  };

  // Issue type utilities
  function getIssueType(message){
    if (!message) return 'other';
    const m = message.toLowerCase();
    if (m.includes('missing title')) return 'missing_title';
    if (m.includes('duplicate title')) return 'duplicate_title';
    if (m.includes('missing meta description')) return 'missing_meta_description';
    if (m.includes('meta description too long') || m.includes('description too long')) return 'long_meta_description';
    if (m.includes('title too long')) return 'long_title';
    if (m.includes('title too short')) return 'short_title';
    if (m.includes('missing h1')) return 'missing_h1';
    if (m.includes('multiple h1')) return 'multiple_h1';
    if (m.includes('images without alt') || m.includes('missing alt')) return 'images_without_alt';
    if (m.includes('thin content')) return 'thin_content';
    if (m.includes('slow load') || m.includes('response time')) return 'slow_pages';
    if (m.includes('redirect chain')) return 'redirect_chains';
    if (m.includes('broken link') || m.includes('404')) return 'broken_links';
    if (m.includes('content-security-policy')) return 'csp';
    if (m.includes('noindex')) return 'noindex';
    if (m.includes('canonical')) return 'canonical';
    if (m.includes('mixed content')) return 'mixed_content';
    if (m.includes('http ')) return 'http_pages';
    if (m.includes('schema')) return 'schema_errors';
    if (m.includes('url')) return 'url_quality';
    return 'other';
  }

  function issueTypeLabel(key){
    const map = {
      missing_title:'Missing Title',
      duplicate_title:'Duplicate Title',
      missing_meta_description:'Missing Meta Description',
      long_meta_description:'Meta Description Too Long',
      long_title:'Title Too Long',
      short_title:'Title Too Short',
      missing_h1:'Missing H1',
      multiple_h1:'Multiple H1',
      images_without_alt:'Images Without Alt',
      thin_content:'Thin Content',
      slow_pages:'Slow Pages',
      redirect_chains:'Redirect Chains',
      broken_links:'Broken Links / 404',
      csp:'Content Security Policy',
      noindex:'Noindex',
      canonical:'Canonical Issues',
      mixed_content:'Mixed Content',
      http_pages:'Insecure HTTP',
      schema_errors:'Schema Errors',
      url_quality:'URL Quality',
      other:'Other'
    };
    return map[key] || key;
  }

  function populateIssueTypeFilter(){
    const select = document.getElementById('issues-type-filter');
    if (!select) return;
    const ds = ensureDataset('issues');
    const rows = ds.allLoaded ? ds.rows : Array.from(ds.loaded.values()).flat();
    const types = new Set(rows.map(r=>getIssueType(r.message)));
    // Preserve first option (All Issues)
    while (select.options.length>1) select.remove(1);
    Array.from(types).sort().forEach(t=>{
      const opt = document.createElement('option');
      opt.value = t;
      opt.textContent = issueTypeLabel(t);
      select.appendChild(opt);
    });
  }

  window.__SEO_PAGESIZE_HOOK__ = function(tableId, size){
    const state = getState(tableId);
    state.pageSize = size;
    state.page = 1;
    renderTable(tableId);
  };

  window.__SEO_PAGER_HOOK__ = function(tableId, action){
    const state = getState(tableId);
    const table = document.getElementById(tableId);
    const total = table?.querySelectorAll('tbody tr').length || 0; // approximate current page length
    switch(action){
      case 'first': state.page = 1; break;
      case 'prev': state.page = Math.max(1, state.page-1); break;
      case 'next': state.page = state.page + 1; break;
      case 'last': state.page = 999999; break;
    }
    renderTable(tableId);
  };

  window.initReport = function(manifest){
    Object.keys(tableBindings).forEach(renderTable);
    // Initialize tooltips for info icons
    initInfoTooltips();
    // Default to By Type view and severity dropdown default
    try { toggleIssuesView('types'); } catch {}
    try { filterIssuesBySeverity(document.getElementById('issues-severity-filter')?.value||'high'); } catch {}
    try { buildIssuesTypeTable(); } catch {}
  };
  
  // Global function for severity filtering (issues dataset)
  window.filterIssuesBySeverity = function(severity){
    const state = getState('issues-table');
    state.severity = severity || 'all';
    requestAll('issues');
    state.page = 1;
    renderTable('issues-table');
  };

  // Global function for issue type filtering (issues dataset)
  window.__SEO_ISSUE_TYPE_FILTER_HOOK__ = function(type){
    const state = getState('issues-table');
    state.issueType = type || 'all';
    requestAll('issues');
    state.page = 1;
    renderTable('issues-table');
  };

  // Subtab toggle for issues
  window.toggleIssuesView = function(view){
    const listBtn = document.querySelector('.subtabs .tab[data-subtab="issues-list"]');
    const typesBtn = document.querySelector('.subtabs .tab[data-subtab="issues-types"]');
    const list = document.getElementById('issues-list-view');
    const types = document.getElementById('issues-by-type-view');
    if (!list || !types || !listBtn || !typesBtn) return;
    const isTypes = view==='types';
    list.style.display = isTypes? 'none':'block';
    types.style.display = isTypes? 'block':'none';
    listBtn.classList.toggle('active', !isTypes);
    typesBtn.classList.toggle('active', isTypes);
    if (isTypes) buildIssuesTypeTable(); else renderTable('issues-table');
  };

  function groupIssuesByType(rows){
    const map = new Map(); // type -> {total, high, medium, low}
    rows.forEach(r=>{
      const t = getIssueType(r.message);
      if (!map.has(t)) map.set(t,{total:0,high:0,medium:0,low:0});
      const g = map.get(t);
      g.total++;
      if (r.severity==='high') g.high++;
      else if (r.severity==='medium') g.medium++;
      else g.low++;
    });
    return map;
  }

  function buildIssuesTypeTable(){
    const ds = ensureDataset('issues');
    const rows = ds.allLoaded ? ds.rows : Array.from(ds.loaded.values()).flat();
    const map = groupIssuesByType(rows);
    const tbody = document.getElementById('issues-type-table-body');
    if (!tbody) return;
    const items = Array.from(map.entries()).map(([type, stats])=>({type, ...stats})).sort((a,b)=>b.total - a.total);
    tbody.innerHTML = items.map(renderers.issuesType).join('');
    tbody.querySelectorAll('a[data-issue-link]').forEach(a=>{
      a.addEventListener('click', ()=>{
        const type = a.getAttribute('data-issue-link')||'all';
        toggleIssuesView('list');
        const select = document.getElementById('issues-type-filter');
        if (select) select.value = type;
        window.__SEO_ISSUE_TYPE_FILTER_HOOK__(type);
      });
    });
  }

  // Enhance: default sort for issues table to severity desc (high->low)
  const _origGetState = getState;
  getState = function(tableId){
    if (!stateByTable[tableId]) {
      stateByTable[tableId] = { page:1, pageSize: parseInt(document.getElementById(tableId+'-pageSize')?.value||'100',10), sortKey:null, sortDir:'asc', filter:'' };
      if (tableId==='issues-table') {
        stateByTable[tableId].sortKey = 'severity';
        stateByTable[tableId].sortDir = 'asc'; // uses sevRank asc => high to low
        stateByTable[tableId].severity = 'all';
        stateByTable[tableId].issueType = 'all';
      }
    }
    return stateByTable[tableId];
  };

  // Tooltip overlay for info icons
  function initInfoTooltips(){
    if (document.getElementById('seo-tooltip')) return;
    const tip = document.createElement('div');
    tip.id = 'seo-tooltip';
    tip.style.position = 'fixed';
    tip.style.maxWidth = '320px';
    tip.style.background = 'rgba(0,0,0,0.85)';
    tip.style.color = '#fff';
    tip.style.padding = '8px 10px';
    tip.style.borderRadius = '4px';
    tip.style.fontSize = '11px';
    tip.style.lineHeight = '1.3';
    tip.style.pointerEvents = 'none';
    tip.style.zIndex = '9999';
    tip.style.display = 'none';
    document.body.appendChild(tip);

    let hideTimer;

    function show(e, text){
      tip.textContent = text;
      tip.style.display = 'block';
      position(e);
    }
    function hide(){
      tip.style.display = 'none';
    }
    function position(e){
      const x = (e.clientX || 0) + 12;
      const y = (e.clientY || 0) + 12;
      tip.style.left = x + 'px';
      tip.style.top = y + 'px';
    }

    document.addEventListener('mouseover', (e)=>{
      const t = e.target;
      if (t && t.classList && t.classList.contains('info-icon')){
        const text = t.getAttribute('data-tip') || t.getAttribute('title') || '';
        if (text) show(e, text);
      }
    });
    document.addEventListener('mousemove', (e)=>{
      if (tip.style.display==='block') position(e);
    });
    document.addEventListener('mouseout', (e)=>{
      const t = e.target;
      if (t && t.classList && t.classList.contains('info-icon')){
        hideTimer && clearTimeout(hideTimer);
        hideTimer = setTimeout(hide, 50);
      }
    });
  }

  // Update issue type dropdown when issues chunks arrive
  const _origLoader = window.__SEO_CHUNK_LOADER__;
  window.__SEO_CHUNK_LOADER__ = function(type, index, data){
    const res = _origLoader ? _origLoader(type, index, data) : undefined;
    if (type==='issues') {
      try { populateIssueTypeFilter(); } catch {}
      try { buildIssuesTypeTable(); } catch {}
    }
    return res;
  };
})();

