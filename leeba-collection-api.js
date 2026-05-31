/* ============================================================
   LEEBA — Collection Page Logic  (API Version)

   DATA SOURCE: Google Sheets via Apps Script API
   ─────────────────────────────────────────────
   • Page loads → check localStorage for cached data.
   • If cache exists: show collection immediately, then
     silently refresh from API in the background.
   • If no cache: show loading screen, fetch from API.
   • "Refresh Data" button: manual re-fetch from API.

   No Excel file needed — data comes from the live API URL.
   ============================================================ */

/* ─────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────── */
var API_URL   = 'https://script.google.com/macros/s/AKfycbxrmx77TuZv1HrN_pz40zB4znh1nEX7Rn6Nurc184bP1jx3YcQ3vOcB--LQP3Mb3zh3CA/exec?action=products';
var DNA_PAGE  = 'leeba-product.html';
var WA_NUM    = '919979460555';
var CAT_ORDER = ['RING','BRACELET','EARRING','EARING','NECKLACE','PENDANT','BANGLE'];
var TONE_LABEL = { W:'White', Y:'Yellow', YW:'Yel/Wht', R:'Rose', RW:'Rose/Wht', D:'Dual' };

/* Maps the API's MetalTone full-word values to internal single-letter codes */
var TONE_CODE  = {
  'WHITE'        : 'W',
  'YELLOW'       : 'Y',
  'ROSE'         : 'R',
  'DUAL'         : 'D',
  'PINK'         : 'R',
  'YEL/WHT'      : 'YW',
  'YELLOW WHITE' : 'YW',
  'YELLOW/WHITE' : 'YW',
  'ROSE WHITE'   : 'RW',
  'ROSE/WHITE'   : 'RW',
  'RWG'          : 'RW'
};
var LS_KEY    = 'leeba_products_api_v1';
var LS_DATE   = 'leeba_loaded_date_api';

/* ─────────────────────────────────────────────────
   STATE
───────────────────────────────────────────────── */
var PRODUCTS        = [];
var sortCol         = 'idx';
var sortDir         = 1;
var activeCats      = new Set();
var activePurities  = new Set();
var activeTones     = new Set();
var activeLocations = new Set();

/* Maps filter IDs to their active-selection Sets */
var MS_STATE = { fp: activePurities, ft: activeTones, flt: activeLocations };

/* Display labels for each filter's values */
var MS_LABELS = {
  fp:  { '10KT':'10 KT', '14KT':'14 KT', '18KT':'18 KT', '22KT':'22 KT' },
  ft:  { W:'White', Y:'Yellow', YW:'Yel/Wht', R:'Rose', RW:'Rose/Wht', D:'Dual' },
  flt: {}
};

/* ─────────────────────────────────────────────────
   UI HELPERS
───────────────────────────────────────────────── */
function showLoadingScreen() {
  document.getElementById('loading-screen').style.display = 'flex';
  document.getElementById('collection-ui').style.display  = 'none';
}

function hideLoadingScreen() {
  document.getElementById('loading-screen').style.display = 'none';
}

function showCollection() {
  document.getElementById('loading-screen').style.display = 'none';
  document.getElementById('collection-ui').style.display  = 'flex';
}

function showLoadingState(on) {
  var el = document.getElementById('ls-loading');
  if (el) el.style.display = on ? '' : 'none';
  var er = document.getElementById('ls-error');
  if (er) er.style.display = 'none';
}

function showLoadingError(msg) {
  var el = document.getElementById('ls-loading');
  if (el) el.style.display = 'none';
  var er = document.getElementById('ls-error');
  var em = document.getElementById('ls-err-msg');
  if (em) em.textContent = msg;
  if (er) er.style.display = '';
}

function updateHeaderInfo(count, dateStr) {
  var el = document.getElementById('loaded-info');
  if (el) el.textContent = count + ' products  ·  Updated: ' + dateStr;
}

/* Toast notification */
var _toastTimer = null;
function showToast(msg, isError) {
  var t = document.getElementById('toast');
  if (!t) return;
  clearTimeout(_toastTimer);
  t.textContent = msg;
  t.className = 'toast' + (isError ? ' toast-error' : ' toast-ok') + ' show';
  _toastTimer = setTimeout(function() { t.classList.remove('show'); }, 4000);
}

/* ─────────────────────────────────────────────────
   API — FETCH & PARSE
───────────────────────────────────────────────── */

/*
  Extract the rows array from whatever the API returns.
  Handles: plain array, { data:[...] }, { products:[...] }
*/
function extractRows(json) {
  if (Array.isArray(json))                return json;
  if (json && Array.isArray(json.data))     return json.data;
  if (json && Array.isArray(json.products)) return json.products;
  if (json && Array.isArray(json.items))    return json.items;
  if (json && Array.isArray(json.rows))     return json.rows;
  return [];
}

function fmtNum(v, d) {
  if (v === '' || v == null) return '';
  var n = Number(v);
  return isNaN(n) ? '' : n.toFixed(d != null ? d : 2);
}

/* Parse a single JSON row into a product object
   ─────────────────────────────────────────────
   Exact field names from the API (as confirmed by sample data):
     SKU, Decription (sic — typo in source), category, location,
     Purity (number, e.g. 18), MetalTone (full word, e.g. "WHITE"),
     grossWgt, netWgt, diaWgt, diaPcs, size, num
*/
function parseApiRow(row, idx) {

  /* SKU — required; skip row if missing */
  var stockId = String(row.SKU || '').trim();
  if (!stockId) return null;

  /* Purity: API sends a number (18) → we store as "18KT" */
  var purNum = row.Purity != null ? String(row.Purity).trim() : '';
  var purity = purNum ? purNum + 'KT' : '';
  if (!purity) return null;                /* cannot determine metal — skip */

  /* MetalTone: API sends full word ("WHITE") → convert to internal code ("W")
     Falls back to first character if unrecognised, e.g. "YELLOW-WHITE" → "Y" */
  var toneRaw  = String(row.MetalTone || '').trim().toUpperCase();
  var metalTone = TONE_CODE[toneRaw] || (toneRaw.charAt(0) || '');

  /* Location */
  var location = String(row.location || '').trim();

  /* Description — note the typo "Decription" in the source JSON */
  var description = String(row.Decription || row.Description || row.description || '').trim();

  /* Size (new field — stored in description supplement if needed) */
  var size = String(row.size || '').trim();

  return {
    idx:         idx,
    sku:         stockId,
    category:    String(row.category || '').trim().toUpperCase(),
    purity:      purity,
    metalTone:   metalTone,
    grossWt:     fmtNum(row.grossWgt, 2),   /* grossWgt (g, not t) */
    netWt:       fmtNum(row.netWgt,   2),   /* netWgt   (g, not t) */
    diaWgt:      fmtNum(row.diaWgt,   2),
    diaPcs:      row.diaPcs != null ? String(row.diaPcs) : '',
    description: description,
    size:        size,
    location:    location,
    num:         String(row.num || '')
  };
}

/* Convert rows array into product array */
function parseRows(rows) {
  var products = [];
  rows.forEach(function(row) {
    var p = parseApiRow(row, products.length + 1);
    if (p) products.push(p);
  });
  return products;
}

/* ─────────────────────────────────────────────────
   API FETCH
───────────────────────────────────────────────── */
function fetchProducts(isManualRefresh) {
  /* If no cached data, show full loading screen */
  var hasCached = !!loadFromStorage();
  if (!hasCached) {
    showLoadingScreen();
    showLoadingState(true);
  } else if (isManualRefresh) {
    var info = document.getElementById('loaded-info');
    if (info) info.textContent = 'Refreshing…';
  }

  fetch(API_URL, { redirect: 'follow' })
    .then(function(res) {
      if (!res.ok) throw new Error('Server returned HTTP ' + res.status);
      return res.json();
    })
    .then(function(json) {
      var rows     = extractRows(json);
      if (rows.length === 0) throw new Error('API returned no rows. Check the Apps Script response format.');
      var products = parseRows(rows);
      if (products.length === 0) throw new Error('No valid products found. Check field names in the Apps Script.');

      var dateStr = saveToStorage(products);
      applyProducts(products, dateStr);
      hideLoadingScreen();

      if (isManualRefresh) {
        showToast('\u2714 Refreshed — ' + products.length + ' products loaded.');
      }
    })
    .catch(function(err) {
      var cached = loadFromStorage();
      if (cached) {
        /* Keep showing cached data; just show error toast */
        hideLoadingScreen();
        var dateStr = localStorage.getItem(LS_DATE) || 'previously';
        applyProducts(cached, dateStr);
        showToast('\u26a0 Could not refresh: ' + err.message, true);
      } else {
        /* No cache — show error on loading screen */
        showLoadingError('Failed to load: ' + err.message);
      }
    });
}

/* ─────────────────────────────────────────────────
   SAVE & LOAD  (localStorage)
───────────────────────────────────────────────── */
function saveToStorage(products) {
  var dateStr = new Date().toLocaleDateString('en-IN', {
    day: '2-digit', month: 'short', year: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
  try {
    localStorage.setItem(LS_KEY,  JSON.stringify(products));
    localStorage.setItem(LS_DATE, dateStr);
  } catch(e) { /* storage full — OK, data still works in-session */ }
  return dateStr;
}

function loadFromStorage() {
  try {
    var raw = localStorage.getItem(LS_KEY);
    if (!raw) return null;
    var data = JSON.parse(raw);
    return Array.isArray(data) && data.length > 0 ? data : null;
  } catch(e) { return null; }
}

/* ─────────────────────────────────────────────────
   APPLY LOADED DATA  — build pills, render table
───────────────────────────────────────────────── */
function applyProducts(products, dateStr) {
  PRODUCTS   = products;
  sortCol    = 'idx';
  sortDir    = 1;
  activeCats = new Set();
  resetAllMs();

  updateHeaderInfo(products.length, dateStr);
  showCollection();
  buildPills();
  buildLocationFilter();
  applyFilters();
}

/* ─────────────────────────────────────────────────
   MULTI-SELECT DROPDOWN FUNCTIONS
───────────────────────────────────────────────── */
function toggleMsDropdown(id) {
  var panel  = document.getElementById(id + '-panel');
  var btn    = document.getElementById(id + '-btn');
  var isOpen = panel.classList.contains('open');
  ['fp', 'ft', 'flt'].forEach(function(fid) {
    document.getElementById(fid + '-panel').classList.remove('open');
    document.getElementById(fid + '-btn').classList.remove('open');
  });
  if (!isOpen) {
    panel.classList.add('open');
    btn.classList.add('open');
  }
}

function closeMsDropdown(id) {
  document.getElementById(id + '-panel').classList.remove('open');
  document.getElementById(id + '-btn').classList.remove('open');
}

function onMsChange(id) {
  var panel = document.getElementById(id + '-panel');
  var set   = MS_STATE[id];
  set.clear();
  panel.querySelectorAll('input[type=checkbox]:checked').forEach(function(cb) {
    set.add(cb.value);
  });
  updateMsLabel(id);
  applyFilters();
}

function clearMs(id) {
  var panel = document.getElementById(id + '-panel');
  panel.querySelectorAll('input[type=checkbox]').forEach(function(cb) {
    cb.checked = false;
  });
  MS_STATE[id].clear();
  updateMsLabel(id);
  closeMsDropdown(id);
  applyFilters();
}

function updateMsLabel(id) {
  var set = MS_STATE[id];
  var lbl = document.getElementById(id + '-lbl');
  if (!lbl) return;
  if (set.size === 0) {
    lbl.textContent = 'All';
    lbl.classList.remove('has-val');
  } else if (set.size === 1) {
    var val  = Array.from(set)[0];
    var disp = (MS_LABELS[id] && MS_LABELS[id][val]) ? MS_LABELS[id][val] : val;
    lbl.textContent = disp;
    lbl.classList.add('has-val');
  } else {
    lbl.textContent = set.size + ' selected';
    lbl.classList.add('has-val');
  }
}

function resetMs(id) {
  var panel = document.getElementById(id + '-panel');
  if (panel) {
    panel.querySelectorAll('input[type=checkbox]').forEach(function(cb) { cb.checked = false; });
    panel.classList.remove('open');
  }
  var btn = document.getElementById(id + '-btn');
  if (btn) btn.classList.remove('open');
  if (MS_STATE[id]) MS_STATE[id].clear();
  updateMsLabel(id);
}

function resetAllMs() {
  ['fp', 'ft', 'flt'].forEach(resetMs);
}

/* ─────────────────────────────────────────────────
   CATEGORY PILLS
───────────────────────────────────────────────── */
function buildPills() {
  var cats = {};
  PRODUCTS.forEach(function(p) {
    if (p.category) cats[p.category] = (cats[p.category] || 0) + 1;
  });

  var ordered   = CAT_ORDER.filter(function(c) { return cats[c]; });
  var remaining = Object.keys(cats).filter(function(c) { return ordered.indexOf(c) === -1; }).sort();

  document.getElementById('cat-pills').innerHTML =
    ordered.concat(remaining).map(function(c) {
      return '<button class="cat-pill" data-cat="' + c + '" onclick="toggleCat(\'' + c + '\')">'
           + c.charAt(0) + c.slice(1).toLowerCase()
           + ' <span class="pill-ct">' + cats[c] + '</span></button>';
    }).join('');
}

function toggleCat(cat) {
  if (activeCats.has(cat)) activeCats.delete(cat); else activeCats.add(cat);
  document.querySelectorAll('.cat-pill').forEach(function(b) {
    b.classList.toggle('active', activeCats.has(b.dataset.cat));
  });
  applyFilters();
}

/* ─────────────────────────────────────────────────
   LOCATION FILTER — populated dynamically from data
───────────────────────────────────────────────── */
function buildLocationFilter() {
  var seen = {};
  PRODUCTS.forEach(function(p) { if (p.location) seen[p.location] = true; });

  var panel = document.getElementById('flt-panel');
  if (!panel) return;

  /* Keep the footer; remove old checkboxes */
  var footer = panel.querySelector('.ms-footer');
  panel.querySelectorAll('.ms-item').forEach(function(el) { el.remove(); });

  MS_LABELS.flt = {};

  Object.keys(seen).sort().forEach(function(loc) {
    var dispName = loc.charAt(0) + loc.slice(1).toLowerCase();
    MS_LABELS.flt[loc] = dispName;

    var label = document.createElement('label');
    label.className = 'ms-item';
    var cb = document.createElement('input');
    cb.type  = 'checkbox';
    cb.value = loc;
    if (activeLocations.has(loc)) cb.checked = true;
    cb.addEventListener('change', function() { onMsChange('flt'); });

    label.appendChild(cb);
    label.appendChild(document.createTextNode('\u00a0' + dispName));
    panel.insertBefore(label, footer);
  });

  updateMsLabel('flt');
}

/* ─────────────────────────────────────────────────
   FILTERS
───────────────────────────────────────────────── */
function applyFilters() {
  var q = document.getElementById('fs').value.toLowerCase().trim();

  var filtered = PRODUCTS.filter(function(p) {
    if (activeCats.size      > 0 && !activeCats.has(p.category))      return false;
    if (activePurities.size  > 0 && !activePurities.has(p.purity))    return false;
    if (activeTones.size     > 0 && !activeTones.has(p.metalTone))    return false;
    if (activeLocations.size > 0 && !activeLocations.has(p.location)) return false;
    if (q) {
      var hay = (p.sku + ' ' + p.description + ' ' + p.location).toLowerCase();
      if (hay.indexOf(q) === -1) return false;
    }
    return true;
  });

  document.getElementById('rc').innerHTML =
    'Showing <strong>' + filtered.length + '</strong> of <strong>' + PRODUCTS.length + '</strong>';

  renderTable(filtered);
  renderCards(filtered);
  updateSummary(filtered);
}

/* ─────────────────────────────────────────────────
   SUMMARY BAR
───────────────────────────────────────────────── */
function updateSummary(data) {
  var count = data.length;
  var gw = 0, nw = 0, dw = 0, dp = 0;
  data.forEach(function(p) {
    gw += parseFloat(p.grossWt)  || 0;
    nw += parseFloat(p.netWt)    || 0;
    dw += parseFloat(p.diaWgt)   || 0;
    dp += parseInt(p.diaPcs, 10) || 0;
  });
  document.getElementById('sum-count').textContent = count;
  document.getElementById('sum-gw').textContent    = gw.toFixed(2) + ' g';
  document.getElementById('sum-nw').textContent    = nw.toFixed(2) + ' g';
  document.getElementById('sum-dw').textContent    = dw.toFixed(2) + ' ct';
  document.getElementById('sum-dp').textContent    = dp;
}

/* ─────────────────────────────────────────────────
   SORT
───────────────────────────────────────────────── */
function setSort(col) {
  if (!col) return;
  sortDir = (sortCol === col) ? sortDir * -1 : 1;
  sortCol = col;
  document.querySelectorAll('thead th').forEach(function(th) {
    th.classList.remove('asc', 'desc');
    if (th.dataset.col === col) th.classList.add(sortDir === 1 ? 'asc' : 'desc');
  });
  applyFilters();
}

function sorted(arr) {
  return arr.slice().sort(function(a, b) {
    var av = a[sortCol] != null ? a[sortCol] : '';
    var bv = b[sortCol] != null ? b[sortCol] : '';
    var na = parseFloat(av), nb = parseFloat(bv);
    if (!isNaN(na) && !isNaN(nb)) return (na - nb) * sortDir;
    return String(av).localeCompare(String(bv)) * sortDir;
  });
}

/* ─────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────── */
function buildDnaUrl(p, tone) {
  return DNA_PAGE
    + '?sku='    + encodeURIComponent(p.sku);
    // + '&cat='    + encodeURIComponent(p.category)
    // + '&purity=' + encodeURIComponent(p.purity)
    // + '&gw='     + encodeURIComponent(p.grossWt)
    // + '&nw='     + encodeURIComponent(p.netWt)
    // + '&dw='     + encodeURIComponent(p.diaWgt)
    // + '&dp='     + encodeURIComponent(p.diaPcs)
    // + '&tone='   + encodeURIComponent(tone)
    // + '&desc='   + encodeURIComponent(p.description)
    // + '&loc='    + encodeURIComponent(p.location)
    // + '&size='   + encodeURIComponent(p.size || '')
    // + '&num='    + encodeURIComponent(p.num  || '');
}

function waMsg(p) {
  var tl = TONE_LABEL[p.metalTone] || p.metalTone || '\u2014';
  var sizeStr = p.size ? '\nSize: ' + p.size : '';
  return encodeURIComponent(
    'Hi LEEBA!\nI\'m interested in:\n'
    + 'SKU: '         + p.sku + '\n'
    + 'Category: '    + p.category + '\n'
    + 'Purity: '      + p.purity + '\n'
    + 'Gross Wt: '    + (p.grossWt  || '\u2014') + 'g | Net Wt: ' + (p.netWt || '\u2014') + 'g\n'
    + 'Diamond: '     + (p.diaWgt   || '\u2014') + 'ct (' + (p.diaPcs || '\u2014') + ' pcs) | Tone: ' + tl + '\n'
    + 'Location: '    + (p.location || '\u2014')
    + sizeStr + '\n'
    + 'Description: ' + (p.description || '\u2014') + '\n\n'
    + 'Kindly share the price. Thank you!'
  );
}

function waSvg() {
  return '<svg width="13" height="13" fill="currentColor" viewBox="0 0 24 24">'
    + '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>'
    + '<path d="M5.339 17.54A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10-4.477 10-10 10a9.956 9.956 0 0 1-5.54-1.661L2 22l2.339-4.46z"/>'
    + '</svg>';
}

function escHtml(s) {
  return String(s)
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─────────────────────────────────────────────────
   DESKTOP TABLE
───────────────────────────────────────────────── */
function renderTable(data) {
  var s     = sorted(data);
  var tbody = document.getElementById('tbody');

  if (!s.length) {
    tbody.innerHTML = '<tr><td colspan="12" class="no-res">No products match your filters.</td></tr>';
    return;
  }

  tbody.innerHTML = s.map(function(p, i) {
    var tone     = p.metalTone || '';
    var tl       = TONE_LABEL[tone] || tone || '\u2014';
    var toneHtml = tone
      ? '<span class="tone-wrap tone-' + tone + '"><span class="tgem"></span>' + tl + '</span>'
      : '\u2014';

    var locHtml = p.location
      ? '<span class="loc-b">' + escHtml(p.location) + '</span>'
      : '\u2014';

    return '<tr>'
      + '<td class="rn">' + (i + 1) + '</td>'
      + '<td><span class="sku">' + escHtml(p.sku) + '</span></td>'
      + '<td><a href="' + buildDnaUrl(p, tone) + '" class="dna-btn" target="_blank">\u25C6 DNA</a></td>'
      + '<td><span class="cat-b cat-' + p.category + '">' + p.category.charAt(0) + p.category.slice(1).toLowerCase() + '</span></td>'
      + '<td>' + (p.purity  || '\u2014') + '</td>'
      + '<td>' + toneHtml + '</td>'
      + '<td>' + (p.grossWt || '\u2014') + '</td>'
      + '<td>' + (p.netWt   || '\u2014') + '</td>'
      + '<td>' + (p.diaWgt  || '\u2014') + '</td>'
      + '<td>' + (p.diaPcs  || '\u2014') + '</td>'
      + '<td class="desc-cell">' + escHtml(p.description || '\u2014') + '</td>'
      + '<td>' + locHtml + '</td>'
      + '<td><a href="https://wa.me/' + WA_NUM + '?text=' + waMsg(p) + '" target="_blank" class="wa-btn">' + waSvg() + ' Price on Request</a></td>'
      + '</tr>';
  }).join('');
}

/* ─────────────────────────────────────────────────
   MOBILE CARDS
───────────────────────────────────────────────── */
function renderCards(data) {
  var s    = sorted(data);
  var wrap = document.getElementById('mobile-cards');

  if (!s.length) { wrap.innerHTML = '<div class="no-res">No products match your filters.</div>'; return; }

  wrap.innerHTML = s.map(function(p) {
    var tone     = p.metalTone || '';
    var tl       = TONE_LABEL[tone] || tone || '\u2014';
    var toneHtml = tone
      ? '<span class="tone-wrap tone-' + tone + '"><span class="tgem"></span>' + tl + '</span>'
      : '\u2014';
    var descHtml = p.description
      ? '<div class="card-desc"><span class="card-desc-label">Description</span>' + escHtml(p.description) + '</div>'
      : '';
    var locHtml = p.location
      ? '<span class="loc-b">' + escHtml(p.location) + '</span>'
      : '';

    return '<div class="prod-card">'
      + '<div class="card-top">'
      + '<span class="card-sku">' + escHtml(p.sku) + '</span>'
      + '<div style="display:flex;gap:.35rem;align-items:center;">'
      + '<span class="cat-b cat-' + p.category + '">' + p.category.charAt(0) + p.category.slice(1).toLowerCase() + '</span>'
      + locHtml
      + '</div></div>'
      + '<div class="card-grid">'
      + '<div class="card-field"><span class="card-lbl">Purity</span><span class="card-val">'     + (p.purity  || '\u2014') + '</span></div>'
      + '<div class="card-field"><span class="card-lbl">Metal Tone</span><span class="card-val">' + toneHtml + '</span></div>'
      + '<div class="card-field"><span class="card-lbl">Gross Wt</span><span class="card-val">'   + (p.grossWt || '\u2014') + ' g</span></div>'
      + '<div class="card-field"><span class="card-lbl">Net Wt</span><span class="card-val">'     + (p.netWt   || '\u2014') + ' g</span></div>'
      + '<div class="card-field"><span class="card-lbl">Dia Wgt</span><span class="card-val">'    + (p.diaWgt  || '\u2014') + ' ct</span></div>'
      + '<div class="card-field"><span class="card-lbl">Dia Pcs</span><span class="card-val">'    + (p.diaPcs  || '\u2014') + '</span></div>'
      + '</div>'
      + descHtml
      + '<div class="card-actions">'
      + '<a href="' + buildDnaUrl(p, tone) + '" class="card-dna" target="_blank">\u25C6 DNA</a>'
      + '<a href="https://wa.me/' + WA_NUM + '?text=' + waMsg(p) + '" target="_blank" class="card-wa">' + waSvg() + ' Price on Request</a>'
      + '</div></div>';
  }).join('');
}

/* ─────────────────────────────────────────────────
   MODAL
───────────────────────────────────────────────── */
function openModal(type) {
  document.getElementById('modal-title').textContent = type === 'custom' ? 'Bespoke Design Request' : 'Price on Request';
  document.getElementById('modal-sub').textContent   = type === 'custom' ? "Tell us your vision — we'll bring it to life." : "Share your details and we'll send you the price shortly.";
  document.getElementById('sku-grp').style.display   = type === 'custom' ? 'none' : '';
  document.getElementById('modal').classList.add('open');
}
function closeModal()  { document.getElementById('modal').classList.remove('open'); }
function submitModal() { alert('Thank you! We will contact you shortly.'); closeModal(); }

/* ─────────────────────────────────────────────────
   BOOTSTRAP
───────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', function() {

  /* ── 1. Wire sort headers ── */
  document.querySelectorAll('thead th[data-col]').forEach(function(th) {
    th.addEventListener('click', function() { setSort(th.dataset.col); });
  });

  /* ── 2. Wire search input ── */
  var fsEl = document.getElementById('fs');
  if (fsEl) fsEl.addEventListener('input', applyFilters);

  /* ── 3. Close multi-select panels on outside click ── */
  document.addEventListener('click', function(e) {
    ['fp', 'ft', 'flt'].forEach(function(id) {
      var wrap = document.getElementById(id + '-wrap');
      if (wrap && !wrap.contains(e.target)) {
        document.getElementById(id + '-panel').classList.remove('open');
        document.getElementById(id + '-btn').classList.remove('open');
      }
    });
  });

  /* ── 4. Wire modal backdrop ── */
  document.getElementById('modal').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  /* ── 5. Load data ──
     Show cached data instantly if available, then refresh from API. */
  var cached = loadFromStorage();
  if (cached) {
    var dateStr = localStorage.getItem(LS_DATE) || 'previously';
    applyProducts(cached, dateStr);
    /* Silent background refresh */
    fetchProducts(false);
  } else {
    /* No cache — fetch and show loading screen */
    fetchProducts(false);
  }

});
