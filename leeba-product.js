/* ============================================================
   LEEBA — Product DNA Page Logic  (API Version)
   ============================================================ */

/* ─────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────── */
var API_BASE = 'https://script.google.com/macros/s/AKfycbxrmx77TuZv1HrN_pz40zB4znh1nEX7Rn6Nurc184bP1jx3YcQ3vOcB--LQP3Mb3zh3CA/exec';
var WA_NUM   = '919979460555';

/* ─────────────────────────────────────────────────
   TONE LABELS  (internal code → display text)
───────────────────────────────────────────────── */
var TONE_MAP = {
  W:  'White',
  Y:  'Yellow',
  YW: 'Yellow + White',
  R:  'Rose',
  RW: 'Rose + White',
  D:  'Dual'
};

/* Maps API full-word MetalTone to internal single-letter code */
var TONE_CODE = {
  'WHITE'        : 'W',
  'YELLOW'       : 'Y',
  'ROSE'         : 'R',
  'PINK'         : 'R',
  'DUAL'         : 'D',
  'YEL/WHT'      : 'YW',
  'YELLOW WHITE' : 'YW',
  'YELLOW/WHITE' : 'YW',
  'ROSE WHITE'   : 'RW',
  'ROSE/WHITE'   : 'RW'
};

/* Maps diamond shape abbreviations to display names */
var SHAPE_MAP = {
  RD: 'Round',    OV: 'Oval',     MQ: 'Marquise', PE: 'Pear',
  HR: 'Heart',    EM: 'Emerald',  PR: 'Princess', AS: 'Asscher',
  CU: 'Cushion',  RA: 'Radiant',  TR: 'Trillion', BG: 'Baguette',
  HS: 'Heart',    CB: 'Cushion',  TRI: 'Triangle', RAD: 'Radiant'
};

/* ─────────────────────────────────────────────────
   MOCK / DEMO PRODUCT  (shown when no SKU in URL)
───────────────────────────────────────────────── */
var mockProduct = {
  sku:         'LRG000',
  category:    'RING',
  purity:      '18KT',
  grossWeight: '8.50 g',
  netWeight:   '6.20 g',
  diaWeight:   '1.24 ct',
  diaPcs:      '68',
  metalTone:   'W',
  location:    'Mumbai',
  size:        '16',
  description: 'Sample product · this is shown when no SKU is passed via URL',
  imageUrls:   ['https://picsum.photos/seed/leeba1/800/600',
                'https://picsum.photos/seed/leeba2/800/600'],
  videoUrls:   [''],
  diamondDetails: [
    'Round · 0.50 ct / 22 pcs · E-F/VVS-VS',
    'Pear · 0.40 ct / 12 pcs · G/VS1',
    'Marquise · 0.34 ct / 8 pcs · G/SI1',
    
  ]
};

/* ─────────────────────────────────────────────────
   API RESPONSE PARSER
   Maps the Google Sheets API JSON fields to the
   internal product object used by renderProduct().
   Field names confirmed from sample data:
     SKU, Decription (sic), category, location,
     Purity (number), MetalTone (full word),
     grossWgt, netWgt, diaWgt, diaPcs, size, num,
     diamonds (array)
───────────────────────────────────────────────── */
function fmtNum(v, d) {
  if (v === '' || v == null) return '';
  var n = Number(v);
  return isNaN(n) ? '' : n.toFixed(d != null ? d : 2);
}

function parseApiProduct(json) {
  /* Purity: API sends a number (18) → "18KT" */
  var purNum = json.Purity != null ? String(json.Purity).trim() : '';
  var purity = purNum ? purNum + 'KT' : '';

  /* MetalTone: full word "WHITE" → code "W" */
  var toneRaw  = String(json.MetalTone || '').trim().toUpperCase();
  var toneCode = TONE_CODE[toneRaw] || toneRaw.charAt(0) || '';

  /* Description — note "Decription" typo in source */
  var desc = String(json.Decription || json.Description || json.description || '').trim();

  /* diamonds array → display strings */
  var diamonds = Array.isArray(json.diamonds) ? json.diamonds : [];
  var diamondDetails = diamonds.map(function(d) {
    var shapeName = SHAPE_MAP[d.shape] || d.shape || '—';
    var wgtStr    = (d.wgt != null) ? (parseFloat(d.wgt).toFixed(2) + ' ct') : '—';
    var pcsStr    = (d.pcs != null) ? (d.pcs + ' pcs') : '—';
    var color     = (d.color   && d.color.trim())   ? d.color.trim()   : 'E-F';
    var clarity   = (d.clarity && d.clarity.trim()) ? d.clarity.trim() : 'VVS-VS';
    var certi     = (d.certiNumber && String(d.certiNumber).trim())
                      ? ' · IGI: ' + String(d.certiNumber).trim() : '';
    return shapeName + ' · ' + wgtStr + ' / ' + pcsStr +
           ' · ' + color + ' / ' + clarity + certi;
  });

  return {
    sku:           String(json.SKU || '').trim(),
    category:      String(json.category || '').trim().toUpperCase(),
    purity:        purity,
    metalTone:     toneCode,
    grossWeight:   json.grossWgt ? fmtNum(json.grossWgt, 2) + ' g' : '',
    netWeight:     json.netWgt   ? fmtNum(json.netWgt,   2) + ' g' : '',
    diaWeight:     json.diaWgt   ? fmtNum(json.diaWgt,   2) + ' ct' : '',
    diaPcs:        json.diaPcs != null ? String(json.diaPcs) : '',
    location:      String(json.location || '').trim(),
    size:          String(json.size || '').trim(),
    description:   desc,
    num:           String(json.num || ''),
    imageUrls:     [],   /* future: populated by media API */
    videoUrls:     [''],
    diamondDetails: diamondDetails
  };
}

/* ─────────────────────────────────────────────────
   HELPERS
───────────────────────────────────────────────── */
function toneLabel(t) {
  return TONE_MAP[t] || t || '';
}

function escHtml(s) {
  return String(s || '')
    .replace(/&/g,'&amp;').replace(/</g,'&lt;')
    .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

function waSvgIcon() {
  return '<svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297' +
    '-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788' +
    '-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174' +
    '.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579' +
    '-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016' +
    '-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262' +
    '.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248' +
    '-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
    '<path d="M5.339 17.54A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10' +
    '-4.477 10-10 10a9.956 9.956 0 0 1-5.54-1.661L2 22l2.339-4.46z"/>' +
    '</svg>';
}

function buildWaLink(p) {
  var tl  = toneLabel(p.metalTone);
  var msg = 'Hi LEEBA!\nI\'m interested in:\n' +
    'SKU: '         + (p.sku         || '—') + '\n' +
    'Category: '    + (p.category    || '—') + '\n' +
    'Purity: '      + (p.purity      || '—') + '\n' +
    'Metal Tone: '  + (tl            || '—') + '\n' +
    'Gross Wt: '    + (p.grossWeight || '—') + ' | Net Wt: ' + (p.netWeight || '—') + '\n' +
    'Diamond: '     + (p.diaWeight   || '—') + ' (' + (p.diaPcs || '—') + ' pcs)\n' +
    'Location: '    + (p.location    || '—') + '\n' +
    'Description: ' + (p.description || '—') + '\n\n' +
    'Kindly share the price. Thank you!';
  return 'https://wa.me/' + WA_NUM + '?text=' + encodeURIComponent(msg);
}

/* ─────────────────────────────────────────────────
   MEDIA FRAME BUILDER
───────────────────────────────────────────────── */
function buildMediaFrame(urls, type, labelText) {
  var imgSvg =
    '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
    '<span>Product Image</span>';

  var vidSvg =
    '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
    '<polygon points="23 7 16 12 23 17 23 7"/>' +
    '<rect x="1" y="5" width="15" height="14" rx="2"/></svg>' +
    '<span>Product Video</span>';

  var slides = urls.map(function(url) {
    var inner;
    if (type === 'image') {
      inner = url
        ? '<img src="' + url + '" alt="Product image" loading="lazy"/>'
        : '<div class="media-placeholder">' + imgSvg + '</div>';
    } else {
      inner = url
        ? '<video src="' + url + '" controls playsinline muted loop></video>'
        : '<div class="media-placeholder">' + vidSvg + '</div>';
    }
    return '<div class="slide">' + inner + '</div>';
  }).join('');

  var isMulti  = urls.length > 1;
  var dotsHtml = '';
  if (isMulti) {
    dotsHtml =
      '<div class="slider-dots">' +
      urls.map(function(_, i) {
        return '<button class="dot' + (i === 0 ? ' active' : '') +
               '" aria-label="Slide ' + (i + 1) + '"></button>';
      }).join('') +
      '</div>';
  }

  return (
    '<div class="media-frame">' +
      '<div class="slider-wrap">' +
        '<div class="slider-track">' + slides + '</div>' +
      '</div>' +
      dotsHtml +
      '<div class="media-label">' + labelText + '</div>' +
    '</div>'
  );
}

/* ─────────────────────────────────────────────────
   SLIDER INITIALISER
───────────────────────────────────────────────── */
function initSliders() {
  document.querySelectorAll('.media-frame').forEach(function(frame) {
    var track  = frame.querySelector('.slider-track');
    if (!track) return;
    var slides = frame.querySelectorAll('.slide');
    var dots   = frame.querySelectorAll('.dot');
    var count  = slides.length;
    if (count <= 1) return;

    var current = 0;

    function goTo(idx) {
      current = ((idx % count) + count) % count;
      track.style.transform = 'translateX(-' + (current * 100) + '%)';
      dots.forEach(function(d, i) {
        d.classList.toggle('active', i === current);
      });
    }

    dots.forEach(function(d, i) { d.addEventListener('click', function() { goTo(i); }); });

    var startX   = 0;
    var dragging = false;
    var wrap     = frame.querySelector('.slider-wrap');

    wrap.addEventListener('touchstart', function(e) { startX = e.touches[0].clientX; dragging = true; }, { passive: true });
    wrap.addEventListener('touchend',   function(e) {
      if (!dragging) return; dragging = false;
      var diff = startX - e.changedTouches[0].clientX;
      if (Math.abs(diff) > 40) goTo(current + (diff > 0 ? 1 : -1));
    });
    wrap.addEventListener('mousedown',  function(e) { startX = e.clientX; dragging = true; e.preventDefault(); });
    wrap.addEventListener('mouseup',    function(e) {
      if (!dragging) return; dragging = false;
      var diff = startX - e.clientX;
      if (Math.abs(diff) > 40) goTo(current + (diff > 0 ? 1 : -1));
    });
    wrap.addEventListener('mouseleave', function() { dragging = false; });
  });
}

/* ─────────────────────────────────────────────────
   RENDER PRODUCT
───────────────────────────────────────────────── */
function renderProduct(p) {

  /* ── Browser tab title ── */
  if (p.sku) document.title = 'LEEBA \u2014 ' + escHtml(p.description);

  /* ── Header SKU · description ── */
  var headerTitle = document.getElementById('header-title');
  if (headerTitle) {
    headerTitle.textContent = p.sku + (p.description ? ' \u00B7 ' + p.description : '');
  }

  /* Helper: display value or em-dash */
  function v(val) {
    return val
      ? '<span class="spec-value">' + escHtml(String(val)) + '</span>'
      : '<span class="spec-value empty">\u2014</span>';
  }

  /* Normalise image / video URLs */
  var imageUrls = Array.isArray(p.imageUrls) ? p.imageUrls : (p.imageUrl ? [p.imageUrl] : ['']);
  var videoUrls = Array.isArray(p.videoUrls) ? p.videoUrls : (p.videoUrl ? [p.videoUrl] : ['']);
  if (imageUrls.length === 0) imageUrls = [''];
  if (videoUrls.length === 0) videoUrls = [''];

  /* Diamond details layout */
  var dItems      = p.diamondDetails || [];
  var diamondHtml = '';
  if (dItems.length > 4) {
    var rows = Math.ceil(dItems.length / 2);
    diamondHtml =
      '<ul class="diamond-grid" style="grid-template-rows: repeat(' + rows + ', auto)">' +
      dItems.map(function(d) { return '<li>' + escHtml(d) + '</li>'; }).join('') +
      '</ul>';
  } else {
    var listItems = dItems.length
      ? dItems.map(function(d) { return '<li>' + escHtml(d) + '</li>'; }).join('')
      : '<li>\u2014</li>';
    diamondHtml = '<ul class="diamond-list">' + listItems + '</ul>';
  }

  /* Category display */
  var catDisplay = p.category
    ? p.category.charAt(0).toUpperCase() + p.category.slice(1).toLowerCase()
    : '';

  /* ── Inject HTML ── */
  document.getElementById('product').innerHTML =
    '<div class="product-page">' +

      /* ── 1. Badge row: original badge + description inline ── */
      '<div class="badge-row">' +
        '<span class="badge">' +
          // (p.category ? p.category.toUpperCase()  : '') +
		  // + ' \u00B7 '
          // 'PRODUCT DNA' +
           (p.sku ? p.sku : '') +
		  (p.description
          ? ' \u00B7 ' + escHtml(p.description) 
          : '') +
        '</span>' +
        // (p.description
          // ? '<span class="badge-desc">' + escHtml(p.description) + '</span>'
          // : '') +
      '</div>' +

      /* ── 2. Media row ── */
      '<div class="media-row">' +
        buildMediaFrame(imageUrls, 'image', 'Product Image') +
        buildMediaFrame(videoUrls, 'video', 'Product Video') +
      '</div>' +

      /* ── 3. Spec grid ── */
      '<div class="details-section">' +
        '<div class="section-title">Details</div>' +
        '<div class="specs-grid">' +
          '<div class="spec-item"><span class="spec-label">SKU</span>'          + v(p.sku)                         + '</div>' +
          '<div class="spec-item"><span class="spec-label">Category</span>'     + v(catDisplay)                    + '</div>' +
          '<div class="spec-item"><span class="spec-label">Purity / KT</span>'  + v(p.purity)                      + '</div>' +
          '<div class="spec-item"><span class="spec-label">Metal Tone</span>'   + v(toneLabel(p.metalTone))        + '</div>' +
          '<div class="spec-item"><span class="spec-label">Size</span>'         + v(p.size)                        + '</div>' +
          '<div class="spec-item"><span class="spec-label">Gross Weight</span>' + v(p.grossWeight)                 + '</div>' +
          '<div class="spec-item"><span class="spec-label">Net Weight</span>'   + v(p.netWeight)                   + '</div>' +
          '<div class="spec-item"><span class="spec-label">Diamond Wgt</span>'  + v(p.diaWeight)                   + '</div>' +
          '<div class="spec-item"><span class="spec-label">Diamond Pcs</span>'  + v(p.diaPcs)                      + '</div>' +
          '<div class="spec-item"><span class="spec-label">Location</span>'     + v(p.location)                    + '</div>' +
        '</div>' +
      '</div>' +

      /* ── 4. Diamond details ── */
      '<div class="details-section">' +
        '<div class="section-title">Diamond Details</div>' +
        diamondHtml +
      '</div>' +

    '</div>';

  /* Activate sliders */
  initSliders();
  var existingFab = document.getElementById('ask-price-fab');
  if (existingFab) existingFab.remove();
  var fab = document.createElement('a');
  fab.id        = 'ask-price-fab';
  fab.href      = buildWaLink(p);
  fab.target    = '_blank';
  fab.className = 'ask-price-fab';
  fab.innerHTML = waSvgIcon() + '<span>Ask for Price</span>';
  document.body.appendChild(fab);

  /* Align FAB horizontally with the left edge of the video frame */
  //positionFab(fab);

  /* Re-align on window resize (viewport width changes) */
  if (window._fabResizeHandler) window.removeEventListener('resize', window._fabResizeHandler);
  window._fabResizeHandler = function() { positionFab(document.getElementById('ask-price-fab')); };
  window.addEventListener('resize', window._fabResizeHandler);
}

/* ─────────────────────────────────────────────────
   POSITION FAB  — aligns left edge of the floating
   "Ask for Price" button with the left edge of the
   video (second) media frame.
───────────────────────────────────────────────── */
function positionFab(fab) {
  if (!fab) return;
  /* Find the two media frames; [1] is the video column */
  var frames = document.querySelectorAll('.media-frame');
  if (frames.length < 2) return;                 /* fallback: CSS right:1.5rem applies */
  var videoLeft = frames[1].getBoundingClientRect().right;
  fab.style.right  = videoLeft + 'px';
  fab.style.left = 'auto';                      /* override the CSS default */
}

// function positionFab(fab) {
  // if (!fab) return;
  // /* Find the two media frames; [1] is the video column */
  // var frames = document.querySelectorAll('.media-frame');
  // if (frames.length < 2) return;                 /* fallback: CSS right:1.5rem applies */
  // var videoRight = frames[1].getBoundingClientRect().right;
  // fab.style.right = (window.innerWidth - videoRight) + 'px';
  // fab.style.left  = 'auto';
// }
/* ─────────────────────────────────────────────────
   LOAD PRODUCT
   1. Read ?sku= from URL (passed by collection page)
   2. Call API with that SKU
   3. Fall back to mock/demo if no SKU
───────────────────────────────────────────────── */
async function loadProduct() {
  show('loading');
  hide('error');
  hide('product');

  var params = new URLSearchParams(window.location.search);
  var sku    = params.get('sku') || params.get('barcode') || '';

  /* No SKU → show demo product */
  if (!sku) {
    renderProduct(mockProduct);
    show('product');
    hide('loading');
    return;
  }

  /* Fetch from API */
  try {
    var url = API_BASE + '?action=product&barcode=' + encodeURIComponent(sku);
    var res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var json = await res.json();
    renderProduct(parseApiProduct(json));
    show('product');
  } catch (err) {
    document.getElementById('error-msg').textContent =
      'Could not load product: ' + err.message;
    show('error');
  } finally {
    hide('loading');
  }
}

/* ─────────────────────────────────────────────────
   DOM HELPERS
───────────────────────────────────────────────── */
function show(id) { document.getElementById(id).style.display = ''; }
function hide(id) { document.getElementById(id).style.display = 'none'; }

/* ── START ── */
loadProduct();
