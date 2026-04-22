/* ============================================================
   Knowledge Explorer — app.js
   Vanilla JS, no build step, ES2022+
   ============================================================ */

'use strict';

// ---- Constants -------------------------------------------------

const API_BASE = '';   // same origin
const DEFAULT_LIMIT = 20;

const TYPE_COLORS = {
  document:    '#89b4fa',
  company:     '#a6e3a1',
  person:      '#cba6f7',
  technology:  '#fab387',
  lead:        '#f9e2af',
  ehrsystem:   '#f38ba8',
  tag:         '#94e2d5',
  market:      '#89dceb',
  skill:       '#f5c2e7',
  regulation:  '#f38ba8',
  folder:      '#6c7086',
};

const TYPE_ICONS = {
  document:   '📄',
  company:    '🏢',
  person:     '👤',
  technology: '⚙️',
  lead:       '🎯',
  ehrsystem:  '🏥',
  tag:        '🏷️',
  market:     '📊',
  skill:      '🔧',
  regulation: '📋',
  folder:     '📁',
};

function typeColor(t) {
  return TYPE_COLORS[(t || '').toLowerCase()] || '#a6adc8';
}
function typeIcon(t) {
  return TYPE_ICONS[(t || '').toLowerCase()] || '◆';
}
function badgeClass(t) {
  const k = (t || '').toLowerCase();
  const known = Object.keys(TYPE_COLORS);
  return known.includes(k) ? `badge badge-${k}` : 'badge badge-default';
}

// ---- App state -------------------------------------------------

const state = {
  ventures: [],
  stats: null,
  entityTypes: [],
  currentVenture: '',
  currentQuery: '',
  currentType: '',
};

// ---- Router ----------------------------------------------------

const router = {
  init() {
    window.addEventListener('hashchange', () => router.dispatch());
    router.dispatch();
  },
  navigate(hash) {
    window.location.hash = hash;
  },
  dispatch() {
    const raw = window.location.hash || '#/';
    // strip leading #
    const path = raw.startsWith('#') ? raw.slice(1) : raw;

    if (path === '/' || path === '') return views.landing();

    if (path.startsWith('/search')) {
      const params = new URLSearchParams(path.includes('?') ? path.split('?')[1] : '');
      return views.search({
        q:       params.get('q') || '',
        venture: params.get('venture') || '',
        type:    params.get('type') || '',
        limit:   parseInt(params.get('limit') || DEFAULT_LIMIT, 10),
      });
    }

    const entityMatch = path.match(/^\/entity\/([^/]+)\/(.+)$/);
    if (entityMatch) return views.entityDetail(entityMatch[1], decodeURIComponent(entityMatch[2]));

    const graphMatch = path.match(/^\/graph\/(.+)$/);
    if (graphMatch) return views.graphView(decodeURIComponent(graphMatch[1]));

    views.notFound();
  },
};

function navTo(hash) { router.navigate(hash); }
function navEntity(type, name) { navTo(`#/entity/${encodeURIComponent(type)}/${encodeURIComponent(name)}`); }
function navGraph(id)   { navTo(`#/graph/${encodeURIComponent(id)}`); }
function navSearch(q, venture, type) {
  const p = new URLSearchParams();
  if (q)       p.set('q', q);
  if (venture) p.set('venture', venture);
  if (type)    p.set('type', type);
  navTo(`#/search?${p.toString()}`);
}

// ---- API -------------------------------------------------------

async function apiFetch(path) {
  const res = await fetch(`${API_BASE}${path}`);
  if (!res.ok) {
    const msg = await res.text().catch(() => res.statusText);
    throw new Error(`API error ${res.status}: ${msg}`);
  }
  return res.json();
}

const api = {
  stats()              { return apiFetch('/api/stats'); },
  ventures()           { return apiFetch('/api/ventures'); },
  entityTypes()        { return apiFetch('/api/entity/types'); },
  search(q, venture, type, limit = DEFAULT_LIMIT) {
    const p = new URLSearchParams({ q, limit });
    if (venture) p.set('venture', venture);
    if (type)    p.set('type', type);
    return apiFetch(`/api/search?${p.toString()}`);
  },
  entity(type, name)   { return apiFetch(`/api/entity/${encodeURIComponent(type)}/${encodeURIComponent(name)}`); },
  neighbors(id)        { return apiFetch(`/api/graph/neighbors/${encodeURIComponent(id)}`); },
};

// ---- DOM helpers -----------------------------------------------

function $(sel, ctx = document) { return ctx.querySelector(sel); }
function $$(sel, ctx = document) { return [...ctx.querySelectorAll(sel)]; }

function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === 'className') el.className = v;
    else if (k.startsWith('on')) el.addEventListener(k.slice(2).toLowerCase(), v);
    else el.setAttribute(k, v);
  }
  for (const child of children) {
    if (child == null) continue;
    el.append(typeof child === 'string' ? child : child);
  }
  return el;
}

function setMain(el) {
  const main = $('#main-content');
  main.innerHTML = '';
  main.append(el);
  main.scrollTop = 0;
  window.scrollTo(0, 0);
}

function badge(type, label) {
  const el = document.createElement('span');
  el.className = badgeClass(type);
  el.textContent = label || type;
  return el;
}

function ventureBadge(v) {
  if (!v) return null;
  const el = document.createElement('span');
  el.className = 'badge badge-venture';
  el.textContent = v;
  return el;
}

function stateMsg(icon, text, isError = false) {
  const d = document.createElement('div');
  d.className = 'state-msg' + (isError ? ' state-error' : '');
  d.innerHTML = `<span class="icon">${icon}</span>${text}`;
  return d;
}

function skeletonCard() {
  const d = document.createElement('div');
  d.className = 'card';
  d.innerHTML = `
    <div class="skeleton sk-line sk-line-short" style="margin-bottom:12px"></div>
    <div class="skeleton sk-line sk-line-med"></div>
    <div class="skeleton sk-line" style="width:90%"></div>
    <div class="skeleton sk-line sk-line-short"></div>`;
  return d;
}

// ---- Toast / notification --------------------------------------

function toast(msg, isError = false) {
  const c = $('#toast-container');
  const t = document.createElement('div');
  t.className = 'toast' + (isError ? ' toast-error' : '');
  t.textContent = msg;
  c.append(t);
  setTimeout(() => t.remove(), 3500);
}

// ---- Search bar builder ----------------------------------------

function buildSearchBar(opts = {}) {
  const { q = '', venture = '', type = '', large = false, onSearch } = opts;

  const wrap = document.createElement('div');
  wrap.className = 'search-bar';

  // text input
  const inputWrap = document.createElement('div');
  inputWrap.className = 'search-input-wrap';
  const icon = document.createElement('span');
  icon.className = 'search-icon';
  icon.textContent = '⌕';

  const input = document.createElement('input');
  input.type = 'text';
  input.placeholder = 'Search entities, documents, companies…';
  input.value = q;
  if (large) { input.style.fontSize = '1rem'; input.style.height = '46px'; }
  inputWrap.append(icon, input);

  // venture select
  const ventSel = document.createElement('select');
  ventSel.title = 'Filter by venture';
  const ventOpt0 = document.createElement('option');
  ventOpt0.value = '';
  ventOpt0.textContent = 'All ventures';
  ventSel.append(ventOpt0);
  for (const v of state.ventures) {
    const o = document.createElement('option');
    o.value = v.id || v.name || v;
    o.textContent = v.name || v;
    if (o.value === venture) o.selected = true;
    ventSel.append(o);
  }
  if (large) ventSel.style.height = '46px';

  // type select
  const typeSel = document.createElement('select');
  typeSel.title = 'Filter by entity type';
  const typeOpt0 = document.createElement('option');
  typeOpt0.value = '';
  typeOpt0.textContent = 'All types';
  typeSel.append(typeOpt0);
  for (const t of state.entityTypes) {
    const o = document.createElement('option');
    o.value = t.type || t;
    o.textContent = `${t.type || t}${t.count != null ? ` (${t.count})` : ''}`;
    if (o.value.toLowerCase() === type.toLowerCase()) o.selected = true;
    typeSel.append(o);
  }
  if (large) typeSel.style.height = '46px';

  // submit
  const btn = document.createElement('button');
  btn.className = large ? 'btn btn-primary' : 'btn btn-primary btn-sm';
  btn.style.cssText = large ? 'height:46px;padding:10px 22px' : '';
  btn.textContent = 'Search';

  function doSearch() {
    const qv = input.value.trim();
    if (!qv) { toast('Enter a search term', true); return; }
    if (onSearch) {
      onSearch(qv, ventSel.value, typeSel.value);
    } else {
      navSearch(qv, ventSel.value, typeSel.value);
    }
  }
  btn.onclick = doSearch;
  input.addEventListener('keydown', e => { if (e.key === 'Enter') doSearch(); });

  wrap.append(inputWrap, ventSel, typeSel, btn);
  return { el: wrap, input, ventSel, typeSel };
}

// ---- Navbar search sync ----------------------------------------

function syncNavbarSearch() {
  const nb = $('#navbar-search-area');
  if (!nb) return;
  nb.innerHTML = '';
  const { el } = buildSearchBar({ q: state.currentQuery, venture: state.currentVenture, type: state.currentType });
  el.style.width = '100%';
  nb.append(el);
}

// ---- Views -----------------------------------------------------

const views = {

  // ============================================================
  // LANDING
  // ============================================================
  async landing() {
    state.currentQuery = '';
    state.currentVenture = '';
    state.currentType = '';
    syncNavbarSearch();

    const container = document.createElement('div');

    // Hero
    const hero = document.createElement('div');
    hero.className = 'hero';
    hero.innerHTML = `
      <h1 class="hero-title">Knowledge <span>Explorer</span></h1>
      <p class="hero-sub">Browse and search the company knowledge graph</p>`;

    const heroSearch = document.createElement('div');
    heroSearch.className = 'hero-search';
    const { el: searchEl } = buildSearchBar({ large: true });
    heroSearch.append(searchEl);
    hero.append(heroSearch);
    container.append(hero);

    // Stats section
    const statsSection = document.createElement('div');
    statsSection.className = 'section';
    statsSection.innerHTML = `<h2 class="section-title">Graph Overview</h2>`;
    const statsGrid = document.createElement('div');
    statsGrid.className = 'grid-stats';
    statsGrid.innerHTML = [...Array(6)].map(() =>
      `<div class="stat-card"><div class="skeleton sk-line" style="height:32px;margin-bottom:8px"></div><div class="skeleton sk-line-med" style="height:10px"></div></div>`
    ).join('');
    statsSection.append(statsGrid);
    container.append(statsSection);

    // Ventures section
    const ventSection = document.createElement('div');
    ventSection.className = 'section';
    ventSection.innerHTML = `<h2 class="section-title">Ventures</h2>`;
    const chipGroup = document.createElement('div');
    chipGroup.className = 'chip-group';
    chipGroup.id = 'venture-chips';
    chipGroup.innerHTML = '<span class="text-muted text-sm">Loading…</span>';
    ventSection.append(chipGroup);
    container.append(ventSection);

    // Entity types
    const typeSection = document.createElement('div');
    typeSection.className = 'section';
    typeSection.innerHTML = `<h2 class="section-title">Browse by Type</h2>`;
    const typeGrid = document.createElement('div');
    typeGrid.className = 'grid-2';
    typeGrid.id = 'type-cards';
    typeGrid.innerHTML = '<span class="text-muted text-sm">Loading…</span>';
    typeSection.append(typeGrid);
    container.append(typeSection);

    setMain(container);

    // Load data in parallel
    const [statsData, venturesData, typesData] = await Promise.allSettled([
      api.stats(),
      api.ventures(),
      api.entityTypes(),
    ]);

    // Render stats
    if (statsData.status === 'fulfilled') {
      state.stats = statsData.value;
      statsGrid.innerHTML = '';
      const nodes = statsData.value.nodes || statsData.value.nodeCounts || {};
      const entries = Array.isArray(nodes)
        ? nodes
        : Object.entries(nodes).map(([type, count]) => ({ type, count }));

      if (entries.length === 0) {
        statsGrid.innerHTML = '<span class="text-muted text-sm">No stats available</span>';
      } else {
        for (const item of entries) {
          const type = item.type || item.label || 'Unknown';
          const count = item.count ?? 0;
          const color = typeColor(type);
          const card = document.createElement('div');
          card.className = 'stat-card';
          card.style.borderTopColor = color;
          card.style.borderTopWidth = '3px';
          card.innerHTML = `
            <div class="stat-card-count" style="color:${color}">${count.toLocaleString()}</div>
            <div class="stat-card-label">${type}</div>`;
          card.onclick = () => navSearch('', '', type);
          statsGrid.append(card);
        }
      }
    } else {
      statsGrid.innerHTML = '<span class="text-muted text-sm">Stats unavailable</span>';
    }

    // Render ventures
    if (venturesData.status === 'fulfilled') {
      const vents = venturesData.value;
      state.ventures = Array.isArray(vents) ? vents : (vents.ventures || []);
      syncNavbarSearch();
      chipGroup.innerHTML = '';
      if (state.ventures.length === 0) {
        chipGroup.innerHTML = '<span class="text-muted text-sm">No ventures configured</span>';
      } else {
        const allChip = document.createElement('button');
        allChip.className = 'chip active';
        allChip.innerHTML = '<span class="chip-dot"></span> All';
        allChip.onclick = () => navSearch('', '', '');
        chipGroup.append(allChip);
        for (const v of state.ventures) {
          const id = v.id || v.name || v;
          const name = v.name || v;
          const chip = document.createElement('button');
          chip.className = 'chip';
          chip.innerHTML = `<span class="chip-dot" style="color:var(--accent)"></span> ${name}`;
          chip.onclick = () => navSearch('', id, '');
          chipGroup.append(chip);
        }
      }
    } else {
      chipGroup.innerHTML = '<span class="text-muted text-sm">Ventures unavailable</span>';
    }

    // Render entity types
    if (typesData.status === 'fulfilled') {
      const types = typesData.value;
      state.entityTypes = Array.isArray(types) ? types : (types.types || []);
      syncNavbarSearch();
      typeGrid.innerHTML = '';
      for (const t of state.entityTypes) {
        const typeName = t.type || t.label || t;
        const count = t.count ?? '';
        const color = typeColor(typeName);
        const card = document.createElement('div');
        card.className = 'card card-clickable';
        card.style.borderLeft = `3px solid ${color}`;
        card.innerHTML = `
          <div class="card-header">
            <span style="font-size:1.4rem">${typeIcon(typeName)}</span>
            <div>
              <div class="card-title">${typeName}</div>
              ${count !== '' ? `<div class="text-sm text-muted text-mono">${Number(count).toLocaleString()} nodes</div>` : ''}
            </div>
          </div>`;
        card.onclick = () => navSearch('', '', typeName);
        typeGrid.append(card);
      }
      if (state.entityTypes.length === 0) {
        typeGrid.innerHTML = '<span class="text-muted text-sm">No types available</span>';
      }
    } else {
      typeGrid.innerHTML = '<span class="text-muted text-sm">Types unavailable</span>';
    }
  },

  // ============================================================
  // SEARCH RESULTS
  // ============================================================
  async search({ q, venture, type, limit }) {
    state.currentQuery = q;
    state.currentVenture = venture;
    state.currentType = type;
    syncNavbarSearch();

    const container = document.createElement('div');

    // Top search bar
    const topBar = document.createElement('div');
    topBar.style.marginBottom = '20px';
    const { el: searchEl, ventSel, typeSel } = buildSearchBar({ q, venture, type });
    topBar.append(searchEl);
    container.append(topBar);

    // Filter chips row
    const filterBar = document.createElement('div');
    filterBar.className = 'filter-bar';

    // Active filters display
    if (venture || type) {
      const filterLabel = document.createElement('span');
      filterLabel.className = 'filter-label';
      filterLabel.textContent = 'Active filters:';
      filterBar.append(filterLabel);
      if (venture) {
        const chip = buildFilterChip(`Venture: ${venture}`, () => navSearch(q, '', type));
        filterBar.append(chip);
      }
      if (type) {
        const chip = buildFilterChip(`Type: ${type}`, () => navSearch(q, venture, ''));
        filterBar.append(chip);
      }
      const clearAll = document.createElement('button');
      clearAll.className = 'btn btn-sm btn-ghost';
      clearAll.textContent = 'Clear all';
      clearAll.onclick = () => navSearch(q, '', '');
      filterBar.append(clearAll);
    }
    container.append(filterBar);

    // Results area
    const resultsInfo = document.createElement('div');
    resultsInfo.className = 'results-info';
    resultsInfo.textContent = 'Searching…';
    container.append(resultsInfo);

    const resultsList = document.createElement('div');
    resultsList.className = 'results-list';
    // skeleton
    for (let i = 0; i < 4; i++) resultsList.append(skeletonCard());
    container.append(resultsList);

    setMain(container);

    if (!q) {
      resultsInfo.textContent = 'Enter a search term above.';
      resultsList.innerHTML = '';
      return;
    }

    try {
      const data = await api.search(q, venture, type, limit);
      const results = Array.isArray(data) ? data : (data.results || data.hits || []);

      resultsList.innerHTML = '';

      if (results.length === 0) {
        resultsInfo.textContent = `No results for "${q}"`;
        resultsList.append(stateMsg('🔍', `No matches found for "${q}". Try different keywords or remove filters.`));
        return;
      }

      const filterParts = [];
      if (venture) filterParts.push(`venture: ${venture}`);
      if (type)    filterParts.push(`type: ${type}`);
      const filterStr = filterParts.length ? ` (${filterParts.join(', ')})` : '';
      resultsInfo.innerHTML = `<span>${results.length}</span> result${results.length !== 1 ? 's' : ''} for "<strong>${q}</strong>"${filterStr}`;

      for (const result of results) {
        resultsList.append(buildResultCard(result, q));
      }
    } catch (err) {
      resultsInfo.textContent = 'Error fetching results';
      resultsList.innerHTML = '';
      resultsList.append(stateMsg('⚠️', err.message, true));
      toast(err.message, true);
    }
  },

  // ============================================================
  // ENTITY DETAIL
  // ============================================================
  async entityDetail(type, name) {
    state.currentQuery = '';
    syncNavbarSearch();

    const container = document.createElement('div');

    // Breadcrumb
    const bc = document.createElement('div');
    bc.className = 'breadcrumb';
    bc.innerHTML = `<a href="#/">Home</a><span class="breadcrumb-sep">/</span><a href="#/search?type=${encodeURIComponent(type)}">${type}</a><span class="breadcrumb-sep">/</span><span>${name}</span>`;
    container.append(bc);

    // Loading skeleton header
    const loadingHeader = document.createElement('div');
    loadingHeader.innerHTML = `
      <div class="skeleton sk-line" style="width:60%;height:28px;margin-bottom:10px"></div>
      <div class="skeleton sk-line sk-line-short" style="height:18px"></div>`;
    container.append(loadingHeader);

    const bodyArea = document.createElement('div');
    container.append(bodyArea);
    setMain(container);

    try {
      const data = await api.entity(type, name);
      loadingHeader.remove();

      // Entity header
      const color = typeColor(type);
      const icon = typeIcon(type);

      const header = document.createElement('div');
      header.className = 'entity-header';

      const iconEl = document.createElement('div');
      iconEl.className = 'entity-icon';
      iconEl.style.background = `${color}22`;
      iconEl.style.border = `1px solid ${color}44`;
      iconEl.textContent = icon;
      header.append(iconEl);

      const headerText = document.createElement('div');
      headerText.className = 'entity-header-text';
      const nameEl = document.createElement('h1');
      nameEl.className = 'entity-name';
      nameEl.textContent = data.name || name;
      const typeRow = document.createElement('div');
      typeRow.className = 'entity-type-row';
      typeRow.append(badge(type, type));
      if (data.venture) typeRow.append(ventureBadge(data.venture));
      if (data.documentType) typeRow.append(badge('document', data.documentType));
      headerText.append(nameEl, typeRow);
      header.append(headerText);

      // Graph button
      if (data.id) {
        const graphBtn = document.createElement('button');
        graphBtn.className = 'btn btn-sm';
        graphBtn.innerHTML = '◈ Graph view';
        graphBtn.onclick = () => navGraph(data.id);
        header.append(graphBtn);
      }

      bodyArea.append(header);

      // Two-column layout
      const layout = document.createElement('div');
      layout.className = 'detail-layout';

      // Left: properties
      const propsCol = document.createElement('div');
      const propsCard = document.createElement('div');
      propsCard.className = 'card';
      propsCard.innerHTML = `<div class="section-title">Properties</div>`;
      const props = data.properties || data.props || data;
      const propsTable = buildPropsTable(props, ['id', 'name', 'relationships', 'related', 'venture', 'type', 'label']);
      propsCard.append(propsTable);
      propsCol.append(propsCard);
      layout.append(propsCol);

      // Right: relationships
      const relCol = document.createElement('div');
      const rels = data.relationships || data.related || {};
      const relCard = buildRelationshipsCard(rels);
      relCol.append(relCard);
      layout.append(relCol);

      bodyArea.append(layout);

      // Content / description section
      if (data.content || data.description || data.summary) {
        const contentSection = document.createElement('div');
        contentSection.className = 'section';
        contentSection.style.marginTop = '24px';
        contentSection.innerHTML = `<h2 class="section-title">Content</h2>`;
        const contentCard = document.createElement('div');
        contentCard.className = 'card';
        const text = data.content || data.description || data.summary || '';
        contentCard.innerHTML = `<p style="white-space:pre-wrap;line-height:1.7;font-size:.88rem;color:var(--text-dim)">${escHtml(text)}</p>`;
        contentSection.append(contentCard);
        bodyArea.append(contentSection);
      }

    } catch (err) {
      loadingHeader.remove();
      bodyArea.append(stateMsg('⚠️', `Failed to load entity: ${err.message}`, true));
      toast(err.message, true);
    }
  },

  // ============================================================
  // GRAPH VIEW
  // ============================================================
  async graphView(id) {
    const container = document.createElement('div');

    const bc = document.createElement('div');
    bc.className = 'breadcrumb';
    bc.innerHTML = `<a href="#/">Home</a><span class="breadcrumb-sep">/</span><span>Graph: ${id}</span>`;
    container.append(bc);

    const title = document.createElement('h1');
    title.className = 'section-title';
    title.style.fontSize = '1.3rem';
    title.style.marginBottom = '20px';
    title.textContent = 'Neighborhood Graph';
    container.append(title);

    const loading = stateMsg('⟳', 'Loading graph…');
    container.append(loading);
    setMain(container);

    try {
      const data = await api.neighbors(id);
      loading.remove();

      const nodes = data.nodes || [];
      const edges = data.edges || data.relationships || [];

      if (nodes.length === 0) {
        container.append(stateMsg('🔍', 'No neighbors found for this entity.'));
        return;
      }

      // Toggle: graph SVG vs list view
      const tabs = document.createElement('div');
      tabs.className = 'tabs';
      const tabGraph = document.createElement('button');
      tabGraph.className = 'tab-btn active';
      tabGraph.textContent = `Force Graph (${nodes.length} nodes)`;
      const tabList = document.createElement('button');
      tabList.className = 'tab-btn';
      tabList.textContent = 'List View';
      tabs.append(tabGraph, tabList);
      container.append(tabs);

      const graphPanel = buildForceGraph(nodes, edges);
      const listPanel  = buildGraphList(nodes, edges, id);
      listPanel.style.display = 'none';

      container.append(graphPanel, listPanel);

      tabGraph.onclick = () => {
        tabGraph.classList.add('active');
        tabList.classList.remove('active');
        graphPanel.style.display = '';
        listPanel.style.display = 'none';
      };
      tabList.onclick = () => {
        tabList.classList.add('active');
        tabGraph.classList.remove('active');
        graphPanel.style.display = 'none';
        listPanel.style.display = '';
      };

    } catch (err) {
      loading.remove();
      container.append(stateMsg('⚠️', `Failed to load graph: ${err.message}`, true));
      toast(err.message, true);
    }
  },

  notFound() {
    setMain(stateMsg('404', 'Page not found. <a href="#/">Go home</a>.'));
  },
};

// ---- Component builders ----------------------------------------

function buildFilterChip(label, onRemove) {
  const c = document.createElement('span');
  c.className = 'chip active';
  c.style.gap = '8px';
  c.innerHTML = `${label} <span style="opacity:.7;font-size:.9em">×</span>`;
  c.querySelector('span').onclick = onRemove;
  return c;
}

function buildResultCard(result, query) {
  const type    = result.type || result.label || result.nodeType || 'Document';
  const name    = result.name || result.title || result.id || 'Untitled';
  const venture = result.venture || '';
  const snippet = result.snippet || result.summary || result.content || result.description || '';
  const score   = result.score != null ? result.score : null;

  const card = document.createElement('div');
  card.className = 'card card-clickable';
  card.onclick = () => navEntity(type, name);

  const header = document.createElement('div');
  header.className = 'card-header';
  const titleEl = document.createElement('div');
  titleEl.className = 'card-title';
  titleEl.textContent = name;
  header.append(titleEl);
  card.append(header);

  const meta = document.createElement('div');
  meta.className = 'card-meta';
  meta.append(badge(type, type));
  if (venture) meta.append(ventureBadge(venture));
  if (result.documentType) meta.append(badge('document', result.documentType));
  card.append(meta);

  if (snippet) {
    const snip = document.createElement('div');
    snip.className = 'card-snippet';
    snip.textContent = truncate(snippet, 240);
    card.append(snip);
  }

  if (score != null) {
    const sc = document.createElement('div');
    sc.className = 'card-score';
    sc.innerHTML = `<span class="score-dot"></span>score: ${typeof score === 'number' ? score.toFixed(4) : score}`;
    card.append(sc);
  }

  return card;
}

function buildPropsTable(data, skipKeys = []) {
  const table = document.createElement('table');
  table.className = 'prop-table';
  const skip = new Set(['id', 'relationships', 'related', 'type', 'label', ...skipKeys]);
  let hasRows = false;

  for (const [k, v] of Object.entries(data || {})) {
    if (skip.has(k)) continue;
    if (v == null || v === '') continue;
    if (typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 0) continue;

    hasRows = true;
    const tr = document.createElement('tr');
    const tdKey = document.createElement('td');
    tdKey.textContent = k;
    const tdVal = document.createElement('td');

    if (Array.isArray(v)) {
      tdVal.textContent = v.join(', ');
    } else if (typeof v === 'object') {
      tdVal.textContent = JSON.stringify(v);
    } else if (typeof v === 'string' && (v.startsWith('http://') || v.startsWith('https://'))) {
      const a = document.createElement('a');
      a.href = v;
      a.target = '_blank';
      a.rel = 'noopener';
      a.textContent = v;
      tdVal.append(a);
    } else {
      tdVal.textContent = String(v);
    }
    tr.append(tdKey, tdVal);
    table.append(tr);
  }

  if (!hasRows) {
    const tr = document.createElement('tr');
    const td = document.createElement('td');
    td.colSpan = 2;
    td.className = 'text-muted';
    td.textContent = 'No properties';
    tr.append(td);
    table.append(tr);
  }

  return table;
}

function buildRelationshipsCard(rels) {
  const card = document.createElement('div');
  card.className = 'card';

  // Normalize relationships into a grouped structure
  // API may return: { MENTIONS_TECH: [{name, type, direction}, ...], ... }
  // or an array of { relType, direction, name, type }
  let groups = {};

  if (Array.isArray(rels)) {
    for (const r of rels) {
      const key = r.relType || r.type || 'RELATED';
      groups[key] = groups[key] || [];
      groups[key].push(r);
    }
  } else if (typeof rels === 'object') {
    groups = rels;
  }

  const keys = Object.keys(groups);
  const titleEl = document.createElement('div');
  titleEl.className = 'section-title';
  titleEl.textContent = 'Relationships';
  const countEl = document.createElement('span');
  countEl.className = 'count';
  const totalRels = keys.reduce((s, k) => s + (Array.isArray(groups[k]) ? groups[k].length : 0), 0);
  countEl.textContent = totalRels;
  titleEl.append(countEl);
  card.append(titleEl);

  if (keys.length === 0) {
    card.append(stateMsg('◌', 'No relationships found'));
    return card;
  }

  for (const relType of keys.sort()) {
    const items = groups[relType];
    if (!Array.isArray(items) || items.length === 0) continue;

    const group = document.createElement('div');
    group.className = 'rel-group';

    const groupTitle = document.createElement('div');
    groupTitle.className = 'rel-group-title';
    groupTitle.textContent = relType;
    group.append(groupTitle);

    const list = document.createElement('div');
    list.className = 'rel-list';

    for (const item of items) {
      const targetName = item.name || item.target || item.id || '?';
      const targetType = item.nodeType || item.targetType || item.label || 'document';
      const direction  = item.direction || 'out';

      const row = document.createElement('div');
      row.className = 'rel-item';

      const arrow = document.createElement('span');
      arrow.className = 'rel-arrow';
      arrow.textContent = direction === 'in' ? '←' : '→';

      const typeBadgeEl = badge(targetType, targetType);
      typeBadgeEl.style.flexShrink = '0';

      const targetEl = document.createElement('span');
      targetEl.className = 'rel-target';
      targetEl.textContent = targetName;
      targetEl.onclick = () => navEntity(targetType, targetName);

      row.append(arrow, typeBadgeEl, targetEl);
      list.append(row);
    }
    group.append(list);
    card.append(group);
  }

  return card;
}

// ---- Force-directed SVG graph ----------------------------------

function buildForceGraph(nodes, edges) {
  const W = 800;
  const H = 540;
  const PADDING = 48;

  const container = document.createElement('div');
  container.className = 'graph-container';
  container.style.height = `${H + 60}px`;

  const svgNS = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(svgNS, 'svg');
  svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  svg.setAttribute('width', '100%');
  svg.setAttribute('height', H);
  svg.className = 'graph-svg';

  // Arrow marker
  const defs = document.createElementNS(svgNS, 'defs');
  const marker = document.createElementNS(svgNS, 'marker');
  marker.setAttribute('id', 'arrow');
  marker.setAttribute('viewBox', '0 0 10 10');
  marker.setAttribute('refX', '20');
  marker.setAttribute('refY', '5');
  marker.setAttribute('markerWidth', '6');
  marker.setAttribute('markerHeight', '6');
  marker.setAttribute('orient', 'auto');
  const arrowPath = document.createElementNS(svgNS, 'path');
  arrowPath.setAttribute('d', 'M 0 0 L 10 5 L 0 10 z');
  arrowPath.setAttribute('fill', '#45475a');
  marker.append(arrowPath);
  defs.append(marker);
  svg.append(defs);

  // Assign initial positions — center node in middle, others in circle
  const nodeMap = new Map(nodes.map(n => [n.id, { ...n, x: W / 2, y: H / 2, vx: 0, vy: 0 }]));
  const nodeArr = [...nodeMap.values()];

  // Identify center node (first or the one with most connections)
  const connectionCount = new Map(nodeArr.map(n => [n.id, 0]));
  for (const e of edges) {
    connectionCount.set(e.source, (connectionCount.get(e.source) || 0) + 1);
    connectionCount.set(e.target, (connectionCount.get(e.target) || 0) + 1);
  }
  const centerNode = [...connectionCount.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] || nodeArr[0]?.id;

  // Position non-center nodes in circle
  const others = nodeArr.filter(n => n.id !== centerNode);
  const R = Math.min(W, H) / 2 - PADDING - 20;
  others.forEach((n, i) => {
    const angle = (2 * Math.PI * i) / others.length - Math.PI / 2;
    n.x = W / 2 + R * Math.cos(angle);
    n.y = H / 2 + R * Math.sin(angle);
  });
  const cn = nodeMap.get(centerNode);
  if (cn) { cn.x = W / 2; cn.y = H / 2; }

  // Simple force simulation
  function simulate(iterations = 120) {
    for (let iter = 0; iter < iterations; iter++) {
      const alpha = 1 - iter / iterations;

      // Repulsion
      for (let i = 0; i < nodeArr.length; i++) {
        for (let j = i + 1; j < nodeArr.length; j++) {
          const a = nodeArr[i], b = nodeArr[j];
          const dx = b.x - a.x, dy = b.y - a.y;
          const dist = Math.sqrt(dx * dx + dy * dy) || 1;
          const force = (2400 / (dist * dist)) * alpha;
          a.vx -= (dx / dist) * force;
          a.vy -= (dy / dist) * force;
          b.vx += (dx / dist) * force;
          b.vy += (dy / dist) * force;
        }
      }

      // Attraction along edges
      for (const e of edges) {
        const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
        if (!s || !t) continue;
        const dx = t.x - s.x, dy = t.y - s.y;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const ideal = 150;
        const force = ((dist - ideal) / dist) * 0.3 * alpha;
        s.vx += dx * force; s.vy += dy * force;
        t.vx -= dx * force; t.vy -= dy * force;
      }

      // Center gravity
      for (const n of nodeArr) {
        n.vx += (W / 2 - n.x) * 0.01 * alpha;
        n.vy += (H / 2 - n.y) * 0.01 * alpha;
      }

      // Apply velocity + damping + bounds
      for (const n of nodeArr) {
        n.vx *= 0.7; n.vy *= 0.7;
        n.x = Math.max(PADDING, Math.min(W - PADDING, n.x + n.vx));
        n.y = Math.max(PADDING, Math.min(H - PADDING, n.y + n.vy));
      }
    }
  }
  simulate();

  // Draw edges
  const edgeGroup = document.createElementNS(svgNS, 'g');
  for (const e of edges) {
    const s = nodeMap.get(e.source), t = nodeMap.get(e.target);
    if (!s || !t) continue;
    const line = document.createElementNS(svgNS, 'line');
    line.setAttribute('x1', s.x); line.setAttribute('y1', s.y);
    line.setAttribute('x2', t.x); line.setAttribute('y2', t.y);
    line.setAttribute('class', 'graph-link');
    edgeGroup.append(line);

    // Edge label
    if (e.type || e.label) {
      const lx = (s.x + t.x) / 2, ly = (s.y + t.y) / 2;
      const txt = document.createElementNS(svgNS, 'text');
      txt.setAttribute('x', lx); txt.setAttribute('y', ly - 3);
      txt.setAttribute('text-anchor', 'middle');
      txt.setAttribute('class', 'graph-link-label');
      txt.textContent = (e.type || e.label || '').slice(0, 16);
      edgeGroup.append(txt);
    }
  }
  svg.append(edgeGroup);

  // Draw nodes
  const nodeGroup = document.createElementNS(svgNS, 'g');
  for (const n of nodeArr) {
    const color = typeColor(n.type || n.label || '');
    const isCenter = n.id === centerNode;
    const r = isCenter ? 14 : 10;

    const g = document.createElementNS(svgNS, 'g');
    g.setAttribute('class', 'graph-node');
    g.setAttribute('transform', `translate(${n.x},${n.y})`);

    const circle = document.createElementNS(svgNS, 'circle');
    circle.setAttribute('r', r);
    circle.setAttribute('fill', `${color}33`);
    circle.setAttribute('stroke', color);
    g.append(circle);

    const label = n.name || n.title || n.id || '?';
    const maxLen = 14;
    const txt = document.createElementNS(svgNS, 'text');
    txt.setAttribute('y', r + 12);
    txt.setAttribute('text-anchor', 'middle');
    txt.setAttribute('class', 'graph-link-label');
    txt.setAttribute('fill', color);
    txt.textContent = label.length > maxLen ? label.slice(0, maxLen) + '…' : label;

    if (isCenter) {
      txt.setAttribute('font-weight', 'bold');
      txt.setAttribute('font-size', '10');
    }

    g.append(txt);
    g.title = label;

    g.onclick = () => {
      const type = n.type || n.label || 'document';
      const name = n.name || n.title || n.id;
      navEntity(type, name);
    };

    nodeGroup.append(g);
  }
  svg.append(nodeGroup);
  container.append(svg);

  // Legend
  const seenTypes = [...new Set(nodeArr.map(n => (n.type || n.label || 'unknown').toLowerCase()))];
  const legend = document.createElement('div');
  legend.className = 'graph-legend';
  for (const t of seenTypes) {
    const item = document.createElement('div');
    item.className = 'legend-item';
    const dot = document.createElement('div');
    dot.className = 'legend-dot';
    dot.style.background = typeColor(t);
    item.append(dot, t);
    legend.append(item);
  }
  container.append(legend);

  return container;
}

function buildGraphList(nodes, edges, centerId) {
  const container = document.createElement('div');

  // Group by relationship type
  const byRel = new Map();
  for (const e of edges) {
    const key = e.type || e.label || 'RELATED';
    if (!byRel.has(key)) byRel.set(key, []);
    byRel.get(key).push(e);
  }

  if (byRel.size === 0) {
    container.append(stateMsg('◌', 'No relationships to display'));
    return container;
  }

  const nodeMap = new Map(nodes.map(n => [n.id, n]));

  for (const [relType, relEdges] of byRel) {
    const group = document.createElement('div');
    group.className = 'rel-group';
    const title = document.createElement('div');
    title.className = 'rel-group-title';
    title.textContent = `${relType} (${relEdges.length})`;
    group.append(title);

    const list = document.createElement('div');
    list.className = 'rel-list';

    for (const e of relEdges) {
      const otherId = e.source === centerId ? e.target : e.source;
      const other   = nodeMap.get(otherId) || { id: otherId, name: otherId, type: 'document' };
      const direction = e.source === centerId ? '→' : '←';

      const row = document.createElement('div');
      row.className = 'rel-item';

      const arr = document.createElement('span');
      arr.className = 'rel-arrow';
      arr.textContent = direction;

      const typeBadgeEl = badge(other.type || 'document', other.type || 'document');
      typeBadgeEl.style.flexShrink = '0';

      const targetEl = document.createElement('span');
      targetEl.className = 'rel-target';
      targetEl.textContent = other.name || other.title || otherId;
      targetEl.onclick = () => navEntity(other.type || 'document', other.name || other.title || otherId);

      row.append(arr, typeBadgeEl, targetEl);
      list.append(row);
    }
    group.append(list);
    container.append(group);
  }

  return container;
}

// ---- Utilities -------------------------------------------------

function truncate(str, len) {
  if (!str || str.length <= len) return str;
  return str.slice(0, len).trimEnd() + '…';
}

function escHtml(str) {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

// ---- Bootstrap -------------------------------------------------

async function bootstrap() {
  // Eagerly load global state so selects are populated before first view
  try {
    const [vents, types] = await Promise.allSettled([api.ventures(), api.entityTypes()]);
    if (vents.status === 'fulfilled') {
      const v = vents.value;
      state.ventures = Array.isArray(v) ? v : (v.ventures || []);
    }
    if (types.status === 'fulfilled') {
      const t = types.value;
      state.entityTypes = Array.isArray(t) ? t : (t.types || []);
    }
  } catch (_) { /* non-fatal */ }

  router.init();
}

document.addEventListener('DOMContentLoaded', bootstrap);
