/* ══════════════════════════════════════
   WEBTOON STUDIO — AUTHENTIFICATION
   ══════════════════════════════════════ */

async function hashPassword(password) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
  return [...new Uint8Array(buf)].map(b => b.toString(16).padStart(2,'0')).join('')
}

async function checkLogin() {
  const overlay = document.getElementById('loginOverlay')
  const input   = document.getElementById('loginInput')
  const errorEl = document.getElementById('loginError')
  if (sessionStorage.getItem('ws_auth') === '1') { overlay.classList.add('hidden'); return }
  if (!window.__WS_CONFIG) { errorEl.textContent = 'Fichier config.js introuvable.'; errorEl.classList.add('visible'); return }

  async function attempt() {
    const pw = input.value; if (!pw) { shake(); return }
    const hash = await hashPassword(pw)
    if (hash === window.__WS_CONFIG.PASSWORD_HASH) {
      sessionStorage.setItem('ws_auth','1')
      overlay.classList.add('fade-out')
      setTimeout(() => overlay.classList.add('hidden'), 400)
    } else {
      shake(); errorEl.textContent = 'Mot de passe incorrect.'; errorEl.classList.add('visible')
      input.value = ''; setTimeout(() => errorEl.classList.remove('visible'), 2500)
    }
  }
  function shake() {
    input.classList.remove('shake'); void input.offsetWidth
    input.classList.add('shake'); setTimeout(() => input.classList.remove('shake'), 400)
  }
  document.getElementById('loginBtn').addEventListener('click', attempt)
  input.addEventListener('keydown', e => { if (e.key === 'Enter') attempt() })
  setTimeout(() => input.focus(), 100)
}
checkLogin()

/* ══════════════════════════════════════
   WEBTOON STUDIO — EDITEUR
   ══════════════════════════════════════ */

/* ─── SUPABASE CLIENT ────────────────── */
let supabase = null
let sbStorage = null

function initSupabase() {
  const cfg = window.__WS_CONFIG
  if (!cfg?.SUPABASE_URL || !cfg?.SUPABASE_KEY) return
  try {
    supabase  = window.supabase.createClient(cfg.SUPABASE_URL, cfg.SUPABASE_KEY)
    sbStorage = supabase.storage.from(cfg.STORAGE_BUCKET || 'webtoon-images')
    updateSupabaseStatus(true)
  } catch(e) {
    console.error('Supabase init error:', e)
    updateSupabaseStatus(false)
  }
}

function updateSupabaseStatus(connected) {
  const dot  = document.querySelector('.status-dot')
  const text = document.querySelector('.status-text')
  if (!dot || !text) return
  if (connected) {
    dot.classList.add('connected')
    text.textContent = 'Supabase OK'
  } else {
    dot.classList.remove('connected')
    text.textContent = 'DB non connectée'
  }
}

/* ─── SAVE PAGE TO SUPABASE ──────────── */
async function savePageToSupabase(pageNumber, htmlContent) {
  if (!supabase) return
  const projectName = 'default'
  // Clean base64 images from content before saving — store URLs only
  const { error } = await supabase
    .from('pages')
    .upsert({
      project_name: projectName,
      page_number:  pageNumber,
      content:      htmlContent,
      updated_at:   new Date().toISOString()
    }, { onConflict: 'project_name,page_number' })
  if (error) console.error('Save error:', error)
}

/* ─── LOAD PAGES FROM SUPABASE ───────── */
async function loadPagesFromSupabase() {
  if (!supabase) return
  const { data, error } = await supabase
    .from('pages')
    .select('page_number, content')
    .eq('project_name', 'default')
    .order('page_number')
  if (error) { console.error('Load error:', error); return }
  if (!data?.length) return

  data.forEach(row => {
    state.pages[row.page_number] = row.content
  })

  // Create page buttons for pages beyond page 1
  data.forEach(row => {
    if (row.page_number === 1) return
    const existing = document.querySelector(`.page-btn[data-page="${row.page_number}"]`)
    if (!existing) {
      const btn = document.createElement('button')
      btn.className = 'page-btn'
      btn.dataset.page = row.page_number
      btn.textContent = 'P.' + row.page_number
      btn.onclick = () => switchToPage(row.page_number)
      document.getElementById('addPage').before(btn)
    }
  })

  // Load first page
  switchToPage(data[0].page_number)
  showToast('Projet chargé ✓')
}

/* ─── UPLOAD IMAGE TO SUPABASE ───────── */
async function uploadImageToSupabase(file) {
  if (!supabase) return null
  const ext  = file.name.split('.').pop()
  const name = `${Date.now()}.${ext}`
  const { error } = await supabase.storage
    .from(window.__WS_CONFIG.STORAGE_BUCKET || 'webtoon-images')
    .upload(name, file, { cacheControl: '3600', upsert: false })
  if (error) { showToast('Erreur upload image'); console.error(error); return null }
  const { data } = supabase.storage
    .from(window.__WS_CONFIG.STORAGE_BUCKET || 'webtoon-images')
    .getPublicUrl(name)
  return data.publicUrl
}



/* STATE */
const state = {
  selectedEl:  null,
  selectedEls: [],
  currentBubbleStyle: 'round',
  zoom: 1,
  gridOn: false,
  history: [],
  future: [],
  zCounter: 10,
  currentPage: 1,
  pages: {},
}

/* DOM */
const container    = document.getElementById('webtoon-container')
const propPanel    = document.getElementById('propertiesPanel')
const contextMenu  = document.getElementById('contextMenu')
const toast        = document.getElementById('toast')
const canvasWrapper= document.getElementById('canvasWrapper')

/* UTILS */
function showToast(msg, dur=2000) {
  toast.textContent = msg; toast.classList.add('show')
  clearTimeout(toast._t); toast._t = setTimeout(() => toast.classList.remove('show'), dur)
}
function saveHistory() {
  state.history.push(container.innerHTML); state.future = []
  if (state.history.length > 50) state.history.shift()
  state.pages[state.currentPage] = container.innerHTML
  // Debounced auto-save to Supabase
  clearTimeout(saveHistory._t)
  saveHistory._t = setTimeout(() => {
    savePageToSupabase(state.currentPage, container.innerHTML)
  }, 1500)
}
function removePlaceholder() {
  const ph = container.querySelector('.canvas-placeholder'); if (ph) ph.remove()
}
function getSnapped(v, s=20) { return Math.round(v/s)*s }
function rgbToHex(rgb) {
  const m = rgb.match(/\d+/g); if (!m) return '#000000'
  return '#' + m.slice(0,3).map(n => parseInt(n).toString(16).padStart(2,'0')).join('')
}

/* ─── SELECT / DESELECT ──────────────── */
function selectEl(el, addToMulti=false) {
  if (addToMulti) {
    if (!state.selectedEls.includes(el)) {
      state.selectedEls.push(el); el.classList.add('selected','multi-selected')
    }
    propPanel.classList.remove('visible')
  } else {
    // clear old
    if (state.selectedEl) state.selectedEl.classList.remove('selected')
    state.selectedEls.forEach(e => e.classList.remove('selected','multi-selected'))
    state.selectedEls = []
    state.selectedEl = el; el.classList.add('selected')
    showProperties(el)
  }
}
function deselectAll() {
  if (state.selectedEl) state.selectedEl.classList.remove('selected')
  state.selectedEls.forEach(e => e.classList.remove('selected','multi-selected'))
  state.selectedEl = null; state.selectedEls = []
  propPanel.classList.remove('visible')
}

/* ─── PROPERTIES PANEL ───────────────── */
function showProperties(el) {
  propPanel.classList.add('visible')
  const isBubble = el.classList.contains('text-bubble')
  const isPlain  = el.classList.contains('plain-text-block')
  const hasText  = isBubble || isPlain

  document.getElementById('propTextGroup').style.display      = hasText  ? '' : 'none'
  document.getElementById('propFontGroup').style.display      = hasText  ? '' : 'none'
  document.getElementById('propColorGroup').style.display     = isBubble ? '' : 'none'
  document.getElementById('propPanelColorGroup').style.display = el.classList.contains('panel-block') ? '' : 'none'

  const op = Math.round((parseFloat(el.style.opacity)||1)*100)
  document.getElementById('propOpacity').value = op
  document.getElementById('propOpacityVal').textContent = op + '%'

  if (isBubble) {
    document.getElementById('propBgColor').value     = el.dataset.fillColor   || '#ffffff'
    document.getElementById('propBorderColor').value = el.dataset.strokeColor || '#1a1a1a'
    document.querySelectorAll('.bubble-style-btn').forEach(b => b.classList.toggle('active', b.dataset.style===(el.dataset.bubbleStyle||'round')))
  }
  if (el.classList.contains('panel-block')) {
    document.getElementById('propPanelBgColor').value     = el.dataset.panelBg     || '#ffffff'
    document.getElementById('propPanelBorderColor').value = el.dataset.panelBorder || '#1a1a1a'
  }
  if (hasText) {
    const td = el.querySelector('.bubble-text-content')
    if (td) {
      const cs = window.getComputedStyle(td)
      document.getElementById('propTextColor').value  = rgbToHex(cs.color)
      document.getElementById('propFontSize').value   = cs.fontSize
      document.getElementById('propFontWeight').value = cs.fontWeight
    }
    const fam = el.dataset.fontFamily || 'DM Sans'
    document.querySelectorAll('.font-btn').forEach(b => b.classList.toggle('active', b.dataset.font===fam))
  }
}

/* ─── Z-ORDER ────────────────────────── */
function bringToFront() {
  if (!state.selectedEl) return
  state.zCounter++; state.selectedEl.style.zIndex = state.zCounter; saveHistory()
}
function sendToBack() {
  if (!state.selectedEl) return
  container.querySelectorAll('.text-bubble,.image-block,.panel-block,.plain-text-block').forEach(el => {
    if (el !== state.selectedEl) el.style.zIndex = (parseInt(el.style.zIndex)||10)+1
  })
  state.selectedEl.style.zIndex = 1; saveHistory()
}
document.getElementById('bringFront').onclick = bringToFront
document.getElementById('sendBack').onclick   = sendToBack

/* ─── BUBBLE SVG ─────────────────────────────────────────────────────────
   2 styles dessinés à la main — paths Bézier, trait fin 1.5px.
   ViewBox 100×60, preserveAspectRatio="none" pour s'étirer avec l'élément.
   ───────────────────────────────────────────────────────────────────── */
function buildBubbleSVG(style, fill, stroke) {
  const f  = fill   || '#ffffff'
  const s  = stroke || '#1a1a1a'
  const sw = 1.5

  // ── RONDE ────────────────────────────────────────────────────────────
  // Forme ovoïde légèrement irrégulière — plus vivante qu'une ellipse pure.
  // Path tracé manuellement : 4 points cardinaux + handles Bézier ajustés
  // pour donner un léger ventre en haut et un bas plus aplati.
  if (style === 'round') {
    return `<svg class="bubble-svg" viewBox="0 0 100 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="
        M 50,3
        C 72,3  97,12  97,30
        C 97,48  74,57  50,57
        C 26,57   3,48   3,30
        C  3,12  28, 3  50, 3
        Z
      " fill="${f}" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round"/>
    </svg>`
  }

  // ── RECTANGLE ARRONDI ────────────────────────────────────────────────
  // Coins arrondis asymétriques — légèrement plus ronds en haut qu'en bas
  // pour un look BD naturel. Path tracé point par point.
  if (style === 'rect') {
    return `<svg class="bubble-svg" viewBox="0 0 100 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
      <path d="
        M 14,3
        C  5,3   3,5   3,13
        L  3,47
        C  3,55   5,57  14,57
        L 86,57
        C 95,57  97,55  97,47
        L 97,13
        C 97, 5  95, 3  86, 3
        Z
      " fill="${f}" stroke="${s}" stroke-width="${sw}" stroke-linejoin="round"/>
    </svg>`
  }

  // Fallback ronde
  return `<svg class="bubble-svg" viewBox="0 0 100 60" preserveAspectRatio="none" xmlns="http://www.w3.org/2000/svg">
    <path d="M 50,3 C 72,3 97,12 97,30 C 97,48 74,57 50,57 C 26,57 3,48 3,30 C 3,12 28,3 50,3 Z" fill="${f}" stroke="${s}" stroke-width="${sw}"/>
  </svg>`
}

function updateBubbleSVG(el) {
  const div = document.createElement('div')
  div.innerHTML = buildBubbleSVG(el.dataset.bubbleStyle||'round', el.dataset.fillColor||'#ffffff', el.dataset.strokeColor||'#1a1a1a')
  const svgEl = div.firstChild
  const old = el.querySelector('.bubble-svg')
  if (old) old.replaceWith(svgEl); else el.insertBefore(svgEl, el.firstChild)
}

/* ─── FLOATING LOCK BUTTON ───────────────────────────────────────────────
   The lock button is a sibling element positioned over the canvas,
   NOT a child of the element. This avoids hover/overflow issues entirely.
   ─────────────────────────────────────────────────────────────────────── */
let _lockBtn = null
let _lockTarget = null

function updateLockPosition() {
  if (!_lockBtn || !_lockTarget) return
  const elR  = _lockTarget.getBoundingClientRect()
  const canR = container.getBoundingClientRect()
  _lockBtn.style.left = ((elR.right  - canR.left) / state.zoom) - 2  + 'px'
  _lockBtn.style.top  = ((elR.top    - canR.top)  / state.zoom) - 30 + 'px'
}

function showLockFor(el) {
  // Reuse existing button if same element
  if (_lockTarget === el && _lockBtn) { updateLockPosition(); return }
  hideLock()

  _lockTarget = el
  _lockBtn = document.createElement('button')
  _lockBtn.className = 'el-lock-float'
  _lockBtn.title = 'Verrouiller / Déverrouiller'
  _lockBtn.textContent = el.classList.contains('locked') ? '🔒' : '🔓'

  _lockBtn.addEventListener('mousedown', e => e.stopPropagation())
  _lockBtn.addEventListener('click', e => {
    e.stopPropagation()
    const locked = _lockTarget.classList.toggle('locked')
    _lockBtn.textContent = locked ? '🔒' : '🔓'
    _lockBtn.style.background = locked ? '#888' : ''
    if (locked && _lockTarget.classList.contains('text-bubble')) _lockTarget.classList.remove('editing')
    saveHistory()
  })

  container.appendChild(_lockBtn)
  updateLockPosition()
}

function hideLock() {
  if (_lockBtn) { _lockBtn.remove(); _lockBtn = null; _lockTarget = null }
}

/* ─── RESIZE HANDLES (8 directions) ─────────────────────────────────── */
function addResizeHandles(el) {
  ['nw','n','ne','e','se','s','sw','w'].forEach(dir => {
    const h = document.createElement('div')
    h.className = 'resize-handle ' + dir
    h.addEventListener('mousedown', e => {
      e.stopPropagation(); e.preventDefault()
      if (el.classList.contains('locked')) return
      const sx=e.clientX, sy=e.clientY, sw=el.offsetWidth, sh=el.offsetHeight
      const sl=parseInt(el.style.left)||0, st=parseInt(el.style.top)||0
      const aspect = sw/sh

      function mv(e) {
        const dx=(e.clientX-sx)/state.zoom, dy=(e.clientY-sy)/state.zoom
        let nw=sw,nh=sh,nl=sl,nt=st
        if(dir.includes('e'))  nw=Math.max(40,sw+dx)
        if(dir.includes('s'))  nh=Math.max(30,sh+dy)
        if(dir.includes('w')) {nw=Math.max(40,sw-dx);nl=sl+(sw-nw)}
        if(dir.includes('n')) {nh=Math.max(30,sh-dy);nt=st+(sh-nh)}
        if(e.shiftKey && el.classList.contains('image-block')) nh=nw/aspect
        if(state.gridOn){nw=getSnapped(nw);nh=getSnapped(nh);nl=getSnapped(nl);nt=getSnapped(nt)}
        el.style.width=nw+'px'; el.style.height=nh+'px'
        el.style.left=nl+'px'; el.style.top=nt+'px'
        updateLockPosition()
      }
      function up() { saveHistory(); window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up) }
      window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up)
    })
    el.appendChild(h)
  })
}

/* ─── MAKE ELEMENT INTERACTIVE ────────────────────────────────────────── */
function makeInteractive(el) {
  // Show lock on hover over element
  el.addEventListener('mouseenter', () => { showLockFor(el) })

  // Keep lock visible when hovering the lock button itself (handled by pointer-events)
  el.addEventListener('mouseleave', e => {
    const goingTo = e.relatedTarget
    // Keep lock visible if going to: lock btn, resize handle, or any child of element
    if (!goingTo) return
    if (goingTo === _lockBtn) return
    if (el.contains(goingTo)) return
    if (_lockTarget === el && !el.classList.contains('selected') && !el.classList.contains('locked')) hideLock()
  })

  let isDragging = false, didMove = false
  let sx, sy, sl, st

  el.addEventListener('mousedown', e => {
    if (e.button !== 0) return
    if (e.target.classList.contains('resize-handle') || e.target.closest('.resize-handle')) return
    if (e.target === _lockBtn) return
    if (el.classList.contains('locked')) { selectEl(el); return }
    if (el.classList.contains('editing') && e.target.closest('.bubble-text-content')) return

    e.stopPropagation()
    if (e.shiftKey) { selectEl(el, true); return }

    selectEl(el)
    showLockFor(el)
    isDragging=true; didMove=false
    sx=e.clientX; sy=e.clientY
    sl=parseInt(el.style.left)||0; st=parseInt(el.style.top)||0

    const multiStarts = state.selectedEls.map(me => ({el:me, l:parseInt(me.style.left)||0, t:parseInt(me.style.top)||0}))

    function mv(e) {
      const dx=(e.clientX-sx)/state.zoom, dy=(e.clientY-sy)/state.zoom
      if (!didMove && Math.abs(dx)<3 && Math.abs(dy)<3) return
      didMove = true; el.style.cursor='grabbing'
      let nl=sl+dx, nt=st+dy
      if(state.gridOn){nl=getSnapped(nl);nt=getSnapped(nt)}
      el.style.left=Math.max(0,nl)+'px'; el.style.top=Math.max(0,nt)+'px'
      multiStarts.forEach(ms=>{
        let ml=ms.l+dx,mt=ms.t+dy
        if(state.gridOn){ml=getSnapped(ml);mt=getSnapped(mt)}
        ms.el.style.left=Math.max(0,ml)+'px'; ms.el.style.top=Math.max(0,mt)+'px'
      })
      updateLockPosition()
    }
    function up() {
      isDragging=false; el.style.cursor='move'
      if(didMove) saveHistory()
      window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up)
    }
    window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up)
  })

  // Double-click to edit text
  if (el.classList.contains('text-bubble') || el.classList.contains('plain-text-block')) {
    el.addEventListener('dblclick', e => {
      if (el.classList.contains('locked')) return
      e.stopPropagation()
      el.classList.add('editing')
      const td = el.querySelector('.bubble-text-content')
      if (!td) return
      td.contentEditable = 'true'; td.focus()
      if (document.caretRangeFromPoint) {
        const r=document.caretRangeFromPoint(e.clientX,e.clientY)
        if(r){const s=window.getSelection();s.removeAllRanges();s.addRange(r)}
      }
    })
    el.addEventListener('focusout', e => {
      if (el.contains(e.relatedTarget)) return
      el.classList.remove('editing')
      const td = el.querySelector('.bubble-text-content')
      if (td) td.contentEditable = 'false'
      saveHistory()
    })
  }

  el.addEventListener('contextmenu', e => {
    e.preventDefault(); selectEl(el); showContextMenu(e.clientX, e.clientY)
  })
}

/* Keep lock button alive — handle mouseleave from lock btn */
document.addEventListener('mouseleave', e => {
  if (e.target === _lockBtn) {
    // If going back to the target element, do nothing — el's mouseenter will handle it
    const goingTo = e.relatedTarget
    if (_lockTarget && _lockTarget.contains(goingTo)) return
    // Going somewhere else — hide after short delay to allow click
    setTimeout(() => {
      if (_lockTarget && !_lockTarget.matches(':hover') && !_lockTarget.classList.contains('selected') && !_lockTarget.classList.contains('locked')) {
        hideLock()
      }
    }, 120)
  }
}, true)

/* ─── CANVAS CLICK → DESELECT ────────── */
container.addEventListener('mousedown', e => {
  if (e.target === container || e.target.id === 'marquee') {
    deselectAll(); hideLock()
  }
})
document.addEventListener('click', e => {
  if (!contextMenu.contains(e.target)) contextMenu.classList.remove('visible')
})

/* ─── BUBBLE / TAIL TOGGLES ──────────── */
document.querySelectorAll('.bubble-style-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.bubble-style-btn').forEach(b=>b.classList.remove('active'))
    btn.classList.add('active'); state.currentBubbleStyle=btn.dataset.style
    if (state.selectedEl?.classList.contains('text-bubble')) {
      state.selectedEl.dataset.bubbleStyle=btn.dataset.style
      updateBubbleSVG(state.selectedEl); saveHistory()
    }
  }
})


/* ─── PROPERTY HANDLERS ──────────────── */
document.getElementById('closePropPanel').onclick = () => propPanel.classList.remove('visible')

document.getElementById('propOpacity').oninput = function() {
  if (!state.selectedEl) return
  state.selectedEl.style.opacity = this.value/100
  document.getElementById('propOpacityVal').textContent = this.value+'%'
}
document.getElementById('propBgColor').oninput = function() {
  if (!state.selectedEl?.classList.contains('text-bubble')) return
  state.selectedEl.dataset.fillColor=this.value; updateBubbleSVG(state.selectedEl)
}
document.getElementById('propBorderColor').oninput = function() {
  if (!state.selectedEl?.classList.contains('text-bubble')) return
  state.selectedEl.dataset.strokeColor=this.value; updateBubbleSVG(state.selectedEl); saveHistory()
}
document.getElementById('propTextColor').oninput = function() {
  if (!state.selectedEl) return
  const td=state.selectedEl.querySelector('.bubble-text-content'); if(td) td.style.color=this.value
}
document.getElementById('propFontSize').onchange = function() {
  if (!state.selectedEl) return
  const td=state.selectedEl.querySelector('.bubble-text-content'); if(td){td.style.fontSize=this.value;saveHistory()}
}
document.getElementById('propFontWeight').onchange = function() {
  if (!state.selectedEl) return
  const td=state.selectedEl.querySelector('.bubble-text-content'); if(td){td.style.fontWeight=this.value;saveHistory()}
}

document.getElementById('propPanelBgColor').oninput = function() {
  if (!state.selectedEl?.classList.contains('panel-block')) return
  state.selectedEl.dataset.panelBg = this.value
  state.selectedEl.style.background = this.value
}
document.getElementById('propPanelBorderColor').oninput = function() {
  if (!state.selectedEl?.classList.contains('panel-block')) return
  state.selectedEl.dataset.panelBorder = this.value
  state.selectedEl.style.borderColor = this.value
  saveHistory()
}
document.querySelectorAll('.font-btn').forEach(btn => {
  btn.onclick = () => {
    document.querySelectorAll('.font-btn').forEach(b=>b.classList.remove('active'))
    btn.classList.add('active')
    if (!state.selectedEl) return
    const td=state.selectedEl.querySelector('.bubble-text-content')
    if(td) td.style.fontFamily=`'${btn.dataset.font}',sans-serif`
    state.selectedEl.dataset.fontFamily=btn.dataset.font
    saveHistory()
  }
})

/* ─── ADD TEXT (plain) ───────────────── */
document.getElementById('addText').onclick = () => {
  removePlaceholder(); saveHistory()
  const el = document.createElement('div')
  el.className = 'plain-text-block'
  el.dataset.fontFamily = 'DM Sans'
  el.style.cssText = `top:80px;left:80px;width:160px;height:40px;z-index:${++state.zCounter}`

  const td = document.createElement('div')
  td.className = 'bubble-text-content'
  td.innerText = 'Texte…'
  td.style.cssText = "font-family:'DM Sans',sans-serif;font-size:16px;color:#1a1a1a;outline:none;"
  el.appendChild(td)

  addResizeHandles(el)
  makeInteractive(el)
  container.appendChild(el)
  selectEl(el); showLockFor(el)
  setTimeout(() => {
    el.classList.add('editing'); td.contentEditable='true'; td.focus()
    document.execCommand('selectAll',false,null)
  }, 50)
}

/* ─── ADD BUBBLE ─────────────────────── */
document.getElementById('addBubble').onclick = () => {
  removePlaceholder(); saveHistory()
  const el = document.createElement('div')
  el.className = 'text-bubble'
  el.dataset.bubbleStyle = state.currentBubbleStyle||'round'
  el.dataset.fillColor   = '#ffffff'
  el.dataset.strokeColor = '#1a1a1a'
  el.dataset.fontFamily  = 'DM Sans'
  el.style.cssText = `top:80px;left:80px;width:180px;height:100px;z-index:${++state.zCounter}`

  const td = document.createElement('div')
  td.className = 'bubble-text-content'
  td.innerText = 'Texte…'
  td.style.cssText = "font-family:'DM Sans',sans-serif;font-size:14px;color:#1a1a1a;outline:none;width:100%;"
  el.appendChild(td)

  updateBubbleSVG(el)
  addResizeHandles(el)
  makeInteractive(el)
  container.appendChild(el)
  selectEl(el); showLockFor(el)
  setTimeout(() => {
    el.classList.add('editing'); td.contentEditable='true'; td.focus()
    document.execCommand('selectAll',false,null)
  }, 50)
}

/* ─── ADD IMAGE ──────────────────────── */
document.getElementById('addImage').onclick = () => document.getElementById('imageInput').click()
document.getElementById('imageInput').onchange = async e => {
  const file=e.target.files[0]; if(!file) return; e.target.value=''
  removePlaceholder(); saveHistory()

  function createImageEl(src) {
    const el=document.createElement('div')
    el.className='image-block'
    el.style.cssText=`width:220px;height:220px;top:80px;left:80px;z-index:${++state.zCounter}`
    const img=document.createElement('img'); img.src=src; img.draggable=false
    el.appendChild(img)
    addResizeHandles(el)
    makeInteractive(el)
    container.appendChild(el)
    selectEl(el); showLockFor(el)
  }

  // Try Supabase upload first (stores URL, not base64 — much lighter)
  if (supabase) {
    showToast('Upload en cours…', 3000)
    const url = await uploadImageToSupabase(file)
    if (url) { createImageEl(url); showToast('Image importée ✓'); return }
  }
  // Fallback: local base64
  const reader=new FileReader()
  reader.onload = ev => { createImageEl(ev.target.result); showToast('Image importée (local)') }
  reader.readAsDataURL(file)
}

/* ─── ADD PANEL ──────────────────────── */
document.getElementById('addPanel').onclick = () => {
  removePlaceholder(); saveHistory()
  const el=document.createElement('div')
  el.className='panel-block'
  el.style.cssText='width:280px;height:200px;top:80px;left:80px;z-index:1'
  container.querySelectorAll('.text-bubble,.image-block,.plain-text-block').forEach(e=>{
    e.style.zIndex=(parseInt(e.style.zIndex)||10)+1
  })
  addResizeHandles(el)
  makeInteractive(el)
  container.appendChild(el)
  selectEl(el); showLockFor(el)
  showToast('Panneau ajouté en arrière-plan')
}

/* ─── MARQUEE SELECTION ──────────────── */
const marquee = document.createElement('div')
marquee.id = 'marquee'
container.appendChild(marquee)

container.addEventListener('mousedown', e => {
  if (e.button !== 0) return
  if (e.target !== container && e.target.id !== 'marquee') return
  // pure canvas click
  let mActive=false
  const canR=container.getBoundingClientRect()
  const msx=(e.clientX-canR.left)/state.zoom, msy=(e.clientY-canR.top)/state.zoom
  marquee.style.cssText=`left:${msx}px;top:${msy}px;width:0;height:0;display:none`

  function mv(e) {
    const cx=(e.clientX-canR.left)/state.zoom, cy=(e.clientY-canR.top)/state.zoom
    const w=Math.abs(cx-msx), h=Math.abs(cy-msy)
    if(!mActive && (w>5||h>5)) { mActive=true; deselectAll(); hideLock(); marquee.style.display='block' }
    if(!mActive) return
    marquee.style.left=Math.min(msx,cx)+'px'; marquee.style.top=Math.min(msy,cy)+'px'
    marquee.style.width=w+'px'; marquee.style.height=h+'px'
  }
  function up() {
    if(mActive) {
      const mR=marquee.getBoundingClientRect(); marquee.style.display='none'
      const hit=[]
      container.querySelectorAll('.text-bubble,.image-block,.panel-block,.plain-text-block').forEach(el=>{
        const r=el.getBoundingClientRect()
        if(r.left<mR.right && r.right>mR.left && r.top<mR.bottom && r.bottom>mR.top) hit.push(el)
      })
      if(hit.length===1) { selectEl(hit[0]); showLockFor(hit[0]) }
      else if(hit.length>1) { hit.forEach(el=>selectEl(el,true)); showToast(hit.length+' éléments sélectionnés') }
    }
    marquee.style.display='none'
    window.removeEventListener('mousemove',mv); window.removeEventListener('mouseup',up)
  }
  window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up)
})

/* ─── CONTEXT MENU ───────────────────── */
function showContextMenu(x,y) { contextMenu.style.left=x+'px'; contextMenu.style.top=y+'px'; contextMenu.classList.add('visible') }

document.querySelectorAll('.ctx-item').forEach(item => {
  item.onclick = () => {
    const a=item.dataset.action
    if(a==='delete' && state.selectedEl){ saveHistory(); state.selectedEl.remove(); deselectAll(); hideLock() }
    if(a==='bringFront') bringToFront()
    if(a==='sendBack') sendToBack()
    if(a==='duplicate' && state.selectedEl) duplicateEl(state.selectedEl)
    contextMenu.classList.remove('visible')
  }
})

function duplicateEl(el) {
  saveHistory()
  const clone=el.cloneNode(true)
  // Remove any internal lock buttons from clone
  clone.querySelectorAll('.el-lock-float').forEach(b=>b.remove())
  clone.style.left=(parseInt(el.style.left)+20)+'px'
  clone.style.top=(parseInt(el.style.top)+20)+'px'
  clone.style.zIndex=++state.zCounter
  container.appendChild(clone)
  makeInteractive(clone)
  selectEl(clone); showLockFor(clone)
  showToast('Dupliqué')
}

/* ─── CANVAS HEIGHT RESIZE ───────────── */
const canvasResizeHandle=document.createElement('div')
canvasResizeHandle.className='canvas-resize-handle'; canvasResizeHandle.title='Étirer la page'
container.appendChild(canvasResizeHandle)
const canvasHeightLabel=document.createElement('div')
canvasHeightLabel.className='canvas-height-label'
container.appendChild(canvasHeightLabel)
canvasResizeHandle.addEventListener('mousedown', e => {
  e.preventDefault(); e.stopPropagation()
  const sy=e.clientY, sh=container.offsetHeight
  canvasHeightLabel.classList.add('visible')
  function mv(e){const nh=Math.max(400,sh+(e.clientY-sy)/state.zoom);container.style.height=nh+'px';canvasHeightLabel.textContent=Math.round(nh)+'px'}
  function up(){canvasHeightLabel.classList.remove('visible');saveHistory();window.removeEventListener('mousemove',mv);window.removeEventListener('mouseup',up)}
  window.addEventListener('mousemove',mv); window.addEventListener('mouseup',up)
})

/* ─── DELETE ─────────────────────────── */
document.getElementById('deleteBtn').onclick = () => {
  const targets=state.selectedEls.length?[...state.selectedEls]:state.selectedEl?[state.selectedEl]:[]
  if(!targets.length){showToast('Sélectionne un élément');return}
  saveHistory(); targets.forEach(el=>el.remove()); deselectAll(); hideLock(); showToast('Supprimé')
}

/* ─── UNDO / REDO ────────────────────── */
document.getElementById('undoBtn').onclick = undo
document.getElementById('redoBtn').onclick = redo

function undo() {
  if(!state.history.length){showToast('Rien à annuler');return}
  state.future.push(container.innerHTML); container.innerHTML=state.history.pop()
  rebindElements(); deselectAll(); hideLock(); showToast('Annulé')
}
function redo() {
  if(!state.future.length){showToast('Rien à refaire');return}
  state.history.push(container.innerHTML); container.innerHTML=state.future.pop()
  rebindElements(); deselectAll(); hideLock(); showToast('Refait')
}
function rebindElements() {
  container.querySelectorAll('.text-bubble,.image-block,.panel-block,.plain-text-block').forEach(el=>makeInteractive(el))
  container.querySelectorAll('.el-lock-float').forEach(b=>b.remove())
  if(!container.querySelector('#marquee')) container.appendChild(marquee)
  if(!container.querySelector('.canvas-resize-handle')) container.appendChild(canvasResizeHandle)
  if(!container.querySelector('.canvas-height-label')) container.appendChild(canvasHeightLabel)
}

/* ─── KEYBOARD ───────────────────────── */
document.addEventListener('keydown', e => {
  const tag=document.activeElement.tagName.toLowerCase()
  const editing=['input','textarea','select'].includes(tag)||document.activeElement.isContentEditable
  if(e.ctrlKey&&e.key==='z'&&!e.shiftKey){e.preventDefault();undo()}
  if(e.ctrlKey&&(e.key==='y'||(e.key==='z'&&e.shiftKey))){e.preventDefault();redo()}
  if((e.key==='Delete'||e.key==='Backspace')&&!editing){
    const t=state.selectedEls.length?[...state.selectedEls]:state.selectedEl?[state.selectedEl]:[]
    if(t.length){saveHistory();t.forEach(el=>el.remove());deselectAll();hideLock()}
  }
  if(e.key==='Escape'){deselectAll();hideLock()}
  if(e.ctrlKey&&e.key==='d'&&!editing){e.preventDefault();if(state.selectedEl)duplicateEl(state.selectedEl)}
})

/* ─── ZOOM ───────────────────────────── */
function setZoom(v) {
  state.zoom=Math.min(2,Math.max(0.25,v))
  canvasWrapper.style.transform=`scale(${state.zoom})`
  document.getElementById('zoomValue').textContent=Math.round(state.zoom*100)+'%'
}
document.getElementById('zoomIn').onclick  = () => setZoom(state.zoom+0.1)
document.getElementById('zoomOut').onclick = () => setZoom(state.zoom-0.1)
document.addEventListener('wheel', e=>{if(e.ctrlKey){e.preventDefault();setZoom(state.zoom+(e.deltaY<0?.05:-.05))}},{passive:false})

/* ─── GRID ───────────────────────────── */
document.getElementById('toggleGrid').onclick = function() {
  state.gridOn=!state.gridOn; container.classList.toggle('grid-on',state.gridOn)
  this.classList.toggle('active',state.gridOn); showToast(state.gridOn?'Grille activée':'Grille désactivée')
}

/* ─── EXPORT PNG ─────────────────────── */
document.getElementById('exportPNG').onclick = async () => {
  deselectAll(); hideLock(); showToast('Export en cours…',3000)
  try {
    const c=await html2canvas(container,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false})
    const a=document.createElement('a'); a.download=`webtoon_p${state.currentPage}_${Date.now()}.png`
    a.href=c.toDataURL('image/png'); a.click(); showToast('PNG exporté ✓')
  } catch(err){console.error(err);showToast('Erreur export PNG')}
}

/* ─── EXPORT PDF ─────────────────────── */
document.getElementById('exportPDF').onclick = async () => {
  deselectAll(); hideLock(); showToast('Export PDF…',3000)
  try {
    const c=await html2canvas(container,{scale:2,backgroundColor:'#ffffff',useCORS:true,logging:false})
    const{jsPDF}=window.jspdf
    const pdf=new jsPDF({orientation:c.width>c.height?'landscape':'portrait',unit:'px',format:[c.width/2,c.height/2]})
    pdf.addImage(c.toDataURL('image/jpeg',.95),'JPEG',0,0,c.width/2,c.height/2)
    pdf.save(`webtoon_p${state.currentPage}_${Date.now()}.pdf`); showToast('PDF exporté ✓')
  } catch(err){console.error(err);showToast('Erreur export PDF')}
}

/* ─── PAGES ──────────────────────────── */
function switchToPage(n) {
  if(n===state.currentPage) return
  state.pages[state.currentPage]=container.innerHTML
  document.querySelectorAll('.page-btn[data-page]').forEach(b=>b.classList.toggle('active',parseInt(b.dataset.page)===n))
  state.currentPage=n; container.innerHTML=state.pages[n]||''
  rebindElements(); deselectAll(); hideLock()
  if(!container.querySelector('.text-bubble,.image-block,.panel-block,.plain-text-block')) {
    const ph=document.createElement('div'); ph.className='canvas-placeholder'
    ph.innerHTML=`<svg viewBox="0 0 80 80" fill="none"><rect x="10" y="10" width="60" height="60" rx="4" stroke="#ddd" stroke-width="2" stroke-dasharray="6 4"/></svg><p>Page ${n} — vide</p>`
    container.appendChild(ph)
  }
  showToast('Page '+n)
}
document.querySelector('.page-btn[data-page="1"]').onclick = () => switchToPage(1)
document.getElementById('addPage').onclick = () => {
  state.pages[state.currentPage]=container.innerHTML
  const n=document.querySelectorAll('.page-btn[data-page]').length+1
  const btn=document.createElement('button'); btn.className='page-btn'; btn.dataset.page=n; btn.textContent='P.'+n
  btn.onclick=()=>switchToPage(n)
  document.getElementById('addPage').before(btn); switchToPage(n)
}

/* ─── SUPABASE STATUS ────────────────── */
// Supabase init — runs after DOM ready
initSupabase()
loadPagesFromSupabase()

/* ─── INIT ───────────────────────────── */
state.pages[1]=container.innerHTML
saveHistory()
showToast('Webtoon Studio prêt ✦', 2500)
