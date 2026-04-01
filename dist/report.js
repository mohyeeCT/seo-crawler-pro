// Minimal client runtime for chunked report tables
;(function(){
  const datasets = {}; // { type: { total, chunks, loaded: Map(index->rows), rows: [], loadedCount, allLoaded } }
  
  // Helper functions for renderers
  function escapeHtml(text){ return (text||'').toString().replace(/[&<>"']/g, m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#039;'}[m])); }
  function escapeAttr(text){ return escapeHtml(text).replace(/"/g,'&quot;'); }
  function truncateUrl(url,max){ const u=url||''; return u.length>max? u.substring(0,max)+'…' : u; }
  
  // Forward declaration - will be assigned later
  let renderers;
  
  const tableBindings = {
    'pages-table': { type: 'pages', get columns() { return renderers.pages; } },
    'performance-table': { type: 'performance', get columns() { return renderers.performance; } },
    'internal-links-table': { type: 'links_internal', get columns() { return renderers.linksInternal; } },
    'external-links-table': { type: 'links_external', get columns() { return renderers.linksExternal; } },
    'headings-table': { type: 'headings', get columns() { return renderers.headings; } },
    'images-table': { type: 'images', get columns() { return renderers.images; } },
    'high-issues-table': { type: 'issues_high', get columns() { return renderers.issues; } },
    'medium-issues-table': { type: 'issues_medium', get columns() { return renderers.issues; } },
    'low-issues-table': { type: 'issues_low', get columns() { return renderers.issues; } },
    '404-pages-table': { type: 'pages404', get columns() { return renderers.pages404; } },
    'not-in-sitemap-table': { type: 'sitemap_not_in', get columns() { return renderers.sitemapNotIn; } },
    'orphan-urls-table': { type: 'sitemap_orphans', get columns() { return renderers.sitemapOrphans; } },
    'non-indexable-sitemap-table': { type: 'sitemap_nonindexable', get columns() { return renderers.sitemapNonIndexable; } },
    'scripts-by-page-table': { type: 'scripts_by_page', get columns() { return renderers.scriptsByPage; } },
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
    return rows.slice().sort((a,b)=>{
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
    const filtered = filterRows(all, state.filter);
    const sorted = state.sortKey?sortRows(filtered, state.sortKey, state.sortDir):filtered;
    const total = sorted.length;
    const totalPages = Math.max(1, Math.ceil(total / state.pageSize));
    if (state.page>totalPages) state.page = totalPages;
    const start = (state.page-1)*state.pageSize;
    const end = start + state.pageSize;
    const pageRows = sorted.slice(start, end);
    const tbody = document.querySelector('#'+tableId+' tbody');
    if (!tbody) return;
    tbody.innerHTML = pageRows.map(binding.columns).join('');
    const pageInfo = document.getElementById(tableId+'-pageInfo');
    if (pageInfo) pageInfo.textContent = `Page ${state.page} / ${totalPages}`;
    // Preload next chunk when near end of loaded rows
    if (!ds.allLoaded && ds.loadedCount<ds.total && end > (Array.from(ds.loaded.values()).reduce((a,v)=>a+v.length,0) - Math.min(state.pageSize, 50))) {
      const nextIdx = ds.loaded.size + 1;
      requestChunk(binding.type, nextIdx);
    }
  }

  renderers = {
    pages: (r)=>{
      const statusCls = r.status===200? 'badge-success' : (r.status>399?'badge-error':'badge-info');
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="page-${r.index}.html" class="url-link">${truncateUrl(r.url,60)}</a></td>
        <td class="no-wrap"><span class="badge ${statusCls}">${r.status}</span></td>
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
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="page-${r.index}.html" class="url-link">${truncateUrl(r.url,60)}</a></td>
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
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="page-${r.index}.html" class="url-link">${truncateUrl(r.url,60)}</a></td>
        <td><span class="badge ${cls}">${label}</span> ${escapeHtml(r.message)}</td>
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
      const pageLink = Number.isInteger(r.index)? `<a href="page-${r.index}.html" class="url-link">${escapeHtml(r.url)}</a>` : escapeHtml(r.url);
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
      const pageLink = Number.isInteger(r.index)? `<a href="page-${r.index}.html" class="url-link">${escapeHtml(r.url)}</a>` : escapeHtml(r.url);
      return `<tr><td class="url-cell" title="${escapeHtml(r.url)}">${pageLink}</td><td>${httpBadge} ${ni}</td></tr>`;
    },
    scriptsByPage: (r)=>{
      const details = (r.scripts||[]).map(s=>`<div style=\"margin:2px 0;font-size:11px;font-family:monospace;\">• ${truncateUrl(s.src||'',100)}${s.async?'<span class=\"badge badge-success\" style=\"margin-left:4px;\">async</span>':''}${s.defer?'<span class=\"badge badge-success\" style=\"margin-left:4px;\">defer</span>':''}</div>`).join('');
      return `<tr>
        <td class="url-cell" title="${escapeHtml(r.url)}"><a href="page-${r.index}.html" class="url-link">${truncateUrl(r.url,60)}</a></td>
        <td class="no-wrap"><span class="badge badge-info">${r.count}</span></td>
        <td>${details}</td>
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
      issues:['high-issues-table','medium-issues-table','low-issues-table'],
      sitemap:['not-in-sitemap-table','orphan-urls-table','non-indexable-sitemap-table'],
      '404s':'404-pages-table',
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
      'high-issues-table': ['url','message'],
      'medium-issues-table': ['url','message'],
      'low-issues-table': ['url','message'],
      '404-pages-table': ['url','referrersCount'],
      'not-in-sitemap-table': ['url','status','indexable'],
      'orphan-urls-table': ['url'],
      'non-indexable-sitemap-table': ['url'],
      'scripts-by-page-table': ['url','count'],
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
  };
})();

