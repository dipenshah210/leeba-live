/* ============================================================
   LEEBA — Product DNA  (leeba-product.js)
   ============================================================ */

/* ── CONFIG ── */
var API_BASE = 'https://script.google.com/macros/s/AKfycbxIKjKGaz4h9LerAm7Vn81nd5AJiOGpxhLAl8V0vSCgymkleCiCm4qPyG1ZkfSXbdp7tw/exec';
var S3_BASE  = 'https://leeba-media.s3.ap-south-1.amazonaws.com/';
var WA_NUM   = '919979460555';

/* ── MAPS ── */
var TONE_MAP = {
  W:'White', Y:'Yellow', YW:'Yellow + White',
  R:'Rose',  RW:'Rose + White', D:'Dual'
};
var TONE_CODE = {
  'WHITE':'W','YELLOW':'Y','ROSE':'R','PINK':'R','DUAL':'D',
  'YEL/WHT':'YW','YELLOW WHITE':'YW','YELLOW/WHITE':'YW',
  'ROSE WHITE':'RW','ROSE/WHITE':'RW'
};
var SHAPE_MAP = {
  RD:'Round', OV:'Oval', MQ:'Marquise', PE:'Pear', HR:'Heart',
  EM:'Emerald', PR:'Princess', AS:'Asscher', CU:'Cushion', RA:'Radiant',
  TR:'Trillion', BG:'Baguette', HS:'Heart', CB:'Cushion', TRI:'Triangle', RAD:'Radiant'
};

/* ── DEMO PRODUCT ── */
var mockProduct = {
  sku:'LRG000', category:'RING', purity:'18KT', grossWeight:'8.50 g',
  netWeight:'6.20 g', diaWeight:'1.24 ct', diaPcs:'68', metalTone:'W',
  location:'Mumbai', size:'16',
  description:'Sample product — shown when no SKU in URL',
  imageUrls:['https://picsum.photos/seed/leeba1/800/600','https://picsum.photos/seed/leeba2/800/600'],
  videoUrl:'',
  diamondDetails:[
    'Round · 0.50 ct / 22 pcs · E-F/VVS-VS',
    'Pear · 0.40 ct / 12 pcs · G/VS1',
    'Marquise · 0.34 ct / 8 pcs · G/SI1'
  ]
};

/* ── SMALL HELPERS ── */
function esc(s) {
  return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;')
                      .replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}
function toneLabel(t) { return TONE_MAP[t]||t||''; }
function fmtNum(v,d)  { var n=Number(v); return (v==null||v===''||isNaN(n))?'':n.toFixed(d!=null?d:2); }
function $id(id)      { return document.getElementById(id); }
function show(id)     { $id(id).style.display=''; }
function hide(id)     { $id(id).style.display='none'; }

/* ── API PARSER ── */
function parseApiProduct(json) {
  var purNum   = json.Purity!=null ? String(json.Purity).trim() : '';
  var toneRaw  = String(json.MetalTone||'').trim().toUpperCase();
  var toneCode = TONE_CODE[toneRaw] || toneRaw.charAt(0) || '';
  var desc     = String(json.Decription||json.Description||json.description||'').trim();
  var diamonds = Array.isArray(json.diamonds) ? json.diamonds : [];
  var dDetails = diamonds.map(function(d) {
    return (SHAPE_MAP[d.shape]||d.shape||'—') +
      ' · '+(d.wgt!=null?parseFloat(d.wgt).toFixed(2)+' ct':'—')+
      ' / '+(d.pcs!=null?d.pcs+' pcs':'—')+
      ' · '+(d.color&&d.color.trim()?d.color.trim():'E-F')+
      ' / '+(d.clarity&&d.clarity.trim()?d.clarity.trim():'VVS-VS')+
      (d.certiNumber&&String(d.certiNumber).trim()?' · IGI: '+String(d.certiNumber).trim():'');
  });
  return {
    sku:          String(json.SKU||'').trim(),
    category:     String(json.category||'').trim().toUpperCase(),
    purity:       purNum?purNum+'KT':'',
    metalTone:    toneCode,
    grossWeight:  json.grossWgt?fmtNum(json.grossWgt,2)+' g':'',
    netWeight:    json.netWgt  ?fmtNum(json.netWgt,2)+' g':'',
    diaWeight:    json.diaWgt  ?fmtNum(json.diaWgt,2)+' ct':'',
    diaPcs:       json.diaPcs!=null?String(json.diaPcs):'',
    location:     String(json.location||'').trim(),
    size:         String(json.size||'').trim(),
    description:  desc,
    imageUrls:    [],
    videoUrl:     '',
    diamondDetails: dDetails
  };
}

/* ── WA LINK ── */
function buildWaLink(p) {
  var msg = 'Hi LEEBA!\nI\'m interested in:\n'+
    'SKU: '+(p.sku||'—')+'\nCategory: '+(p.category||'—')+
    '\nPurity: '+(p.purity||'—')+'\nMetal Tone: '+(toneLabel(p.metalTone)||'—')+
    '\nGross Wt: '+(p.grossWeight||'—')+' | Net Wt: '+(p.netWeight||'—')+
    '\nDiamond: '+(p.diaWeight||'—')+' ('+(p.diaPcs||'—')+' pcs)'+
    '\nLocation: '+(p.location||'—')+'\nDescription: '+(p.description||'—')+
    '\n\nKindly share the price. Thank you!';
  return 'https://wa.me/'+WA_NUM+'?text='+encodeURIComponent(msg);
}

/* ══════════════════════════════════════════════════════════
   S3 EXISTENCE CHECK
   Uses fetch() with mode:'cors' — from live.leeba.co the S3
   CORS policy allows this, giving real 200 vs 403 status codes.
   Checks all candidates in parallel, returns only those with status 200,
   preserving the original order: SKU.png first, then _01, _02 …
   ══════════════════════════════════════════════════════════ */
function checkS3Files(sku) {
  var imgCandidates = [
    S3_BASE+sku+'.png',
    S3_BASE+sku+'_01.png',
    S3_BASE+sku+'_02.png',
    S3_BASE+sku+'_03.png',
    S3_BASE+sku+'_04.png',
    S3_BASE+sku+'_05.png'
  ];
  var videoUrl = S3_BASE+sku+'.mp4';

  /* Check one URL — resolves to url if 200, null otherwise */
  function checkOne(url) {
    return fetch(url, {method:'HEAD', mode:'cors'})
      .then(function(r){ return r.ok ? url : null; })
      .catch(function(){ return null; });
  }

  var imgChecks   = imgCandidates.map(checkOne);
  var videoCheck  = checkOne(videoUrl);

  return Promise.all([Promise.all(imgChecks), videoCheck])
    .then(function(results) {
      var validImgs = results[0].filter(Boolean);  /* preserves order */
      var validVid  = results[1] || '';
      return { imageUrls: validImgs, videoUrl: validVid };
    });
}

/* ══════════════════════════════════════════════════════════
   IMAGE FRAME  — clean slider, no inline handlers
   ══════════════════════════════════════════════════════════ */
var IMG_PLACEHOLDER =
  '<div class="media-placeholder">' +
  '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
  '<rect x="3" y="3" width="18" height="18" rx="2"/>' +
  '<circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>' +
  '<span>Product Image</span></div>';

var VID_PLACEHOLDER =
  '<div class="media-placeholder">' +
  '<svg width="44" height="44" fill="none" stroke="currentColor" stroke-width="1.2" viewBox="0 0 24 24">' +
  '<polygon points="23 7 16 12 23 17 23 7"/>' +
  '<rect x="1" y="5" width="15" height="14" rx="2"/></svg>' +
  '<span>Product Video</span></div>';

function buildImageFrame(urls) {
  if (!urls || urls.length === 0) {
    return '<div class="media-frame" id="img-frame">' +
      '<div class="slider-wrap"><div class="slider-track">' +
      '<div class="slide">'+IMG_PLACEHOLDER+'</div>' +
      '</div></div><div class="media-label">Product Image</div></div>';
  }

  var slides = urls.map(function(url) {
    return '<div class="slide"><img src="'+esc(url)+'" alt="Product image"/></div>';
  }).join('');

  var dots = urls.length > 1
    ? '<div class="slider-dots">' +
      urls.map(function(_,i){
        return '<button class="dot'+(i===0?' active':'')+
               '" aria-label="Slide '+(i+1)+'"></button>';
      }).join('') + '</div>'
    : '';

  return '<div class="media-frame" id="img-frame">' +
    '<div class="slider-wrap"><div class="slider-track">'+slides+'</div></div>' +
    dots +
    '<div class="media-label">Product Image</div></div>';
}

function initSlider() {
  var frame = $id('img-frame');
  if (!frame) return;
  var track  = frame.querySelector('.slider-track');
  var slides = frame.querySelectorAll('.slide');
  var dots   = frame.querySelectorAll('.dot');
  var count  = slides.length;
  if (!track || count < 2) return;

  var cur = 0;

  function goTo(n) {
    cur = ((n % count) + count) % count;
    track.style.transform = 'translateX(-'+(cur*100)+'%)';
    dots.forEach(function(d,i){ d.classList.toggle('active', i===cur); });
  }

  dots.forEach(function(d,i){ d.addEventListener('click', function(){ goTo(i); }); });

  /* Touch swipe */
  var startX=0, moved=false;
  var wrap = frame.querySelector('.slider-wrap');
  wrap.addEventListener('touchstart', function(e){
    startX=e.touches[0].clientX; moved=false;
  }, {passive:true});
  wrap.addEventListener('touchmove', function(){
    moved=true;
  }, {passive:true});
  wrap.addEventListener('touchend', function(e){
    if (!moved) return;
    var diff = startX - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 40) goTo(cur + (diff>0?1:-1));
  });

  /* Mouse drag */
  var mStart=0, mDragging=false;
  wrap.addEventListener('mousedown', function(e){
    mStart=e.clientX; mDragging=true; e.preventDefault();
  });
  wrap.addEventListener('mouseup', function(e){
    if (!mDragging) return; mDragging=false;
    var diff = mStart - e.clientX;
    if (Math.abs(diff) > 40) goTo(cur + (diff>0?1:-1));
  });
  wrap.addEventListener('mouseleave', function(){ mDragging=false; });
}

/* ══════════════════════════════════════════════════════════
   VIDEO FRAME
   ══════════════════════════════════════════════════════════ */
function buildVideoFrame(videoUrl) {
  if (!videoUrl) {
    return '<div class="media-frame" id="vid-frame">' +
      '<div class="slider-wrap"><div class="slider-track">' +
      '<div class="slide">'+VID_PLACEHOLDER+'</div>' +
      '</div></div><div class="media-label">Product Video</div></div>';
  }

  return (
    '<div class="media-frame vid-player-frame" id="vid-frame">' +
      '<video id="leeba-vid" src="'+esc(videoUrl)+'" playsinline webkit-playsinline preload="metadata"></video>' +
      '<div class="vid-overlay" id="vid-overlay">' +
        '<button class="vid-play-big" id="vid-play-big" aria-label="Play">' +
          '<svg viewBox="0 0 24 24" fill="currentColor"><polygon points="5,3 19,12 5,21"/></svg>' +
        '</button>' +
      '</div>' +
      '<div class="vid-controls" id="vid-controls">' +
        '<button class="vid-btn" id="vid-rw" title="-10s">' +
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
            '<div class="vid-seek-fill" id="vid-seek-fill"></div>' +
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
  var vid = $id('leeba-vid');
  if (!vid) return;

  var frame     = $id('vid-frame');
  var overlay   = $id('vid-overlay');
  var bigPlay   = $id('vid-play-big');
  var playBtn   = $id('vid-pp');
  var rwBtn     = $id('vid-rw');
  var ffBtn     = $id('vid-ff');
  var muteBtn   = $id('vid-mute');
  var fsBtn     = $id('vid-fs');
  var seekBar   = $id('vid-seek-bar');
  var seekFill  = $id('vid-seek-fill');
  var seekThumb = $id('vid-seek-thumb');
  var timeDisp  = $id('vid-time');
  var controls  = $id('vid-controls');

  /* If video file not found on S3, swap to placeholder */
  vid.addEventListener('error', function() {
    frame.classList.remove('vid-player-frame');
    frame.innerHTML = '<div class="slider-wrap"><div class="slider-track">' +
      '<div class="slide">'+VID_PLACEHOLDER+'</div>' +
      '</div></div><div class="media-label">Product Video</div>';
  });

  function fmtTime(s) {
    if (!isFinite(s)||s<0) return '0:00';
    var m=Math.floor(s/60), sc=Math.floor(s%60);
    return m+':'+(sc<10?'0':'')+sc;
  }
  function setPlayUI(paused) {
    playBtn.querySelector('.icon-play').style.display  = paused?'':'none';
    playBtn.querySelector('.icon-pause').style.display = paused?'none':'';
    overlay.style.display = paused?'':'none';
  }
  function updateSeek() {
    if (!vid.duration||!isFinite(vid.duration)) return;
    var pct=(vid.currentTime/vid.duration)*100;
    seekFill.style.width = pct+'%';
    seekThumb.style.left = pct+'%';
    timeDisp.textContent = fmtTime(vid.currentTime)+' / '+fmtTime(vid.duration);
  }

  var hideTimer;
  function showControls() {
    controls.classList.add('visible');
    clearTimeout(hideTimer);
    if (!vid.paused) hideTimer=setTimeout(function(){controls.classList.remove('visible');},3000);
  }

  frame.addEventListener('mouseenter', showControls);
  frame.addEventListener('mousemove',  showControls);
  frame.addEventListener('touchstart', showControls, {passive:true});
  overlay.addEventListener('click', function(){ vid.play(); });
  bigPlay.addEventListener('click', function(){ vid.play(); });
  playBtn.addEventListener('click', function(e){
    e.stopPropagation(); vid.paused?vid.play():vid.pause();
  });
  rwBtn.addEventListener('click', function(e){
    e.stopPropagation(); vid.currentTime=Math.max(0,vid.currentTime-10); showControls();
  });
  ffBtn.addEventListener('click', function(e){
    e.stopPropagation(); vid.currentTime=Math.min(vid.duration||0,vid.currentTime+10); showControls();
  });
  muteBtn.addEventListener('click', function(e){
    e.stopPropagation(); vid.muted=!vid.muted;
    muteBtn.querySelector('.icon-sound').style.display=vid.muted?'none':'';
    muteBtn.querySelector('.icon-mute').style.display =vid.muted?'':'none';
    showControls();
  });

  /* Fullscreen: iOS Safari requires webkitEnterFullscreen on <video> element */
  fsBtn.addEventListener('click', function(e){
    e.stopPropagation();
    if (document.fullscreenElement||document.webkitFullscreenElement) {
      (document.exitFullscreen||document.webkitExitFullscreen||function(){}).call(document);
    } else if (vid.webkitEnterFullscreen) {
      vid.webkitEnterFullscreen();
    } else if (frame.requestFullscreen) {
      frame.requestFullscreen();
    } else if (frame.webkitRequestFullscreen) {
      frame.webkitRequestFullscreen();
    }
    showControls();
  });

  function seekTo(cx) {
    var r=seekBar.getBoundingClientRect();
    vid.currentTime=Math.max(0,Math.min(1,(cx-r.left)/r.width))*(vid.duration||0);
    showControls();
  }
  var seeking=false;
  seekBar.addEventListener('mousedown',function(e){e.stopPropagation();seeking=true;seekTo(e.clientX);});
  document.addEventListener('mouseup',  function(){seeking=false;});
  document.addEventListener('mousemove',function(e){if(seeking)seekTo(e.clientX);});
  seekBar.addEventListener('touchstart',function(e){e.stopPropagation();seeking=true;},{passive:true});
  seekBar.addEventListener('touchend',  function(){seeking=false;});
  seekBar.addEventListener('touchmove', function(e){
    e.preventDefault(); if(e.touches[0])seekTo(e.touches[0].clientX);
  },{passive:false});

  vid.addEventListener('play',           function(){setPlayUI(false);});
  vid.addEventListener('pause',          function(){setPlayUI(true);});
  vid.addEventListener('ended',          function(){setPlayUI(true);});
  vid.addEventListener('timeupdate',     updateSeek);
  vid.addEventListener('loadedmetadata', updateSeek);
}

/* ══════════════════════════════════════════════════════════
   RENDER PAGE
   ══════════════════════════════════════════════════════════ */
function renderPage(p) {
  if (p.sku) document.title='LEEBA \u2014 '+p.sku+(p.description?' \u00B7 '+p.description:'');

  function v(val) {
    return val
      ? '<span class="spec-value">'+esc(String(val))+'</span>'
      : '<span class="spec-value empty">\u2014</span>';
  }

  var dItems=p.diamondDetails||[];
  var diamondHtml;
  if (dItems.length>4) {
    var rows=Math.ceil(dItems.length/2);
    diamondHtml='<ul class="diamond-grid" style="grid-template-rows:repeat('+rows+',auto)">'+
      dItems.map(function(d){return '<li>'+esc(d)+'</li>';}).join('')+'</ul>';
  } else {
    diamondHtml='<ul class="diamond-list">'+
      (dItems.length?dItems.map(function(d){return '<li>'+esc(d)+'</li>';}).join(''):'<li>\u2014</li>')+
      '</ul>';
  }

  var cat=p.category?p.category.charAt(0).toUpperCase()+p.category.slice(1).toLowerCase():'';

  $id('product').innerHTML =
    '<div class="product-page">' +
      '<div class="badge-row"><span class="badge">'+esc(p.sku||'')+(p.description?' \u00B7 '+esc(p.description):'')+' </span></div>' +
      '<div class="media-row">'+buildImageFrame(p.imageUrls)+buildVideoFrame(p.videoUrl)+'</div>' +
      '<div class="details-section"><div class="section-title">Details</div>' +
        '<div class="specs-grid">' +
          '<div class="spec-item"><span class="spec-label">SKU</span>'          +v(p.sku)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Category</span>'     +v(cat)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Purity / KT</span>'  +v(p.purity)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Metal Tone</span>'   +v(toneLabel(p.metalTone))+'</div>' +
          '<div class="spec-item"><span class="spec-label">Size</span>'         +v(p.size)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Gross Weight</span>' +v(p.grossWeight)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Net Weight</span>'   +v(p.netWeight)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Diamond Wgt</span>'  +v(p.diaWeight)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Diamond Pcs</span>'  +v(p.diaPcs)+'</div>' +
          '<div class="spec-item"><span class="spec-label">Location</span>'     +v(p.location)+'</div>' +
        '</div>' +
      '</div>' +
      '<div class="details-section"><div class="section-title">Diamond Details</div>'+diamondHtml+'</div>' +
    '</div>';

  show('product');
  hide('loading');

  initSlider();
  initVideoPlayer();

  /* FAB */
  var old=$id('ask-price-fab'); if(old)old.remove();
  var fab=document.createElement('a');
  fab.id='ask-price-fab'; fab.href=buildWaLink(p); fab.target='_blank'; fab.className='ask-price-fab';
  fab.innerHTML=
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

/* ══════════════════════════════════════════════════════════
   MAIN — simple sequential flow:
   1. Fetch API → get product details
   2. Check S3 → get real image/video URLs (fetch HEAD with cors)
   3. Attach URLs to product → renderPage once
   ══════════════════════════════════════════════════════════ */
async function loadProduct() {
  show('loading');
  hide('error');
  hide('product');
  $id('product').innerHTML = '';

  var params = new URLSearchParams(window.location.search);
  var sku    = params.get('sku') || params.get('barcode') || '';

  if (!sku) {
    renderPage(mockProduct);
    return;
  }

  try {
    /* Step 1: API + S3 checks in parallel (both are network calls, no reason to wait) */
    var apiUrl = API_BASE+'?action=product&barcode='+encodeURIComponent(sku);
    var [apiRes, s3] = await Promise.all([
      fetch(apiUrl, {redirect:'follow'}),
      checkS3Files(sku)
    ]);

    if (!apiRes.ok) throw new Error('API error: HTTP '+apiRes.status);
    var json = await apiRes.json();
    var p    = parseApiProduct(json);

    /* Step 2: attach confirmed S3 URLs */
    p.imageUrls = s3.imageUrls;
    p.videoUrl  = s3.videoUrl;

    /* Step 3: render once */
    renderPage(p);

  } catch(err) {
    $id('error-msg').textContent = 'Could not load product: '+err.message;
    show('error');
    hide('loading');
  }
}

loadProduct();
