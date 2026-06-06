/* ============================================================
   LEEBA — Product DNA Page Logic  (API Version)
   ============================================================ */

/* ─────────────────────────────────────────────────
   CONFIG
───────────────────────────────────────────────── */
var API_BASE = 'https://script.google.com/macros/s/AKfycbxrmx77TuZv1HrN_pz40zB4znh1nEX7Rn6Nurc184bP1jx3YcQ3vOcB--LQP3Mb3zh3CA/exec';
var WA_NUM   = '919979460555';
var S3_BASE  = 'https://leeba-media.s3.ap-south-1.amazonaws.com/';

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

/* ─────────────────────────────────────────────────
   S3 HELPERS  — image + video existence checks
───────────────────────────────────────────────── */
function buildS3ImageCandidates(sku) {
  if (!sku) return [];
  return [
    S3_BASE + sku + '.png',
    S3_BASE + sku + '_01.png',
    S3_BASE + sku + '_02.png',
    S3_BASE + sku + '_03.png',
    S3_BASE + sku + '_04.png',
    S3_BASE + sku + '_05.png'
  ];
}

function buildS3VideoUrl(sku) {
  return sku ? S3_BASE + sku + '.mp4' : '';
}

/* Image preload check — returns Promise<string[]> of valid URLs only */
function filterValidImageUrls(candidates) {
  if (!candidates || candidates.length === 0) return Promise.resolve([]);
  var checks = candidates.map(function(url) {
    return new Promise(function(resolve) {
      var img = new Image();
      img.onload  = function() { resolve(url); };
      img.onerror = function() { resolve(null); };
      img.src = url;
    });
  });
  return Promise.all(checks).then(function(r) { return r.filter(Boolean); });
}

/* Video metadata check — returns Promise<string> (url or '') */
function checkVideoUrl(url) {
  if (!url) return Promise.resolve('');
  return new Promise(function(resolve) {
    var v = document.createElement('video');
    v.onloadedmetadata = function() { resolve(url); };
    v.onerror          = function() { resolve(''); };
    v.preload = 'metadata';
    v.src = url;
    setTimeout(function() { resolve(''); }, 6000);
  });
}

/* ─────────────────────────────────────────────────
   VIDEO PLAYER  — builds the custom player frame
   and wires up all controls after DOM insertion
───────────────────────────────────────────────── */
function buildVideoPlayerFrame(videoUrl, posterUrl) {
  var posterAttr = posterUrl ? ' poster="' + posterUrl + '"' : '';
  return (
    '<div class="media-frame vid-player-frame" id="vid-player-frame">' +
      '<video id="leeba-vid" src="' + videoUrl + '"' + posterAttr +
        ' playsinline preload="metadata" webkit-playsinline></video>' +
      '<div class="vid-overlay" id="vid-overlay">' +
        '<button class="vid-play-big" id="vid-play-big" aria-label="Play">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="vid-controls" id="vid-controls">' +
        '<button class="vid-btn" id="vid-rw" title="Back 10s">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.98"/></svg>' +
        '</button>' +
        '<button class="vid-btn" id="vid-play-pause" aria-label="Play/Pause">' +
          '<svg class="icon-play"  viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>' +
          '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none">' +
            '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' +
        '</button>' +
        '<button class="vid-btn" id="vid-ff" title="Forward 10s">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<polyline points="23 4 23 10 17 10"/><path d="M20.49 15a9 9 0 1 1-.49-4.98"/></svg>' +
        '</button>' +
        '<div class="vid-seek-wrap">' +
          '<div class="vid-seek-bar" id="vid-seek-bar">' +
            '<div class="vid-seek-fill"  id="vid-seek-fill"></div>' +
            '<div class="vid-seek-thumb" id="vid-seek-thumb"></div>' +
          '</div>' +
        '</div>' +
        '<span class="vid-time" id="vid-time">0:00</span>' +
        '<button class="vid-btn" id="vid-mute" title="Mute">' +
          '<svg class="icon-sound" viewBox="0 0 24 24" fill="currentColor">' +
            '<path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3c0-1.77-1.02-3.29-2.5-4.03v8.05c1.48-.73 2.5-2.25 2.5-4.02z"/></svg>' +
          '<svg class="icon-mute"  viewBox="0 0 24 24" fill="currentColor" style="display:none">' +
            '<path d="M16.5 12c0-1.77-1.02-3.29-2.5-4.03v2.21l2.45 2.45c.03-.2.05-.41.05-.63zm2.5 0c0 .94-.2 1.82-.54 2.64l1.51 1.51C20.63 14.91 21 13.5 21 12c0-4.28-2.99-7.86-7-8.77v2.06c2.89.86 5 3.54 5 6.71zM4.27 3L3 4.27 7.73 9H3v6h4l5 5v-6.73l4.25 4.25c-.67.52-1.42.93-2.25 1.18v2.06c1.38-.31 2.63-.95 3.69-1.81L19.73 21 21 19.73l-9-9L4.27 3zM12 4L9.91 6.09 12 8.18V4z"/></svg>' +
        '</button>' +
        '<button class="vid-btn" id="vid-fs" title="Fullscreen">' +
          '<svg viewBox="0 0 24 24" fill="currentColor">' +
            '<path d="M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="media-label" style="z-index:3;pointer-events:none">Product Video</div>' +
    '</div>'
  );
}

function initVideoPlayer() {
  var vid = document.getElementById('leeba-vid');
  if (!vid) return;

  var overlay   = document.getElementById('vid-overlay');
  var bigPlay   = document.getElementById('vid-play-big');
  var playBtn   = document.getElementById('vid-play-pause');
  var rwBtn     = document.getElementById('vid-rw');
  var ffBtn     = document.getElementById('vid-ff');
  var muteBtn   = document.getElementById('vid-mute');
  var fsBtn     = document.getElementById('vid-fs');
  var seekBar   = document.getElementById('vid-seek-bar');
  var seekFill  = document.getElementById('vid-seek-fill');
  var seekThumb = document.getElementById('vid-seek-thumb');
  var timeDisp  = document.getElementById('vid-time');
  var controls  = document.getElementById('vid-controls');
  var frame     = document.getElementById('vid-player-frame');

  function fmtTime(s) {
    if (!isFinite(s) || s < 0) return '0:00';
    var m = Math.floor(s / 60), sec = Math.floor(s % 60);
    return m + ':' + (sec < 10 ? '0' : '') + sec;
  }
  function updatePlayUI() {
    var paused = vid.paused || vid.ended;
    playBtn.querySelector('.icon-play').style.display  = paused ? '' : 'none';
    playBtn.querySelector('.icon-pause').style.display = paused ? 'none' : '';
    overlay.style.display = paused ? '' : 'none';
  }
  function updateSeek() {
    if (!vid.duration || !isFinite(vid.duration)) return;
    var pct = (vid.currentTime / vid.duration) * 100;
    seekFill.style.width = pct + '%';
    seekThumb.style.left = pct + '%';
    timeDisp.textContent = fmtTime(vid.currentTime) + ' / ' + fmtTime(vid.duration);
  }

  var hideTimer = null;
  function showControls() {
    controls.classList.add('visible');
    clearTimeout(hideTimer);
    if (!vid.paused) hideTimer = setTimeout(function() { controls.classList.remove('visible'); }, 3000);
  }

  frame.addEventListener('mouseenter', showControls);
  frame.addEventListener('mousemove',  showControls);
  frame.addEventListener('touchstart', showControls, { passive: true });

  overlay.addEventListener('click', function() { vid.play(); });
  bigPlay.addEventListener('click', function() { vid.play(); });

  playBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.paused ? vid.play() : vid.pause();
  });
  rwBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.currentTime = Math.max(0, vid.currentTime - 10); showControls();
  });
  ffBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.currentTime = Math.min(vid.duration || 0, vid.currentTime + 10); showControls();
  });
  muteBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.muted = !vid.muted;
    muteBtn.querySelector('.icon-sound').style.display = vid.muted ? 'none' : '';
    muteBtn.querySelector('.icon-mute').style.display  = vid.muted ? ''     : 'none';
    showControls();
  });
  fsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document);
    } else if (vid.webkitEnterFullscreen) {
      vid.webkitEnterFullscreen();
    } else if (frame.requestFullscreen) {
      frame.requestFullscreen();
    } else if (frame.webkitRequestFullscreen) {
      frame.webkitRequestFullscreen();
    }
    showControls();
  });

  function seekTo(clientX) {
    var rect = seekBar.getBoundingClientRect();
    var pct  = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    vid.currentTime = pct * (vid.duration || 0);
    showControls();
  }
  var seeking = false;
  seekBar.addEventListener('mousedown', function(e) { e.stopPropagation(); seeking = true; seekTo(e.clientX); });
  document.addEventListener('mouseup',   function()  { seeking = false; });
  document.addEventListener('mousemove', function(e) { if (seeking) seekTo(e.clientX); });
  seekBar.addEventListener('touchstart', function(e) { e.stopPropagation(); seeking = true; }, { passive: true });
  seekBar.addEventListener('touchend',   function()  { seeking = false; });
  seekBar.addEventListener('touchmove',  function(e) {
    e.preventDefault();
    if (e.touches[0]) seekTo(e.touches[0].clientX);
  }, { passive: false });

  vid.addEventListener('play',           updatePlayUI);
  vid.addEventListener('pause',          updatePlayUI);
  vid.addEventListener('ended',          updatePlayUI);
  vid.addEventListener('timeupdate',     updateSeek);
  vid.addEventListener('loadedmetadata', updateSeek);
}

/* ─────────────────────────────────────────────────
   INJECT MEDIA  — replaces the standard video frame
   with the custom player, and image frame with
   slider if multiple images found on S3.
   Called AFTER renderProduct() has painted the DOM.
───────────────────────────────────────────────── */
function injectS3Media(validImgs, validVid) {
  /* ── IMAGE: replace first media-frame if we have S3 images ── */
  if (validImgs && validImgs.length > 0) {
    var frames = document.querySelectorAll('.media-frame');
    if (frames.length > 0) {
      var imgFrame = frames[0];
      /* Build slides */
      var slides = validImgs.map(function(url) {
        return '<div class="slide"><img src="' + url + '" alt="Product image" loading="lazy"/></div>';
      }).join('');
      /* Build dots if multiple */
      var dotsHtml = '';
      if (validImgs.length > 1) {
        dotsHtml = '<div class="slider-dots">' +
          validImgs.map(function(_, i) {
            return '<button class="dot' + (i === 0 ? ' active' : '') +
                   '" aria-label="Slide ' + (i+1) + '"></button>';
          }).join('') + '</div>';
      }
      imgFrame.innerHTML =
        '<div class="slider-wrap"><div class="slider-track">' + slides + '</div></div>' +
        dotsHtml +
        '<div class="media-label">Product Image</div>';
      initSliders();
    }
  }

  /* ── VIDEO: replace second media-frame with custom player ── */
  if (validVid) {
    var allFrames = document.querySelectorAll('.media-frame');
    if (allFrames.length > 1) {
      var posterUrl = (validImgs && validImgs.length > 0) ? validImgs[0] : '';
      var vidFrame  = allFrames[1];
      /* Replace the entire frame element */
      var tmp = document.createElement('div');
      tmp.innerHTML = buildVideoPlayerFrame(validVid, posterUrl);
      vidFrame.parentNode.replaceChild(tmp.firstChild, vidFrame);
      initVideoPlayer();
    }
  }
}

/* ─────────────────────────────────────────────────
   LOAD PRODUCT  — original logic kept intact,
   S3 media injected in parallel after page renders
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

  /* Fetch from API — exactly as original */
  try {
    var url = API_BASE + '?action=product&barcode=' + encodeURIComponent(sku);
    var res = await fetch(url, { redirect: 'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var json = await res.json();
    renderProduct(parseApiProduct(json));
    show('product');

    /* After page is visible, kick off S3 checks in background */
    Promise.all([
      filterValidImageUrls(buildS3ImageCandidates(sku)),
      checkVideoUrl(buildS3VideoUrl(sku))
    ]).then(function(results) {
      injectS3Media(results[0], results[1]);
    });

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
