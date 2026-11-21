(function () {
  'use strict';

  var DATA = window.RADAR;
  var err = document.getElementById('data-error');
  if (!DATA || !Array.isArray(DATA.rows)) {
    err.hidden = false;
    return;
  }
  var rows = DATA.rows;
  var live = Array.isArray(DATA.live) ? DATA.live : [];
  var peers = Array.isArray(DATA.peers) ? DATA.peers : [];

  var state = {
    q: '', category: 'all', chain: 'all', minTvl: 0, watchlistOnly: false,
    plan: 'all', sort: 'rank', dir: 1, tab: 'board', selected: null
  };
  var lastFocus = null;

  function dec(n, places) {
    return n.toFixed(places);
  }
  function fmtMoney(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    var units = [[1e12, 'T', 2], [1e9, 'B', 2], [1e6, 'M', 1], [1e3, 'k', 0]];
    for (var i = 0; i < units.length; i++) {
      if (Math.abs(n) < units[i][0]) continue;
      var v = n / units[i][0];
      if (i > 0 && Math.abs(v) >= 1000 - 0.5 * Math.pow(10, -units[i][2])) {
        v = n / units[i - 1][0];
        return '$' + dec(v, units[i - 1][2]) + units[i - 1][1];
      }
      return '$' + (units[i][2] ? dec(v, units[i][2]) : String(Math.round(v))) + units[i][1];
    }
    return '$' + Math.round(n);
  }
  function fmtFull(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return '$' + String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }
  function fmtPct(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return (n > 0 ? '+' : '') + dec(n, 2) + '%';
  }
  function fmtAge(days) {
    if (days === null || days === undefined) return 'unknown';
    if (days >= 365) return dec(days / 365, 1) + 'y';
    return Math.max(0, Math.round(days)) + 'd';
  }
  function fmtMult(n) {
    if (n === null || n === undefined || !isFinite(n)) return 'n/a';
    return dec(n, 3) + '×';
  }

  function el(tag, cls, text) {
    var node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }
  function $(id) { return document.getElementById(id); }

  var hydrating = false;
  function readHash() {
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0;
    state.plan = 'all'; state.sort = 'rank'; state.dir = 1;
    state.watchlistOnly = false; state.tab = 'board'; state.selected = null;
    liveState.q = ''; liveState.category = 'all'; liveState.sort = 'mcap'; liveState.dir = -1;
    var raw = window.location.hash.replace(/^#/, '');
    if (!raw) return;
    var p = new URLSearchParams(raw);
    if (p.get('filter')) state.q = p.get('filter');
    if (p.get('q')) state.q = p.get('q');
    if (p.get('category')) state.category = p.get('category');
    if (p.get('chain')) state.chain = p.get('chain');
    if (p.get('minTvl')) { var mv = Number(p.get('minTvl')); state.minTvl = Number.isFinite(mv) ? Math.max(0, mv) : 0; }
    if (p.get('plan') && ['all', 'deployable', 'research'].indexOf(p.get('plan')) >= 0) state.plan = p.get('plan');
    if (p.get('watchlist') === '1') state.watchlistOnly = true;
    if (p.get('sort')) { var s = p.get('sort').split(':'); if (['rank', 'name', 'implied', 'tvl', 'change', 'age'].indexOf(s[0]) >= 0) { state.sort = s[0]; state.dir = s[1] === 'd' ? -1 : 1; } }
    if (p.get('lq')) liveState.q = p.get('lq');
    if (p.get('lc')) liveState.category = p.get('lc');
    if (p.get('ls')) { var ls = p.get('ls').split(':'); if (['mcap', 'tvl'].indexOf(ls[0]) >= 0) { liveState.sort = ls[0]; liveState.dir = ls[1] === 'd' ? -1 : 1; } }
    if (p.get('tab') && ['board', 'live', 'model', 'peers'].indexOf(p.get('tab')) >= 0) state.tab = p.get('tab');
    if (p.get('detail')) state.selected = p.get('detail');
    if (p.get('ld')) { state.tab = 'live'; state.selected = 'live:' + p.get('ld'); }
  }
  function writeHash() {
    if (hydrating) return;
    var p = new URLSearchParams();
    if (state.q) p.set('filter', state.q);
    if (state.category !== 'all') p.set('category', state.category);
    if (state.chain !== 'all') p.set('chain', state.chain);
    if (state.minTvl > 0) p.set('minTvl', String(state.minTvl));
    if (state.plan !== 'all') p.set('plan', state.plan);
    if (state.watchlistOnly) p.set('watchlist', '1');
    if (state.sort !== 'rank' || state.dir !== 1) p.set('sort', state.sort + ':' + (state.dir < 0 ? 'd' : 'a'));
    if (liveState.q) p.set('lq', liveState.q);
    if (liveState.category !== 'all') p.set('lc', liveState.category);
    if (liveState.sort !== 'mcap' || liveState.dir !== -1) p.set('ls', liveState.sort + ':' + (liveState.dir < 0 ? 'd' : 'a'));
    if (state.tab !== 'board') p.set('tab', state.tab);
    if (state.selected && state.selected.indexOf('live:') !== 0) p.set('detail', state.selected);
    if (state.selected && state.selected.indexOf('live:') === 0) p.set('ld', state.selected.slice(5));
    var next = p.toString();
    var base = window.location.pathname + window.location.search;
    window.history.replaceState(null, '', next ? '#' + next : base);
  }

  function median(nums) {
    if (!nums.length) return null;
    var s = nums.slice().sort(function (a, b) { return a - b; });
    var mid = Math.floor(s.length / 2);
    return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2;
  }
  function fillMeta() {
    $('meta-asof').textContent = DATA.as_of || '—';
    $('meta-floor').textContent = fmtMoney(DATA.floor_usd);
    $('meta-count').textContent = String(DATA.board_size || rows.length);
    var watch = rows.filter(function (r) { return r.watchlist; });
    $('stat-coverage').textContent = watch.length + ' / ' + (DATA.watchlist_size || watch.length);
    $('stat-median').textContent = fmtMoney(median(watch.map(function (r) { return r.implied_value_usd; })));
    var cats = {};
    rows.forEach(function (r) { cats[r.category || 'Other'] = true; });
    $('stat-categories').textContent = String(Object.keys(cats).length);
    $('stat-early').textContent = String(rows.filter(function (r) { return r.tvl_usd < (DATA.floor_usd || 0); }).length);
  }

  function chainPreview(chains) {
    if (!chains || !chains.length) return 'no chain listed';
    var shown = chains.slice(0, 3).join(', ');
    return chains.length > 3 ? shown + ' +' + (chains.length - 3) + ' more' : shown;
  }

  function validateFilters() {
    var catOpts = new Set();
    document.querySelectorAll('#category option').forEach(function (o) { catOpts.add(o.value); });
    if (!catOpts.has(state.category)) state.category = 'all';
    var chainOpts = new Set();
    document.querySelectorAll('#chain option').forEach(function (o) { chainOpts.add(o.value); });
    if (!chainOpts.has(state.chain)) state.chain = 'all';
    var liveCatOpts = new Set();
    document.querySelectorAll('#live-category option').forEach(function (o) { liveCatOpts.add(o.value); });
    if (!liveCatOpts.has(liveState.category)) liveState.category = 'all';
  }
  function fillSelects() {
    var cats = {}, chains = {};
    rows.forEach(function (r) {
      cats[r.category || 'Other'] = true;
      (r.chains || []).forEach(function (c) { chains[c] = true; });
    });
    var catSel = $('category'), chainSel = $('chain');
    Object.keys(cats).sort().forEach(function (c) {
      catSel.appendChild(el('option', null, c)).value = c;
    });
    Object.keys(chains).sort().forEach(function (c) {
      chainSel.appendChild(el('option', null, c)).value = c;
    });
    catSel.value = state.category;
    chainSel.value = state.chain;
    var liveCatSel = $('live-category');
    var liveCats = {};
    live.forEach(function (r) { liveCats[r.category || 'Other'] = true; });
    Object.keys(liveCats).sort().forEach(function (c) {
      liveCatSel.appendChild(el('option', null, c)).value = c;
    });
    liveCatSel.value = liveState.category;
    validateFilters();
  }

  function filtered() {
    var q = state.q.trim().toLowerCase();
    return rows.filter(function (r) {
      if (state.category !== 'all' && (r.category || 'Other') !== state.category) return false;
      if (state.chain !== 'all' && (r.chains || []).indexOf(state.chain) < 0) return false;
      if (state.watchlistOnly && !r.watchlist) return false;
      if (state.plan === 'deployable' && !(r.farm.deployed_usd > 0)) return false;
      if (state.plan === 'research' && r.farm.deployed_usd > 0) return false;
      if (state.minTvl > 0 && !(r.tvl_usd >= state.minTvl)) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }

  function sorted(list) {
    var key = state.sort, dir = state.dir;
    return list.slice().sort(function (a, b) {
      if (key === 'age' || key === 'change') {
        var av0 = key === 'age' ? a.age_days : a.change_7d;
        var bv0 = key === 'age' ? b.age_days : b.change_7d;
        if (av0 === null && bv0 === null) return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
        if (av0 === null) return 1;
        if (bv0 === null) return -1;
      }
      var av, bv;
      if (key === 'name') { av = String(a.name).toLowerCase(); bv = String(b.name).toLowerCase(); }
      else if (key === 'tvl') { av = a.tvl_usd; bv = b.tvl_usd; }
      else if (key === 'change') { av = a.change_7d === null ? -Infinity : a.change_7d; bv = b.change_7d === null ? -Infinity : b.change_7d; }
      else if (key === 'age') { av = a.age_days === null ? Infinity : a.age_days; bv = b.age_days === null ? Infinity : b.age_days; }
      else if (key === 'implied') { av = a.implied_value_usd; bv = b.implied_value_usd; }
      else { av = a.rank; bv = b.rank; }
      if (av < bv) return -dir;
      if (av > bv) return dir;
      return a.slug < b.slug ? -1 : a.slug > b.slug ? 1 : 0;
    });
  }

  function renderBoard() {
    var list = sorted(filtered());
    var body = $('board-body');
    body.textContent = '';
    var max = 1;
    rows.forEach(function (r) { if (r.implied_value_usd > max) max = r.implied_value_usd; });
    list.forEach(function (r) {
      var tr = el('tr');
      tr.setAttribute('data-slug', r.slug);
      if (state.selected === r.slug) tr.setAttribute('data-selected', 'true');
      tr.addEventListener('click', function () { openDetail(r.slug); });
      tr.appendChild(el('td', 'num', String(r.rank)));
      var nameCell = el('td');
      var nameBox = el('div', 'name');
      var nameBtn = el('button', 'name-btn', r.name);
      nameBtn.setAttribute('type', 'button');
      nameBtn.addEventListener('click', function (e) { e.stopPropagation(); openDetail(r.slug); });
      nameBox.appendChild(nameBtn);
      nameBox.appendChild(el('span', 'sub', (r.category || 'Other') + ' · ' + chainPreview(r.chains)));
      nameCell.appendChild(nameBox);
      tr.appendChild(nameCell);
      var impCell = el('td', 'num');
      var bar = el('span', 'bar');
      bar.setAttribute('aria-hidden', 'true');
      var fill = el('i');
      fill.style.width = ((r.implied_value_usd / max) * 100).toFixed(2) + '%';
      bar.appendChild(fill);
      impCell.appendChild(bar);
      var imp = el('span', null, fmtMoney(r.implied_value_usd));
      imp.title = fmtFull(r.implied_value_usd);
      impCell.appendChild(imp);
      tr.appendChild(impCell);
      var tvl = el('td', 'num', fmtMoney(r.tvl_usd));
      tvl.title = fmtFull(r.tvl_usd);
      tr.appendChild(tvl);
      var chg = el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), fmtPct(r.change_7d));
      tr.appendChild(chg);
      tr.appendChild(el('td', 'num', fmtAge(r.age_days)));
      var wl = el('td');
      wl.appendChild(el('span', r.watchlist ? 'badge' : 'badge off', r.watchlist ? 'watchlist' : '—'));
      tr.appendChild(wl);
      var plan = el('td');
      plan.appendChild(el('span', r.farm.deployed_usd > 0 ? 'badge' : 'badge off', r.farm.deployed_usd > 0 ? 'planned' : 'research'));
      tr.appendChild(plan);
      body.appendChild(tr);
    });
    $('board-empty').hidden = list.length > 0;
    $('board-table').style.display = list.length ? '' : 'none';
    var dep = list.filter(function (r) { return r.farm.deployed_usd > 0; }).length;
    $('row-count').textContent = list.length + ' of ' + rows.length + ' rows shown · ' + dep + ' deployment planned, ' + (list.length - dep) + ' research-only · ranks are board ranks';
    document.querySelectorAll('#board-table th .arrow').forEach(function (a) {
      var key = a.getAttribute('data-arrow');
      a.textContent = state.sort === key ? (state.dir < 0 ? '↓' : '↑') : '';
    });
    document.querySelectorAll('#board-table thead th').forEach(function (th) {
      var b = th.querySelector('button[data-sort]');
      if (!b) { th.removeAttribute('aria-sort'); return; }
      var key = b.getAttribute('data-sort');
      if (state.sort === key) th.setAttribute('aria-sort', state.dir < 0 ? 'descending' : 'ascending');
      else th.removeAttribute('aria-sort');
    });
  }

  var liveState = { q: '', category: 'all', sort: 'mcap', dir: -1 };
  function filteredLive() {
    var q = liveState.q.trim().toLowerCase();
    return live.filter(function (r) {
      if (liveState.category !== 'all' && (r.category || 'Other') !== liveState.category) return false;
      if (!q) return true;
      var hay = [r.name, r.slug, r.category, (r.chains || []).join(' ')].join(' ').toLowerCase();
      return hay.indexOf(q) >= 0;
    });
  }
  function renderLive() {
    var body = $('live-body');
    body.textContent = '';
    var list = filteredLive().slice().sort(function (a, b) {
      var av = liveState.sort === 'tvl' ? (a.tvl_usd || 0) : (a.mcap_usd || 0);
      var bv = liveState.sort === 'tvl' ? (b.tvl_usd || 0) : (b.mcap_usd || 0);
      if (av === bv) return a.slug < b.slug ? -1 : 1;
      return (bv - av) * (liveState.dir < 0 ? 1 : -1);
    });
    list.forEach(function (r) {
      var tr = el('tr');
      tr.setAttribute('data-slug', r.slug);
      if (state.selected === 'live:' + r.slug) tr.setAttribute('data-selected', 'true');
      tr.addEventListener('click', function () { openLiveDetail(r.slug); });
      var nameCell = el('td');
      var nameBox = el('div', 'name');
      var nameBtn = el('button', 'name-btn', r.name);
      nameBtn.setAttribute('type', 'button');
      nameBtn.addEventListener('click', function (e) { e.stopPropagation(); openLiveDetail(r.slug); });
      nameBox.appendChild(nameBtn);
      nameBox.appendChild(el('span', 'sub', (r.category || 'Other') + ' · ' + chainPreview(r.chains)));
      nameCell.appendChild(nameBox);
      tr.appendChild(nameCell);
      var mc = el('td', 'num', fmtMoney(r.mcap_usd));
      mc.title = fmtFull(r.mcap_usd);
      tr.appendChild(mc);
      var tvl = el('td', 'num', fmtMoney(r.tvl_usd));
      tvl.title = fmtFull(r.tvl_usd);
      tr.appendChild(tvl);
      tr.appendChild(el('td', 'num ' + (r.change_7d === null ? '' : r.change_7d >= 0 ? 'pos' : 'neg'), fmtPct(r.change_7d)));
      var st = el('td');
      st.appendChild(el('span', 'badge off', 'live token'));
      tr.appendChild(st);
      body.appendChild(tr);
    });
    $('live-empty').hidden = list.length > 0;
    $('live-table').style.display = list.length ? '' : 'none';
    $('live-count').textContent = list.length + ' of ' + live.length + ' shown · the 24 largest non-CEX live-token protocols in the snapshot, selected by market cap';
    document.querySelectorAll('#live-table th .arrow').forEach(function (a) {
      var key = a.getAttribute('data-arrow');
      a.textContent = liveState.sort === key ? (liveState.dir < 0 ? '↓' : '↑') : '';
    });
    document.querySelectorAll('#live-table thead th').forEach(function (th) {
      var b = th.querySelector('button[data-sort-live]');
      if (!b) { th.removeAttribute('aria-sort'); return; }
      var key = b.getAttribute('data-sort-live');
      if (liveState.sort === key) th.setAttribute('aria-sort', liveState.dir < 0 ? 'descending' : 'ascending');
      else th.removeAttribute('aria-sort');
    });
  }

  function renderPeers() {
    var body = $('peers-body');
    body.textContent = '';
    peers.slice().sort(function (a, b) {
      return String(a.category).localeCompare(String(b.category));
    }).forEach(function (p) {
      var tr = el('tr');
      tr.appendChild(el('td', null, p.category));
      tr.appendChild(el('td', 'num', String(p.n)));
      tr.appendChild(el('td', 'num', fmtMult(p.geomean)));
      tr.appendChild(el('td', 'num', dec(p.weight, 3)));
      tr.appendChild(el('td', 'num', fmtMult(p.multiple)));
      body.appendChild(tr);
    });
  }

  function renderCohort() {
    var body = $('cohort-body');
    if (!body) return;
    body.textContent = '';
    var cohort = Array.isArray(DATA.calibration_peers) ? DATA.calibration_peers : [];
    cohort.forEach(function (p) {
      var tr = el('tr');
      tr.appendChild(el('td', null, p.name));
      tr.appendChild(el('td', null, p.category));
      var mc = el('td', 'num', fmtMoney(p.mcap_usd));
      mc.title = fmtFull(p.mcap_usd);
      tr.appendChild(mc);
      var tvl = el('td', 'num', fmtMoney(p.tvl_usd));
      tvl.title = fmtFull(p.tvl_usd);
      tr.appendChild(tvl);
      tr.appendChild(el('td', 'num', p.tvl_usd ? dec(p.mcap_usd / p.tvl_usd, 3) + '×' : 'n/a'));
      body.appendChild(tr);
    });
    $('cohort-count').textContent = cohort.length + ' peers · largest market cap first';
  }

  function renderConstants() {
    var dl = $('model-constants');
    dl.textContent = '';
    var m = DATA.model || {};
    function add(key, value) {
      if (value === null || value === undefined) return;
      if (key === 'evaluation') return;
      if (typeof value === 'object') {
        Object.keys(value).forEach(function (k) { add(key + '.' + k, value[k]); });
        return;
      }
      var dt = el('dt', null, key);
      var dd = el('dd', null, typeof value === 'number' ? dec(value, 4).replace(/0+$/, '').replace(/\.$/, '') : String(value));
      dl.appendChild(dt);
      dl.appendChild(dd);
    }
    Object.keys(m).forEach(function (k) { add(k, m[k]); });
    if (!dl.children.length) dl.appendChild(el('dd', null, 'No constants supplied with this snapshot.'));
  }

  function pct(x) { return (x * 100).toFixed(1) + '%'; }
  function renderEvaluation() {
    var box = $('model-eval');
    if (!box) return;
    box.textContent = '';
    var ev = DATA.model && DATA.model.evaluation;
    if (!ev) { box.appendChild(el('p', null, 'No calibration evaluation was shipped with this snapshot.')); return; }
    box.appendChild(el('p', null,
      'Leave-one-out check on the ' + ev.n + ' live-token peers that calibrate the model ' +
      '(MedAPE = median absolute percentage error). Predicting each peer\u2019s market cap from the other ' +
      'peers\u2019 category geomean: MedAPE ' + pct(ev.category_geomean_medape) + '; the global geomean gives ' +
      pct(ev.global_geomean_medape) + ', and a flat 0.25\u00d7 TVL gives ' + pct(ev.flat_025_medape) + '. The full model scores MedAPE ' +
      pct(ev.full_model_medape) + ' vs the starter\u2019s ' + pct(ev.starter_medape) + ', and Spearman ' + dec(ev.spearman_full, 3) +
      ' vs the starter\u2019s ' + dec(ev.spearman_starter, 3) + ' and TVL alone at ' + dec(ev.spearman_tvl, 3) +
      ' \u2014 TVL alone, still the strongest ranking baseline. Read honestly: mcap/TVL varies by two orders of ' +
      'magnitude inside most categories, the constants were chosen on this cohort (treat these scores as development ' +
      'diagnostics, not a generalization claim), and the win is narrow. The win comes from the calibration shape: a ' +
      'leave-one-out median takes only two values here and moves against the held-out peer, so the model uses geomeans ' +
      'shrunk 80% toward a fixed 0.2 prior \u2014 which only dampens that sensitivity \u2014 and damps the three factors to ' +
      '0.05; they carry almost no ranking signal.'));
    box.appendChild(el('p', null,
      'Matched comparison (same pipeline, no category multiple): MedAPE ' +
      pct(ev.global_multiple_full_medape) + ' vs ' + pct(ev.full_model_medape) + ', and Spearman ' +
      dec(ev.spearman_global, 3) + ' vs ' + dec(ev.spearman_full, 3) + ', so the category calibration is worth ' +
      dec((ev.global_multiple_full_medape - ev.full_model_medape) * 100, 2) + ' MedAPE points and ' +
      dec(ev.spearman_full - ev.spearman_global, 4) + ' of Spearman. The full model wins on ' + ev.full_wins_vs_starter +
      ' of ' + ev.n + ' peers. Error quartiles: full ' + pct(ev.full_ape_q25) + ' / ' + pct(ev.full_ape_q75) +
      ' vs starter ' + pct(ev.starter_ape_q25) + ' / ' + pct(ev.starter_ape_q75) +
      ' \u2014 lower median and 75th-percentile error. ' +
      'CEX sensitivity: removing the 9 CEX peers moves the shrunk global multiple from ' + dec(ev.cex_global_multiple, 4) +
      ' to ' + dec(ev.cex_free_global_multiple, 4) + ' (about ' + dec((ev.cex_free_global_multiple - ev.cex_global_multiple) / ev.cex_global_multiple * 100, 1) + '%). On the same 119 non-CEX peers: full calibration ' +
      pct(ev.full_medape_nocex_peers) + ' vs CEX-free ' + pct(ev.cex_free_full_medape) +
      ' \u2014 CEX-free wins by a hair on identical peers, so keeping CEX is a wash. ' +
      'Ranks: the board keeps ' + ev.cex_free_top10_overlap +
      ' of its top 10 (max move ' + ev.cex_free_max_rank_move +
      '). Dollar estimates move: mean ' + pct(ev.cex_free_mean_implied_pct) +
      ', max ' + pct(ev.cex_free_max_implied_pct) + ' per row.'));
  }
  function starterImplied(r) {
    var chg = r.change_7d === null ? 0 : Math.max(-60, Math.min(120, r.change_7d));
    var age = r.age_days === null ? 365 : r.age_days;
    return r.tvl_usd * 0.25 * (1 + (chg / 100) * 0.5) * (0.6 + (Math.min(age, 1095) / 1095) * 0.4);
  }
  function renderStarter() {
    var box = $('model-starter');
    if (!box) return;
    box.textContent = '';
    if (!rows.length) return;
    var ratios = rows.map(function (r) { return r.implied_value_usd / starterImplied(r); });
    var med = median(ratios.slice().sort(function (a, b) { return a - b; }));
    var oursTop = rows.slice().sort(function (a, b) { return b.implied_value_usd - a.implied_value_usd; }).slice(0, 10).map(function (r) { return r.slug; });
    var starterTop = rows.slice().sort(function (a, b) { return starterImplied(b) - starterImplied(a); }).slice(0, 10).map(function (r) { return r.slug; });
    var overlap = oursTop.filter(function (s) { return starterTop.indexOf(s) >= 0; }).length;
    var top = rows[0];
    box.appendChild(el('p', null,
      'Against the starter formula (TVL \u00d7 0.25 \u00d7 growth \u00d7 age factor) the median per-protocol model/starter ratio is ' +
      dec(med, 2) + '\u00d7: log-scaled effective TVL compresses giants \u2014 ' +
      'the top row\u2019s ' + fmtMoney(top.tvl_usd) + ' TVL counts as ' + fmtMoney(top.factors.t_eff) + ' of effective TVL before any multiple is applied. ' +
      overlap + ' of our top 10 also appear in the starter top 10 \u2014 the ranking moves where the other factors disagree ' +
      'with raw size. Missing listing date \u2192 365 days, the same fallback the model uses.'));
    box.appendChild(el('p', 'note', 'Starter equations: c = clamp(change_7d, \u221260, 120), missing \u2192 0; growth = 1 + 0.5 \u00d7 c / 100; age factor = 0.6 + 0.4 \u00d7 min(age_days, 1095) / 1095; missing age \u2192 365 days; starter = TVL \u00d7 0.25 \u00d7 growth \u00d7 age factor.'));
  }
  function renderAblation() {
    var box = $('model-ablation');
    if (!box) return;
    box.textContent = '';
    if (!rows.length) return;
    var m = DATA.model || {};
    var gmult = m.global_multiple;
    function top10(v) {
      return v.map(function (_, i) { return i; }).sort(function (a, b) {
        return v[b] - v[a] || (rows[a].slug < rows[b].slug ? -1 : 1);
      }).slice(0, 10);
    }
    function ranks(v) {
      var o = v.map(function (_, i) { return i; }).sort(function (a, b) { return v[b] - v[a] || (rows[a].slug < rows[b].slug ? -1 : 1); });
      var r = [], i = 0, j, k, avg;
      while (i < o.length) {
        j = i;
        while (j + 1 < o.length && v[o[j + 1]] === v[o[i]]) j++;
        avg = (i + j) / 2 + 1;
        for (k = i; k <= j; k++) r[o[k]] = avg;
        i = j + 1;
      }
      return r;
    }
    function spearman(xs, ys) {
      var rx = ranks(xs), ry = ranks(ys), n = xs.length, mx = 0, my = 0, num = 0, dx = 0, dy = 0, i;
      for (i = 0; i < n; i++) { mx += rx[i]; my += ry[i]; }
      mx /= n; my /= n;
      for (i = 0; i < n; i++) { num += (rx[i] - mx) * (ry[i] - my); dx += (rx[i] - mx) * (rx[i] - mx); dy += (ry[i] - my) * (ry[i] - my); }
      return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
    }
    var full = rows.map(function (r) { return r.implied_value_usd; });
    var fullTop = top10(full);
    function ablated(k) {
      return rows.map(function (r) {
        var f = r.factors || {};
        return (k === 'no-log' ? r.tvl_usd : f.t_eff) * (k === 'no-multiple' ? gmult : f.multiple) *
          (k === 'no-growth' ? 1 : f.growth_mult) * (k === 'no-maturity' ? 1 : f.maturity_mult) *
          (k === 'no-chain' ? 1 : f.chain_mult);
      });
    }
    var variants = [
      ['no-multiple', 'Multiple \u2192 shrunk global'],
      ['no-growth', 'Growth \u2192 1 (neutral)'],
      ['no-maturity', 'Maturity \u2192 1 (neutral)'],
      ['no-chain', 'Chain \u2192 1 (no bonus)'],
      ['no-log', 'Log TVL \u2192 raw TVL']
    ];
    var ul = el('ul');
    variants.forEach(function (v) {
      var vals = ablated(v[0]);
      var top = top10(vals);
      var overlap = top.filter(function (i) { return fullTop.indexOf(i) >= 0; }).length;
      var rF = ranks(full), rN = ranks(vals), maxMove = 0;
      for (var i = 0; i < rows.length; i++) maxMove = Math.max(maxMove, Math.abs(rN[i] - rF[i]));
      var en = top.filter(function (i) { return fullTop.indexOf(i) < 0; }).map(function (i) { return rows[i].name; });
      var ex = fullTop.filter(function (i) { return top.indexOf(i) < 0; }).map(function (i) { return rows[i].name; });
      var d = v[1] + ': ' + overlap + ' of the top 10 stay; Spearman ' + dec(spearman(vals, full), 6) + '; largest move ' + maxMove + '.';
      if (en.length) d += ' Enters: ' + en.join(', ') + '. Leaves: ' + ex.join(', ') + '.';
      ul.appendChild(el('li', null, d));
    });
    box.appendChild(ul);
    box.appendChild(el('p', 'note', 'Ranking sensitivity, not discovery validation: reshuffling does not make a factor better.'));
    var sTop = top10(rows.map(function (r) { return starterImplied(r); }));
    function audit(top) {
      var p = 0, c = {};
      top.forEach(function (i) { if (rows[i].farm.deployed_usd > 0) p++; c[rows[i].category || 'Other'] = 1; });
      return p + ' of 10 with deployment planned, ' + Object.keys(c).length + ' categories';
    }
    box.appendChild(el('p', null, 'Output composition vs the starter top 10 \u2014 full model: ' + audit(fullTop) + '; starter: ' + audit(sTop) + '.'));
  }
  function fillSource() {
    var s = $('model-source');
    if (s) s.textContent = 'Source: ' + (DATA.source || ('snapshot ' + (DATA.as_of || 'unknown date'))) + '. Figures are frozen at that fetch.';
  }

  function peerFor(category) {
    for (var i = 0; i < peers.length; i++) {
      if (peers[i].category === category) return peers[i];
    }
    return null;
  }
  function kvRow(parent, label, value) {
    var row = el('div');
    row.appendChild(el('span', null, label));
    row.appendChild(el('b', null, value));
    parent.appendChild(row);
  }
  function openDetail(slug) {
    var row = null;
    rows.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = slug;
    writeHash();
    lastFocus = { view: 'board', slug: slug };
    $('drawer-rank').textContent = 'Rank ' + row.rank + ' of ' + rows.length + ' · no token recorded';
    $('drawer-title').textContent = row.name;
    $('drawer-sub').textContent = (row.category || 'Other') + ' · ' + ((row.chains && row.chains.length) ? row.chains.join(', ') : 'no chain listed') + ' · slug ' + row.slug;
    var body = $('drawer-body');
    body.textContent = '';

    var facts = el('section');
    facts.appendChild(el('h3', null, 'Snapshot figures'));
    var kv = el('div', 'kv');
    kvRow(kv, 'Implied value', fmtFull(row.implied_value_usd));
    kvRow(kv, 'TVL', fmtFull(row.tvl_usd));
    kvRow(kv, 'Seven-day change', fmtPct(row.change_7d) + (row.change_7d === null ? ' (neutral)' : ''));
    kvRow(kv, 'Listed', row.listed_at || 'unknown');
    kvRow(kv, 'Age since listing', fmtAge(row.age_days));
    kvRow(kv, 'Watchlist', row.watchlist ? 'yes' : 'no');
    facts.appendChild(kv);
    body.appendChild(facts);

    var farm = row.farm || {};
    var plan = el('section');
    plan.appendChild(el('h3', null, 'Farm plan'));
    var cap = el('p');
    if ((farm.deployed_usd || 0) > 0) {
      cap.appendChild(el('span', 'pill', 'Budget $' + (farm.capital === undefined ? '—' : farm.capital)));
      cap.appendChild(document.createTextNode(' '));
      cap.appendChild(el('span', 'pill', 'Deploys up to $' + (farm.deployed_usd === undefined ? '—' : farm.deployed_usd)));
      cap.appendChild(document.createTextNode(' '));
      cap.appendChild(el('span', 'pill', 'Max fees $' + (farm.max_fees_usd === undefined ? '—' : farm.max_fees_usd)));
      cap.appendChild(document.createTextNode(' '));
      cap.appendChild(el('span', 'pill', 'Hold ' + (farm.hold_days === undefined ? '—' : farm.hold_days) + ' days'));
      plan.appendChild(cap);
      plan.appendChild(el('p', 'note', 'Budget is the total set aside: at most the deploy amount leaves the wallet as principal, plus at most the fee caps in fees; the rest stays unspent. Fee caps are a $20 planning budget, not a quote: if a chain\u2019s actual fees exceed them, the stop condition in step 1 applies. Approvals transfer no principal; on-chain approvals consume transaction fees. Redemption attempts to withdraw the remaining position and may return less than the original deposit or be delayed. The snapshot carries no contract addresses or website URL: confirm asset, spender and route in step 1 from the protocol\u2019s official documentation, starting from its DefiLlama listing.'));
    } else {
      cap.appendChild(el('span', 'pill', 'Research only · no funds deployed'));
      cap.appendChild(document.createTextNode(' '));
      cap.appendChild(el('span', 'pill', 'Recheck in ' + (farm.hold_days === undefined ? '—' : farm.hold_days) + ' days'));
      plan.appendChild(cap);
      plan.appendChild(el('p', 'note', 'This plan is research only: it verifies the protocol without moving funds, so no budget is deployed and no fees apply. Whether deployment is possible cannot be told from the snapshot, which carries no product or route information. It becomes actionable when a verifiable on-chain route exists for this product \u2014 a deposit interface with a contract address, or an equivalent interaction. Recheck then for a token announcement, a live deposit product, and audited contracts.'));
    }
    var steps = Array.isArray(farm.steps) ? farm.steps : [];
    var ol = el('ol', 'steps');
    steps.forEach(function (s) {
      var li = el('li');
      var at = String(s).indexOf(' — ');
      if (at >= 0) {
        li.appendChild(document.createTextNode(String(s).slice(0, at)));
        li.appendChild(el('span', 'cost', String(s).slice(at + 3)));
      } else {
        li.appendChild(document.createTextNode(String(s)));
      }
      ol.appendChild(li);
    });
    plan.appendChild(ol);
    body.appendChild(plan);

    var f = row.factors || {};
    var peer = peerFor(row.category);
    var gmult = DATA.model ? DATA.model.global_multiple : null;
    var model = el('section');
    model.appendChild(el('h3', null, 'Model breakdown'));
    var mkv = el('div', 'kv');
    kvRow(mkv, 'Effective TVL (T_eff)', fmtFull(f.t_eff));
    kvRow(mkv, 'Category multiple', fmtMult(f.multiple) + (peer ? ' · ' + peer.n + ' live peers, category geomean ' + fmtMult(peer.geomean) + ', category weight ' + dec(peer.weight, 3) + ' toward shrunk global ' + fmtMult(gmult) : ' · shrunk global fallback'));
    kvRow(mkv, 'Growth multiplier', f.growth_mult === undefined ? 'n/a' : fmtMult(f.growth_mult));
    kvRow(mkv, 'Maturity multiplier', f.maturity_mult === undefined ? 'n/a' : fmtMult(f.maturity_mult));
    kvRow(mkv, 'Chain multiplier', f.chain_mult === undefined ? 'n/a' : fmtMult(f.chain_mult) + ' · ' + ((row.chains && row.chains.length) || 0) + ' chain(s)');
    mkv.appendChild(el('p', 'note', 'Implied value = T_eff × multiple × growth × maturity × chain. The multiple blends the category geomean with the shrunk global multiple (0.15 × n/(n+12)), then clamps; the global blends the cohort geomean toward a fixed 0.2 prior. Factors are damped to 0.05. Growth missing → neutral. Age missing → 365-day fallback. No chains → no chain bonus.'));
    mkv.appendChild(el('p', 'note', 'Check (approximate \u2014 operands are rounded): ' + fmtFull(f.t_eff) + ' \u00d7 ' + dec(f.multiple, 6) + ' \u00d7 ' + dec(f.growth_mult, 6) + ' \u00d7 ' + dec(f.maturity_mult, 6) + ' \u00d7 ' + dec(f.chain_mult, 6) + ' \u2248 ' + fmtFull(row.implied_value_usd) + '. The exact product is rounded to whole dollars.'));
    model.appendChild(mkv);
    body.appendChild(model);

    $('drawer').hidden = false;
    $('backdrop').hidden = false;
    $('drawer-close').focus();
    setDrawerOpen(true);
    renderBoard();
  }
  function openLiveDetail(slug) {
    var row = null;
    live.forEach(function (r) { if (r.slug === slug) row = r; });
    if (!row) return;
    state.selected = 'live:' + slug;
    writeHash();
    lastFocus = { view: 'live', slug: slug };
    $('drawer-rank').textContent = 'Live token · already trading';
    $('drawer-title').textContent = row.name;
    $('drawer-sub').textContent = (row.category || 'Other') + ' · ' + ((row.chains && row.chains.length) ? row.chains.join(', ') : 'no chain listed') + ' · slug ' + row.slug;
    var body = $('drawer-body');
    body.textContent = '';
    var facts = el('section');
    facts.appendChild(el('h3', null, 'Market facts'));
    var kv = el('div', 'kv');
    kvRow(kv, 'Market cap', fmtFull(row.mcap_usd));
    kvRow(kv, 'TVL', fmtFull(row.tvl_usd));
    kvRow(kv, 'Seven-day change', fmtPct(row.change_7d) + (row.change_7d === null ? ' (neutral)' : ''));
    kvRow(kv, 'mcap / TVL', row.tvl_usd ? dec(row.mcap_usd / row.tvl_usd, 3) + '×' : 'n/a');
    kv.appendChild(el('p', 'note', 'This protocol already trades, so it has a market cap — a market fact, not a model estimate. Never ranked as implied value; no farm plan.'));
    facts.appendChild(kv);
    body.appendChild(facts);
    $('drawer').hidden = false;
    $('backdrop').hidden = false;
    $('drawer-close').focus();
    setDrawerOpen(true);
    renderLive();
  }
  function setDrawerOpen(open) {
    var top = document.querySelector('header.top');
    var shell = document.querySelector('main.shell');
    var skip = document.querySelector('.skip');
    if (top) { if (open) top.setAttribute('inert', ''); else top.removeAttribute('inert'); }
    if (shell) { if (open) shell.setAttribute('inert', ''); else shell.removeAttribute('inert'); }
    if (skip) { if (open) skip.setAttribute('inert', ''); else skip.removeAttribute('inert'); }
    document.body.style.overflow = open ? 'hidden' : '';
  }
  function closeDetail() {
    state.selected = null;
    $('drawer').hidden = true;
    $('backdrop').hidden = true;
    setDrawerOpen(false);
    writeHash();
    renderBoard();
    renderLive();
    var target = null;
    if (lastFocus && lastFocus.slug) {
      var visible = (lastFocus.view === 'live' && state.tab === 'live') || (lastFocus.view === 'board' && state.tab === 'board');
      if (visible) {
        var table = lastFocus.view === 'live' ? $('live-table') : $('board-table');
        if (table) target = table.querySelector('tr[data-slug="' + lastFocus.slug + '"] .name-btn');
      }
    }
    if (target) target.focus();
    else if (lastFocus && lastFocus.view === 'live' && state.tab === 'live') $('tab-live').focus();
    else $('tab-' + state.tab).focus();
    lastFocus = null;
  }

  function setTab(tab) {
    state.tab = tab;
    ['board', 'live', 'model', 'peers'].forEach(function (t) {
      $('view-' + t).hidden = t !== tab;
      var b = $('tab-' + t);
      b.setAttribute('aria-selected', t === tab ? 'true' : 'false');
      b.setAttribute('tabindex', t === tab ? '0' : '-1');
    });
    var statusVal = tab === 'live' ? 'live' : 'pre-token';
    if ($('status')) $('status').value = statusVal;
    if ($('live-status')) $('live-status').value = statusVal;
    writeHash();
  }

  function syncControls() {
    $('q').value = state.q;
    $('category').value = state.category;
    $('chain').value = state.chain;
    $('min-tvl').value = state.minTvl > 0 ? String(state.minTvl) : '';
    $('plan').value = state.plan;
    $('watchlist-only').checked = state.watchlistOnly;
    $('live-q').value = liveState.q;
    $('live-category').value = liveState.category;
    var statusVal = state.tab === 'live' ? 'live' : 'pre-token';
    $('status').value = statusVal;
    $('live-status').value = statusVal;
  }
  function renderAll() {
    syncControls();
    setTab(state.tab);
    renderBoard();
    renderLive();
    renderPeers();
    renderCohort();
    renderConstants();
    renderEvaluation();
    renderAblation();
    renderStarter();
    fillSource();
  }

  document.querySelectorAll('[data-tab]').forEach(function (b) {
    b.addEventListener('click', function () { setTab(b.getAttribute('data-tab')); });
  });
  document.querySelector('.tabs').addEventListener('keydown', function (e) {
    var tabs = ['board', 'live', 'model', 'peers'];
    var i = tabs.indexOf(state.tab);
    var next = null;
    if (e.key === 'ArrowRight') next = tabs[(i + 1) % tabs.length];
    else if (e.key === 'ArrowLeft') next = tabs[(i + tabs.length - 1) % tabs.length];
    else if (e.key === 'Home') next = tabs[0];
    else if (e.key === 'End') next = tabs[tabs.length - 1];
    if (next) { e.preventDefault(); setTab(next); $('tab-' + next).focus(); }
  });
  document.querySelectorAll('th button[data-sort]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-sort');
      if (state.sort === key) state.dir = -state.dir;
      else { state.sort = key; state.dir = key === 'rank' || key === 'name' ? 1 : -1; }
      writeHash(); renderBoard();
    });
  });
  $('q').addEventListener('input', function () { state.q = $('q').value; writeHash(); renderBoard(); });
  $('category').addEventListener('change', function () { state.category = $('category').value; writeHash(); renderBoard(); });
  $('chain').addEventListener('change', function () { state.chain = $('chain').value; writeHash(); renderBoard(); });
  $('min-tvl').addEventListener('input', function () { state.minTvl = Math.max(0, Number($('min-tvl').value) || 0); writeHash(); renderBoard(); });
  $('plan').addEventListener('change', function () { state.plan = $('plan').value; writeHash(); renderBoard(); });
  $('watchlist-only').addEventListener('change', function () { state.watchlistOnly = $('watchlist-only').checked; writeHash(); renderBoard(); });
  $('status').addEventListener('change', function () { var t = $('status').value === 'live' ? 'live' : 'board'; setTab(t); $('tab-' + t).focus(); });
  $('live-status').addEventListener('change', function () { var t = $('live-status').value === 'live' ? 'live' : 'board'; setTab(t); $('tab-' + t).focus(); });
  $('live-q').addEventListener('input', function () { liveState.q = $('live-q').value; writeHash(); renderLive(); });
  $('live-category').addEventListener('change', function () { liveState.category = $('live-category').value; writeHash(); renderLive(); });
  document.querySelectorAll('#live-table th button[data-sort-live]').forEach(function (b) {
    b.addEventListener('click', function () {
      var key = b.getAttribute('data-sort-live');
      if (liveState.sort === key) liveState.dir = -liveState.dir;
      else { liveState.sort = key; liveState.dir = -1; }
      writeHash(); renderLive();
    });
  });
  $('clear-filters').addEventListener('click', function () {
    state.q = ''; state.category = 'all'; state.chain = 'all'; state.minTvl = 0; state.plan = 'all'; state.watchlistOnly = false;
    writeHash(); renderAll();
  });
  document.querySelector('.skip').addEventListener('click', function (e) {
    e.preventDefault();
    setTab('board');
    var t = $('board-table');
    if (t.style.display === 'none') {
      var em = $('board-empty');
      em.setAttribute('tabindex', '-1');
      em.scrollIntoView();
      em.focus();
      return;
    }
    t.setAttribute('tabindex', '-1');
    t.scrollIntoView();
    t.focus();
  });
  $('eval-download').addEventListener('click', function () {
    var ev = DATA.model && DATA.model.evaluation;
    if (!ev) return;
    var blob = new Blob([JSON.stringify(ev, null, 2)], { type: 'application/json' });
    var a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'token-radar-01-evaluation.json';
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(a.href); }, 1000);
  });
  $('drawer-close').addEventListener('click', closeDetail);
  $('backdrop').addEventListener('click', closeDetail);
  document.addEventListener('keydown', function (e) {
    if (e.key === 'Escape' && !$('drawer').hidden) closeDetail();
    if (e.key === 'Tab' && !$('drawer').hidden) { e.preventDefault(); $('drawer-close').focus(); }
  });
  function openSelected() {
    if (!state.selected) return false;
    var isLive = state.selected.indexOf('live:') === 0;
    var slug = isLive ? state.selected.slice(5) : state.selected;
    var pool = isLive ? live : rows;
    if (!pool.some(function (r) { return r.slug === slug; })) return false;
    if (isLive) openLiveDetail(slug); else openDetail(state.selected);
    return true;
  }
  window.addEventListener('hashchange', function () {
    var keep = state.selected;
    hydrating = true;
    readHash();
    validateFilters();
    syncControls();
    setTab(state.tab);
    renderBoard();
    renderLive();
    var normalized = false;
    if (state.selected) {
      if (state.selected !== keep && !openSelected()) {
        state.selected = null;
        normalized = true;
        if (!$('drawer').hidden) closeDetail();
      }
    } else if (!state.selected && keep) closeDetail();
    hydrating = false;
    if (normalized) writeHash();
  });

  hydrating = true;
  readHash();
  fillMeta();
  fillSelects();
  renderAll();
  hydrating = false;
  if (state.selected && !openSelected()) {
    state.selected = null;
    writeHash();
  }
})();
