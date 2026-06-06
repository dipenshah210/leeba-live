/* ============================================================
   LEEBA — Product DNA  (leeba-product.js)
   ============================================================ */

/* ── CONFIG ── */
var API_BASE = 'https://script.google.com/macros/s/AKfycbxIKjKGaz4h9LerAm7Vn81nd5AJiOGpxhLAl8V0vSCgymkleCiCm4qPyG1ZkfSXbdp7tw/exec';
var S3_BASE  = 'https://leeba-media.s3.ap-south-1.amazonaws.com/';
var WA_NUM   = '919979460555';

/* ── MAPS ── */
var TONE_MAP  = { W:'White', Y:'Yellow', YW:'Yellow + White', R:'Rose', RW:'Rose + White', D:'Dual' };
var TONE_CODE = { 'WHITE':'W','YELLOW':'Y','ROSE':'R','PINK':'R','DUAL':'D',
                  'YEL/WHT':'YW','YELLOW WHITE':'YW','YELLOW/WHITE':'YW',
                  'ROSE WHITE':'RW','ROSE/WHITE':'RW' };
var SHAPE_MAP = { RD:'Round', OV:'Oval', MQ:'Marquise', PE:'Pear', HR:'Heart', EM:'Emerald',
                  PR:'Princess', AS:'Asscher', CU:'Cushion', RA:'Radiant', TR:'Trillion',
                  BG:'Baguette', HS:'Heart', CB:'Cushion', TRI:'Triangle', RAD:'Radiant' };

/* ── DEMO PRODUCT (no SKU in URL) ── */
var MOCK = {
  sku:'LRG000', category:'RING', purity:'18KT', grossWeight:'8.50 g', netWeight:'6.20 g',
  diaWeight:'1.24 ct', diaPcs:'68', metalTone:'W', location:'Mumbai', size:'16',
  description:'Sample product · shown when no SKU in URL',
  imageUrls:['https://picsum.photos/seed/leeba1/800/600','https://picsum.photos/seed/leeba2/800/600'],
  videoUrl:'',
  diamondDetails:['Round · 0.50 ct / 22 pcs · E-F/VVS-VS','Pear · 0.40 ct / 12 pcs · G/VS1','Marquise · 0.34 ct / 8 pcs · G/SI1']
};

/* ── HELPERS ── */
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toneLabel(t) { return TONE_MAP[t] || t || ''; }
function fmtNum(v,d)  { var n=Number(v); return (v==null||v===''||isNaN(n))?'':n.toFixed(d!=null?d:2); }
function el(id)       { return document.getElementById(id); }
function show(id)     { el(id).style.display=''; }
function hide(id)     { el(id).style.display='none'; }

/* ── API PARSER ── */
function parseApi(json) {
  var purNum   = json.Purity!=null ? String(json.Purity).trim() : '';
  var toneRaw  = String(json.MetalTone||'').trim().toUpperCase();
  var toneCode = TONE_CODE[toneRaw] || toneRaw.charAt(0) || '';
  var desc     = String(json.Decription||json.Description||json.description||'').trim();
  var diamonds = Array.isArray(json.diamonds) ? json.diamonds : [];
  var dDetails = diamonds.map(function(d) {
    return (SHAPE_MAP[d.shape]||d.shape||'—') +
           ' · ' + (d.wgt!=null ? parseFloat(d.wgt).toFixed(2)+' ct' : '—') +
           ' / ' + (d.pcs!=null ? d.pcs+' pcs' : '—') +
           ' · ' + (d.color&&d.color.trim() ? d.color.trim() : 'E-F') +
           ' / ' + (d.clarity&&d.clarity.trim() ? d.clarity.trim() : 'VVS-VS') +
           (d.certiNumber&&String(d.certiNumber).trim() ? ' · IGI: '+String(d.certiNumber).trim() : '');
  });
  return {
    sku:           String(json.SKU||'').trim(),
    category:      String(json.category||'').trim().toUpperCase(),
    purity:        purNum ? purNum+'KT' : '',
    metalTone:     toneCode,
    grossWeight:   json.grossWgt ? fmtNum(json.grossWgt,2)+' g'  : '',
    netWeight:     json.netWgt   ? fmtNum(json.netWgt,2)+' g'    : '',
    diaWeight:     json.diaWgt   ? fmtNum(json.diaWgt,2)+' ct'   : '',
    diaPcs:        json.diaPcs!=null ? String(json.diaPcs) : '',
    location:      String(json.location||'').trim(),
    size:          String(json.size||'').trim(),
    description:   desc,
    imageUrls:     [],
    videoUrl:      '',
    diamondDetails: dDetails
  };
}

/* ── WHATSAPP LINK ── */
function buildWaLink(p) {
  var msg = 'Hi LEEBA!\nI\'m interested in:\n' +
    'SKU: '+(p.sku||'—')+'\nCategory: '+(p.category||'—')+'\nPurity: '+(p.purity||'—')+
    '\nMetal Tone: '+(toneLabel(p.metalTone)||'—')+
    '\nGross Wt: '+(p.grossWeight||'—')+' | Net Wt: '+(p.netWeight||'—')+
    '\nDiamond: '+(p.diaWeight||'—')+' ('+(p.diaPcs||'—')+' pcs)'+
    '\nLocation: '+(p.location||'—')+'\nDescription: '+(p.description||'—')+
    '\n\nKindly share the price. Thank you!';
  return 'https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(msg);
}

/* ══════════════════════════════════════════════════════
   IMAGE SLIDER
   Strategy for private S3:
   • Render all candidate <img> tags at once in order
   • Each img has naturalWidth check after load — if 0 it's a broken opaque response
   • On error OR naturalWidth==0: hide that slide, shrink track, update dots
   ══════════════════════════════════════════════════════ */

/* Build candidate URL list in order: SKU.png, SKU_01.png … SKU_05.png */
function s3ImageUrls(sku) {
  return [
    S3_BASE+sku+'.png',
    S3_BASE+sku+'_01.png',
    S3_BASE+sku+'_02.png',
    S3_BASE+sku+'_03.png',
    S3_BASE+sku+'_04.png',
    S3_BASE+sku+'_05.png'
  ];
}

/* Build the image frame HTML.
   All candidate slides are rendered; failed ones are hidden by JS after load. */
function buildImageFrame(urls) {
  var placeholder =
    '<div class="media-placeholder">' +
    '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
    '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
    '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
    '<span>Product Image</span></div>';

  if (!urls || urls.length === 0) {
    return '<div class="media-frame" id="img-frame">' +
      '<div class="slider-wrap"><div class="slider-track">' +
      '<div class="slide">'+placeholder+'</div>' +
      '</div></div><div class="media-label">Product Image</div></div>';
  }

  /* Each slide: img calls leeba_imgLoad(this) on load and leeba_imgErr(this) on error */
  var slides = urls.map(function(url, i) {
    return '<div class="slide" data-idx="'+i+'">' +
      '<img src="'+esc(url)+'" alt="Product image"' +
      ' onload="leeba_imgLoad(this)"' +
      ' onerror="leeba_imgErr(this)"/>' +
      '</div>';
  }).join('');

  /* Render dots equal to candidates — will be rebuilt once images resolve */
  return '<div class="media-frame" id="img-frame">' +
    '<div class="slider-wrap"><div class="slider-track" id="img-track">' + slides + '</div></div>' +
    '<div class="slider-dots" id="img-dots"></div>' +
    '<div class="media-label">Product Image</div>' +
    '</div>';
}

/* Called by each img onload — check naturalWidth to detect opaque 403s */
function leeba_imgLoad(imgEl) {
  /* naturalWidth === 0 means browser got an opaque response (403 treated as success on iOS) */
  if (imgEl.naturalWidth === 0) {
    leeba_imgErr(imgEl);
  } else {
    imgEl.closest('.slide').setAttribute('data-ok','1');
    leeba_updateSlider();
  }
}

/* Called by each img onerror — mark slide as failed */
function leeba_imgErr(imgEl) {
  var slide = imgEl.closest('.slide');
  if (slide) slide.setAttribute('data-fail','1');
  leeba_updateSlider();
}

/* Rebuild slider state based on which slides loaded OK */
var _sliderReady = false;
var _sliderCurrent = 0;
var _sliderCount = 0;

function leeba_updateSlider() {
  var track = el('img-track');
  var dots  = el('img-dots');
  if (!track || !dots) return;

  var allSlides = track.querySelectorAll('.slide');
  var total     = allSlides.length;
  var resolved  = track.querySelectorAll('.slide[data-ok], .slide[data-fail]').length;

  /* Wait until all imgs have responded */
  if (resolved < total) return;

  /* Hide failed slides */
  var goodSlides = [];
  allSlides.forEach(function(s) {
    if (s.getAttribute('data-fail')) {
      s.style.display = 'none';
    } else {
      goodSlides.push(s);
    }
  });

  /* No good images → show placeholder */
  if (goodSlides.length === 0) {
    track.innerHTML =
      '<div class="slide"><div class="media-placeholder">' +
      '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
      '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
      '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
      '<span>Product Image</span></div></div>';
    dots.innerHTML = '';
    return;
  }

  _sliderCount   = goodSlides.length;
  _sliderCurrent = 0;
  _sliderReady   = false;

  /* Reset track position */
  track.style.transition = 'none';
  track.style.transform  = 'translateX(0)';

  /* Build dots */
  if (goodSlides.length > 1) {
    dots.innerHTML = goodSlides.map(function(_, i) {
      return '<button class="dot'+(i===0?' active':'')+'" aria-label="Slide '+(i+1)+'"></button>';
    }).join('');
    dots.querySelectorAll('.dot').forEach(function(d, i) {
      d.addEventListener('click', function() { sliderGoTo(i); });
    });
  } else {
    dots.innerHTML = '';
  }

  /* Init swipe/drag on the slider-wrap */
  if (!_sliderReady) {
    _sliderReady = true;
    var wrap = track.closest('.slider-wrap');
    if (wrap && !wrap._sliderBound) {
      wrap._sliderBound = true;
      var startX = 0, dragging = false;

      wrap.addEventListener('touchstart', function(e) {
        startX   = e.touches[0].clientX;
        dragging = true;
      }, { passive: true });

      wrap.addEventListener('touchend', function(e) {
        if (!dragging) return; dragging = false;
        var diff = startX - e.changedTouches[0].clientX;
        if (Math.abs(diff) > 40) sliderGoTo(_sliderCurrent + (diff > 0 ? 1 : -1));
      });

      wrap.addEventListener('mousedown', function(e) {
        startX = e.clientX; dragging = true; e.preventDefault();
      });
      wrap.addEventListener('mouseup', function(e) {
        if (!dragging) return; dragging = false;
        if (Math.abs(startX - e.clientX) > 40) sliderGoTo(_sliderCurrent + (startX > e.clientX ? 1 : -1));
      });
      wrap.addEventListener('mouseleave', function() { dragging = false; });
    }
  }
}

function sliderGoTo(idx) {
  if (_sliderCount < 2) return;
  _sliderCurrent = ((idx % _sliderCount) + _sliderCount) % _sliderCount;

  var track = el('img-track');
  var dots  = el('img-dots');
  if (!track) return;

  /* Count position among VISIBLE slides only */
  var goodSlides = track.querySelectorAll('.slide[data-ok]');
  var targetSlide = goodSlides[_sliderCurrent];
  if (!targetSlide) return;

  /* Calculate offset: sum widths of preceding visible slides */
  var offset = 0;
  goodSlides.forEach(function(s, i) {
    if (i < _sliderCurrent) offset += s.offsetWidth;
  });

  track.style.transition = 'transform .35s ease';
  track.style.transform  = 'translateX(-' + offset + 'px)';

  if (dots) {
    dots.querySelectorAll('.dot').forEach(function(d, i) {
      d.classList.toggle('active', i === _sliderCurrent);
    });
  }
}

/* ══════════════════════════════════════════════════════
   VIDEO PLAYER
   Strategy: render <video> directly. On iOS Safari private S3,
   checkVideoUrl may not work — so we render the video tag regardless
   and detect failure via the 'error' event. If error fires, we swap
   to a placeholder.
   ══════════════════════════════════════════════════════ */

function buildVideoFrame(videoUrl) {
  var placeholder =
    '<div class="media-placeholder">' +
    '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
    '<polygon points="23 7 16 12 23 17 23 7"/>' +
    '<rect x="1" y="5" width="15" height="14" rx="2"/></svg>' +
    '<span>Product Video</span></div>';

  if (!videoUrl) {
    return '<div class="media-frame" id="vid-frame">' +
      '<div class="slider-wrap"><div class="slider-track">' +
      '<div class="slide">'+placeholder+'</div>' +
      '</div></div><div class="media-label">Product Video</div></div>';
  }

  return (
    '<div class="media-frame vid-player-frame" id="vid-frame">' +
      '<video id="leeba-vid" src="'+esc(videoUrl)+'" playsinline webkit-playsinline preload="metadata"></video>' +
      /* Overlay — shown while paused */
      '<div class="vid-overlay" id="vid-overlay">' +
        '<button class="vid-play-big" id="vid-play-big" aria-label="Play">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>' +
        '</button>' +
      '</div>' +
      /* Controls bar */
      '<div class="vid-controls" id="vid-controls">' +
        '<button class="vid-btn" id="vid-rw" title="−10s">' +
          '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">' +
          '<polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 .49-4.98"/></svg>' +
        '</button>' +
        '<button class="vid-btn" id="vid-pp" aria-label="Play/Pause">' +
          '<svg class="icon-play" viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>' +
          '<svg class="icon-pause" viewBox="0 0 24 24" fill="currentColor" style="display:none">' +
            '<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/></svg>' +
        '</button>' +
        '<button class="vid-btn" id="vid-ff" title="+10s">' +
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
          '<svg class="icon-mute" viewBox="0 0 24 24" fill="currentColor" style="display:none">' +
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
  var vid = el('leeba-vid');
  if (!vid) return;

  var vidFrame  = el('vid-frame');
  var overlay   = el('vid-overlay');
  var bigPlay   = el('vid-play-big');
  var playBtn   = el('vid-pp');
  var rwBtn     = el('vid-rw');
  var ffBtn     = el('vid-ff');
  var muteBtn   = el('vid-mute');
  var fsBtn     = el('vid-fs');
  var seekBar   = el('vid-seek-bar');
  var seekFill  = el('vid-seek-fill');
  var seekThumb = el('vid-seek-thumb');
  var timeDisp  = el('vid-time');
  var controls  = el('vid-controls');

  /* If video errors (file not on S3), swap frame to placeholder */
  vid.addEventListener('error', function() {
    if (!vidFrame) return;
    vidFrame.classList.remove('vid-player-frame');
    vidFrame.innerHTML =
      '<div class="slider-wrap"><div class="slider-track">' +
      '<div class="slide"><div class="media-placeholder">' +
      '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
      '<polygon points="23 7 16 12 23 17 23 7"/>' +
      '<rect x="1" y="5" width="15" height="14" rx="2"/></svg>' +
      '<span>Product Video</span></div></div>' +
      '</div></div><div class="media-label">Product Video</div>';
  });

  function fmtTime(s) {
    if (!isFinite(s)||s<0) return '0:00';
    var m=Math.floor(s/60), sec=Math.floor(s%60);
    return m+':'+(sec<10?'0':'')+sec;
  }

  function setPlayUI(paused) {
    playBtn.querySelector('.icon-play').style.display  = paused ? '' : 'none';
    playBtn.querySelector('.icon-pause').style.display = paused ? 'none' : '';
    overlay.style.display = paused ? '' : 'none';
  }

  function updateSeek() {
    if (!vid.duration||!isFinite(vid.duration)) return;
    var pct = (vid.currentTime/vid.duration)*100;
    seekFill.style.width = pct+'%';
    seekThumb.style.left = pct+'%';
    timeDisp.textContent = fmtTime(vid.currentTime)+' / '+fmtTime(vid.duration);
  }

  var hideTimer;
  function showControls() {
    controls.classList.add('visible');
    clearTimeout(hideTimer);
    if (!vid.paused) hideTimer = setTimeout(function(){ controls.classList.remove('visible'); }, 3000);
  }

  vidFrame.addEventListener('mouseenter', showControls);
  vidFrame.addEventListener('mousemove',  showControls);
  vidFrame.addEventListener('touchstart', showControls, { passive:true });

  overlay.addEventListener('click', function() { vid.play(); });
  bigPlay.addEventListener('click', function() { vid.play(); });

  playBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.paused ? vid.play() : vid.pause();
  });
  rwBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.currentTime = Math.max(0, vid.currentTime-10); showControls();
  });
  ffBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.currentTime = Math.min(vid.duration||0, vid.currentTime+10); showControls();
  });
  muteBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    vid.muted = !vid.muted;
    muteBtn.querySelector('.icon-sound').style.display = vid.muted ? 'none' : '';
    muteBtn.querySelector('.icon-mute').style.display  = vid.muted ? '' : 'none';
    showControls();
  });

  /* Fullscreen: iOS needs webkitEnterFullscreen on the <video> element itself */
  fsBtn.addEventListener('click', function(e) {
    e.stopPropagation();
    if (document.fullscreenElement || document.webkitFullscreenElement) {
      (document.exitFullscreen || document.webkitExitFullscreen || function(){}).call(document);
    } else if (vid.webkitEnterFullscreen) {
      vid.webkitEnterFullscreen();
    } else if (vidFrame.requestFullscreen) {
      vidFrame.requestFullscreen();
    } else if (vidFrame.webkitRequestFullscreen) {
      vidFrame.webkitRequestFullscreen();
    }
    showControls();
  });

  function seekTo(clientX) {
    var rect = seekBar.getBoundingClientRect();
    vid.currentTime = Math.max(0,Math.min(1,(clientX-rect.left)/rect.width)) * (vid.duration||0);
    showControls();
  }
  var seeking = false;
  seekBar.addEventListener('mousedown', function(e){ e.stopPropagation(); seeking=true; seekTo(e.clientX); });
  document.addEventListener('mouseup',  function()  { seeking=false; });
  document.addEventListener('mousemove',function(e) { if(seeking) seekTo(e.clientX); });
  seekBar.addEventListener('touchstart',function(e){ e.stopPropagation(); seeking=true; }, {passive:true});
  seekBar.addEventListener('touchend',  function()  { seeking=false; });
  seekBar.addEventListener('touchmove', function(e) { e.preventDefault(); if(e.touches[0]) seekTo(e.touches[0].clientX); }, {passive:false});

  vid.addEventListener('play',           function(){ setPlayUI(false); });
  vid.addEventListener('pause',          function(){ setPlayUI(true);  });
  vid.addEventListener('ended',          function(){ setPlayUI(true);  });
  vid.addEventListener('timeupdate',     updateSeek);
  vid.addEventListener('loadedmetadata', updateSeek);
}

/* ══════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════ */
function renderPage(p) {
  if (p.sku) document.title = 'LEEBA \u2014 ' + p.sku + (p.description ? ' \u00B7 ' + p.description : '');

  function v(val) {
    return val
      ? '<span class="spec-value">'+esc(String(val))+'</span>'
      : '<span class="spec-value empty">\u2014</span>';
  }

  var dItems = p.diamondDetails || [];
  var diamondHtml;
  if (dItems.length > 4) {
    var rows = Math.ceil(dItems.length/2);
    diamondHtml = '<ul class="diamond-grid" style="grid-template-rows:repeat('+rows+',auto)">' +
      dItems.map(function(d){ return '<li>'+esc(d)+'</li>'; }).join('') + '</ul>';
  } else {
    diamondHtml = '<ul class="diamond-list">' +
      (dItems.length ? dItems.map(function(d){ return '<li>'+esc(d)+'</li>'; }).join('') : '<li>\u2014</li>') +
      '</ul>';
  }

  var catDisplay = p.category ? p.category.charAt(0).toUpperCase()+p.category.slice(1).toLowerCase() : '';

  el('product').innerHTML =
    '<div class="product-page">' +
      '<div class="badge-row">' +
        '<span class="badge">'+esc(p.sku||'')+(p.description?' \u00B7 '+esc(p.description):'')+' </span>' +
      '</div>' +
      '<div class="media-row">' +
        buildImageFrame(p.imageUrls) +
        buildVideoFrame(p.videoUrl) +
      '</div>' +
      '<div class="details-section">' +
        '<div class="section-title">Details</div>' +
        '<div class="specs-grid">' +
          '<div class="spec-item"><span class="spec-label">SKU</span>'          + v(p.sku)                  + '</div>' +
          '<div class="spec-item"><span class="spec-label">Category</span>'     + v(catDisplay)             + '</div>' +
          '<div class="spec-item"><span class="spec-label">Purity / KT</span>'  + v(p.purity)               + '</div>' +
          '<div class="spec-item"><span class="spec-label">Metal Tone</span>'   + v(toneLabel(p.metalTone)) + '</div>' +
          '<div class="spec-item"><span class="spec-label">Size</span>'         + v(p.size)                 + '</div>' +
          '<div class="spec-item"><span class="spec-label">Gross Weight</span>' + v(p.grossWeight)          + '</div>' +
          '<div class="spec-item"><span class="spec-label">Net Weight</span>'   + v(p.netWeight)            + '</div>' +
          '<div class="spec-item"><span class="spec-label">Diamond Wgt</span>'  + v(p.diaWeight)            + '</div>' +
          '<div class="spec-item"><span class="spec-label">Diamond Pcs</span>'  + v(p.diaPcs)               + '</div>' +
          '<div class="spec-item"><span class="spec-label">Location</span>'     + v(p.location)             + '</div>' +
        '</div>' +
      '</div>' +
      '<div class="details-section">' +
        '<div class="section-title">Diamond Details</div>' +
        diamondHtml +
      '</div>' +
    '</div>';

  show('product');
  hide('loading');
  initVideoPlayer();

  /* FAB */
  var oldFab = el('ask-price-fab');
  if (oldFab) oldFab.remove();
  var fab = document.createElement('a');
  fab.id        = 'ask-price-fab';
  fab.href      = buildWaLink(p);
  fab.target    = '_blank';
  fab.className = 'ask-price-fab';
  fab.innerHTML =
    '<svg width="15" height="15" fill="currentColor" viewBox="0 0 24 24">' +
    '<path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297' +
    '-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788' +
    '-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174' +
    '.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579' +
    '-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016' +
    '-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262' +
    '.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248' +
    '-1.289.173-1.413-.074-.124-.272-.198-.57-.347z"/>' +
    '<path d="M5.339 17.54A9.956 9.956 0 0 1 2 12C2 6.477 6.477 2 12 2s10 4.477 10 10' +
    '-4.477 10-10 10a9.956 9.956 0 0 1-5.54-1.661L2 22l2.339-4.46z"/></svg>' +
    '<span>Ask for Price</span>';
  document.body.appendChild(fab);
}

/* ══════════════════════════════════════════════════════
   LOAD PRODUCT
   Simple sequential flow:
   1. Fetch API → parse product
   2. Attach S3 image URLs + video URL to product object
   3. Render page once — images self-resolve via onload/onerror
   ══════════════════════════════════════════════════════ */
async function loadProduct() {
  show('loading');
  hide('error');
  hide('product');
  el('product').innerHTML = '';

  var params = new URLSearchParams(window.location.search);
  var sku    = params.get('sku') || params.get('barcode') || '';

  if (!sku) {
    renderPage(MOCK);
    return;
  }

  try {
    var url  = API_BASE + '?action=product&barcode=' + encodeURIComponent(sku);
    var res  = await fetch(url, { redirect:'follow' });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    var json = await res.json();
    var p    = parseApi(json);

    /* Attach S3 URLs — images will self-filter via onload/onerror in the DOM */
    p.imageUrls = s3ImageUrls(sku);
    p.videoUrl  = S3_BASE + sku + '.mp4';

    renderPage(p);

  } catch(err) {
    el('error-msg').textContent = 'Could not load product: ' + err.message;
    show('error');
    hide('loading');
  }
}

loadProduct();
