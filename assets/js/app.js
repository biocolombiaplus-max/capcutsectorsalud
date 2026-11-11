/* =========================================================
   CapCut Salud Pro — lógica de la landing + panel admin
   ========================================================= */
(() => {
  'use strict';

  const ADMIN_KEY = '123456';           // Clave del administrador
  const DB_NAME = 'capcut-salud-pro';
  const STORE = 'kv';
  const LOCAL_KEY = 'contenido';

  /* ---------- Contenido por defecto ---------- */
  const DEFAULTS = {
    config: {
      whatsapp: '573000000000',
      instagram: '',
      ciudad: 'Cúcuta',
      lugar: 'Lugar por confirmar · Cúcuta',
      fechaTexto: 'Sábado 28 de noviembre',
      horario: '2:00 p.m. – 6:00 p.m.',
      fechaInicio: '2026-11-28T14:00',
      cuposTotales: 30,
      cuposDisponibles: 12
    },
    instructora: {
      nombre: 'Diany Amaya',
      rol: 'Estratega de marketing digital y creación de contenido para el sector salud',
      bio: 'Diany acompaña a profesionales e instituciones de salud a comunicar su valor en redes sociales con contenido claro, cercano y ético.\nEn este taller te enseña, paso a paso y desde tu celular, a crear videos que generan confianza y atraen pacientes a tu consulta.',
      logros: 'Marketing digital enfocado en el sector salud\nMétodo práctico: aprendes haciendo, desde tu celular\nComunicación ética y responsable para profesionales de la salud',
      foto: ''
    },
    precios: {
      individual: 198000,
      equipo: 168000,
      equipoMin: 3,
      clinica: 148000,
      clinicaMin: 5
    },
    galeria: [],      // [{ src, titulo }]
    testimonios: []   // [{ nombre, profesion, texto, foto }]
  };

  let state = clone(DEFAULTS);

  /* ---------- Utilidades ---------- */
  function clone(o) { return JSON.parse(JSON.stringify(o)); }
  function merge(base, extra) {
    if (!extra || typeof extra !== 'object') return base;
    for (const k of Object.keys(extra)) {
      const v = extra[k];
      if (v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' && !Array.isArray(base[k])) {
        merge(base[k], v);
      } else if (v !== undefined) {
        base[k] = v;
      }
    }
    return base;
  }
  const get = (obj, path) => path.split('.').reduce((o, k) => (o == null ? o : o[k]), obj);
  const set = (obj, path, val) => {
    const keys = path.split('.'); const last = keys.pop();
    const target = keys.reduce((o, k) => (o[k] = o[k] || {}), obj);
    target[last] = val;
  };
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => Array.from(r.querySelectorAll(s));
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cop = (n) => '$' + Math.round(Number(n) || 0).toLocaleString('es-CO').replace(/,/g, '.');
  const initials = (name) => (name || '').split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join('') || '★';

  /* ---------- IndexedDB (fotos pesan más que localStorage) ---------- */
  function openDB() {
    return new Promise((resolve, reject) => {
      if (!('indexedDB' in window)) return reject(new Error('sin IndexedDB'));
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => req.result.createObjectStore(STORE);
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => reject(req.error);
    });
  }
  async function dbGet(key) {
    try {
      const db = await openDB();
      return await new Promise((res, rej) => {
        const r = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error);
      });
    } catch { return undefined; }
  }
  async function dbSet(key, val) {
    const db = await openDB();
    return new Promise((res, rej) => {
      const tx = db.transaction(STORE, 'readwrite');
      tx.objectStore(STORE).put(val, key);
      tx.oncomplete = () => res(); tx.onerror = () => rej(tx.error);
    });
  }
  async function dbDel(key) {
    try {
      const db = await openDB();
      return await new Promise((res) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).delete(key);
        tx.oncomplete = () => res(); tx.onerror = () => res();
      });
    } catch { /* nada */ }
  }

  /* ---------- Carga de contenido ---------- */
  async function loadContent() {
    let published = null;
    try {
      const r = await fetch('data/contenido.json', { cache: 'no-store' });
      if (r.ok) published = await r.json();
    } catch { /* abierto como archivo local o sin json: usa valores por defecto */ }
    const local = await dbGet(LOCAL_KEY);
    state = merge(merge(clone(DEFAULTS), published), local);
  }

  /* ---------- Render ---------- */
  function waLink(text) {
    const num = String(state.config.whatsapp || '').replace(/\D/g, '');
    return `https://wa.me/${num}?text=${encodeURIComponent(text)}`;
  }

  function render() {
    // textos simples
    $$('[data-bind]').forEach(el => {
      const v = get(state, el.dataset.bind);
      if (v !== undefined && v !== null && v !== '') el.textContent = v;
    });
    // precios
    const p = state.precios;
    $$('[data-price]').forEach(el => { el.textContent = cop(p[el.dataset.price]); });
    $$('[data-save]').forEach(el => {
      const plan = el.dataset.save;
      const pct = p.individual ? Math.round((1 - p[plan] / p.individual) * 100) : 0;
      el.textContent = pct > 0 ? `Ahorra ${pct}%` : '';
      el.hidden = pct <= 0;
    });

    // cupos
    const tot = Number(state.config.cuposTotales) || 1;
    const disp = Math.max(0, Math.min(tot, Number(state.config.cuposDisponibles) || 0));
    const fill = $('#seatsFill');
    if (fill) fill.style.width = `${Math.round(((tot - disp) / tot) * 100)}%`;

    // instructora
    const ins = state.instructora;
    const img = $('#instrFoto'), ph = $('#instrPlaceholder');
    if (ins.foto) { img.src = ins.foto; img.alt = `Foto de ${ins.nombre}`; img.hidden = false; ph.hidden = true; }
    else { img.hidden = true; ph.hidden = false; ph.querySelector('span').textContent = initials(ins.nombre); }
    $('#instrBio').innerHTML = String(ins.bio || '').split('\n').filter(s => s.trim()).map(s => `<p>${esc(s)}</p>`).join('');
    $('#instrLogros').innerHTML = String(ins.logros || '').split('\n').filter(s => s.trim()).map(s => `<li>${esc(s)}</li>`).join('');

    // galería
    const gal = state.galeria || [];
    $('#galeria').hidden = gal.length === 0;
    $('#gallery').innerHTML = gal.map((g, i) => `
      <figure data-idx="${i}">
        <img src="${esc(g.src)}" alt="${esc(g.titulo || 'Foto de un taller anterior')}" loading="lazy">
        ${g.titulo ? `<figcaption>${esc(g.titulo)}</figcaption>` : ''}
      </figure>`).join('');

    // testimonios
    const ts = (state.testimonios || []).filter(t => t.texto && t.texto.trim());
    $('#testimonios').hidden = ts.length === 0;
    $('#testiGrid').innerHTML = ts.map(t => `
      <article class="testi reveal is-visible">
        <div class="testi__stars">★★★★★</div>
        <p class="testi__text">“${esc(t.texto)}”</p>
        <div class="testi__who">
          ${t.foto ? `<img class="testi__avatar" src="${esc(t.foto)}" alt="">` : `<span class="testi__avatar">${esc(initials(t.nombre))}</span>`}
          <div><strong>${esc(t.nombre || 'Asistente')}</strong><small>${esc(t.profesion || '')}</small></div>
        </div>
      </article>`).join('');

    // enlaces
    const msg = `Hola 👋 quiero información del curso de CapCut para el sector salud (${state.config.fechaTexto}, ${state.config.ciudad}).`;
    $('#waFloat').href = waLink(msg);
    $('#waFooter').href = waLink(msg);
    const ig = String(state.config.instagram || '').trim();
    const igEl = $('#igFooter');
    if (ig) { igEl.hidden = false; igEl.href = /^https?:/.test(ig) ? ig : `https://instagram.com/${ig.replace(/^@/, '')}`; }
    else igEl.hidden = true;

    updateTotal();
    observeReveals();
  }

  /* ---------- Cuenta regresiva ---------- */
  let cdTimer;
  function startCountdown() {
    clearInterval(cdTimer);
    const target = new Date(`${state.config.fechaInicio}:00-05:00`).getTime(); // hora Colombia
    const box = $('#countdown');
    const tick = () => {
      const diff = target - Date.now();
      if (isNaN(target)) { box.hidden = true; return; }
      if (diff <= 0) {
        box.querySelector('.countdown__label').textContent = '¡El taller ya comenzó!';
        $$('[data-cd]').forEach(e => (e.textContent = '00'));
        clearInterval(cdTimer); return;
      }
      box.hidden = false;
      const d = Math.floor(diff / 864e5), h = Math.floor(diff / 36e5) % 24, m = Math.floor(diff / 6e4) % 60, s = Math.floor(diff / 1e3) % 60;
      const v = { d, h, m, s };
      $$('[data-cd]').forEach(e => (e.textContent = String(v[e.dataset.cd]).padStart(2, '0')));
    };
    tick(); cdTimer = setInterval(tick, 1000);
  }

  /* ---------- Formulario ---------- */
  const planSelect = $('#planSelect');
  const personasInput = $('#personasInput');

  function planFromCount(n) {
    const p = state.precios;
    if (n >= p.clinicaMin) return 'Clínica / IPS';
    if (n >= p.equipoMin) return 'Equipo Pro';
    return 'Individual';
  }
  function minFor(plan) {
    const p = state.precios;
    return plan === 'Clínica / IPS' ? p.clinicaMin : plan === 'Equipo Pro' ? p.equipoMin : 1;
  }
  function priceFor(plan) {
    const p = state.precios;
    return plan === 'Clínica / IPS' ? p.clinica : plan === 'Equipo Pro' ? p.equipo : p.individual;
  }
  function updateTotal() {
    const plan = planSelect.value;
    const n = Math.max(1, parseInt(personasInput.value, 10) || 1);
    $('#totalEstimado').textContent = cop(priceFor(plan) * n);
    const hint = $('#planHint');
    if (plan === 'Individual') hint.textContent = `¿Vienes con colegas? Desde ${state.precios.equipoMin} personas pagan ${cop(state.precios.equipo)} c/u.`;
    else hint.textContent = `${n} personas × ${cop(priceFor(plan))} c/u`;
  }
  planSelect.addEventListener('change', () => {
    const min = minFor(planSelect.value);
    if ((parseInt(personasInput.value, 10) || 1) < min || planSelect.value === 'Individual') personasInput.value = planSelect.value === 'Individual' ? 1 : min;
    updateTotal();
  });
  personasInput.addEventListener('input', () => {
    const n = Math.max(1, parseInt(personasInput.value, 10) || 1);
    planSelect.value = planFromCount(n);
    updateTotal();
  });
  $$('[data-plan]').forEach(a => a.addEventListener('click', () => {
    planSelect.value = a.dataset.plan;
    planSelect.dispatchEvent(new Event('change'));
  }));

  $('#form').addEventListener('submit', (e) => {
    e.preventDefault();
    const f = e.target;
    let ok = true;
    ['nombre', 'profesion', 'celular'].forEach(n => {
      const el = f.elements[n];
      const bad = !el.value.trim();
      el.classList.toggle('is-invalid', bad);
      if (bad) ok = false;
    });
    if (!ok) { f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake'); return; }
    const plan = planSelect.value;
    const n = Math.max(1, parseInt(personasInput.value, 10) || 1);
    const text =
`Hola 👋 quiero reservar mi cupo en el *Curso de CapCut para el Sector Salud*.

👤 Nombre: ${f.elements.nombre.value.trim()}
🩺 Profesión: ${f.elements.profesion.value}
📱 Celular: ${f.elements.celular.value.trim()}
🎟️ Plan: ${plan} · ${n} persona(s)
💰 Total estimado: ${cop(priceFor(plan) * n)}

📅 ${state.config.fechaTexto} · ${state.config.horario} · ${state.config.ciudad}`;
    window.open(waLink(text), '_blank', 'noopener');
  });

  /* ---------- Navegación ---------- */
  const nav = $('#nav');
  const onScroll = () => nav.classList.toggle('is-scrolled', window.scrollY > 10);
  window.addEventListener('scroll', onScroll, { passive: true }); onScroll();
  $('#burger').addEventListener('click', () => {
    const open = nav.classList.toggle('is-open');
    $('#burger').setAttribute('aria-expanded', open);
  });
  $$('#navLinks a').forEach(a => a.addEventListener('click', () => nav.classList.remove('is-open')));
  $('#year').textContent = new Date().getFullYear();

  /* ---------- Animaciones al hacer scroll ---------- */
  let io;
  function observeReveals() {
    if (!('IntersectionObserver' in window)) { $$('.reveal').forEach(e => e.classList.add('is-visible')); return; }
    io = io || new IntersectionObserver((entries) => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('is-visible'); io.unobserve(en.target); } });
    }, { threshold: .12, rootMargin: '0px 0px -40px 0px' });
    $$('.reveal:not(.is-visible)').forEach(e => io.observe(e));
  }

  /* ---------- Lightbox ---------- */
  const lb = $('#lightbox');
  $('#gallery').addEventListener('click', (e) => {
    const fig = e.target.closest('figure'); if (!fig) return;
    const g = state.galeria[+fig.dataset.idx];
    lb.querySelector('img').src = g.src;
    lb.querySelector('figcaption').textContent = g.titulo || '';
    lb.hidden = false;
  });
  lb.addEventListener('click', (e) => { if (e.target === lb || e.target.closest('.lightbox__close')) lb.hidden = true; });

  /* =========================================================
     ADMINISTRADOR
     ========================================================= */
  const loginModal = $('#loginModal');
  const adminModal = $('#adminModal');

  function openAdmin() {
    if (sessionStorage.getItem('csp-admin') === '1') return showAdmin();
    loginModal.hidden = false;
    $('#loginErr').hidden = true;
    $('#adminPass').value = '';
    setTimeout(() => $('#adminPass').focus(), 50);
  }
  $('#openAdmin').addEventListener('click', openAdmin);
  if (location.hash === '#admin') openAdmin();
  window.addEventListener('hashchange', () => { if (location.hash === '#admin') openAdmin(); });

  $('#loginForm').addEventListener('submit', (e) => {
    e.preventDefault();
    if ($('#adminPass').value === ADMIN_KEY) {
      try { sessionStorage.setItem('csp-admin', '1'); } catch { /* nada */ }
      loginModal.hidden = true;
      showAdmin();
    } else {
      $('#loginErr').hidden = false;
      const box = loginModal.querySelector('.modal__box');
      box.classList.remove('shake'); void box.offsetWidth; box.classList.add('shake');
    }
  });

  $$('.modal [data-close]').forEach(b => b.addEventListener('click', () => {
    b.closest('.modal').hidden = true;
    if (location.hash === '#admin') history.replaceState(null, '', location.pathname);
  }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { loginModal.hidden = true; adminModal.hidden = true; lb.hidden = true; }
  });

  // Tabs
  $$('.admin__tabs button').forEach(btn => btn.addEventListener('click', () => {
    $$('.admin__tabs button').forEach(b => b.classList.toggle('is-active', b === btn));
    $$('.admin__pane').forEach(p => p.classList.toggle('is-active', p.dataset.pane === btn.dataset.tab));
  }));

  function showAdmin() {
    adminModal.hidden = false;
    fillAdmin();
  }

  function fillAdmin() {
    $$('[data-field]', adminModal).forEach(el => {
      const v = get(state, el.dataset.field);
      el.value = v ?? '';
    });
    renderAdmInstr();
    renderAdmGallery();
    renderAdmTestis();
  }

  // Campos simples → guardado automático
  $$('[data-field]', adminModal).forEach(el => el.addEventListener('input', () => {
    const v = el.type === 'number' ? Number(el.value) : el.value;
    set(state, el.dataset.field, v);
    scheduleSave();
    render();
    if (el.dataset.field === 'config.fechaInicio') startCountdown();
  }));

  let saveT;
  function scheduleSave() { clearTimeout(saveT); saveT = setTimeout(() => persist(false), 500); }
  async function persist(showMsg = true) {
    try {
      await dbSet(LOCAL_KEY, state);
      if (showMsg) toast('✓ Cambios guardados en este navegador');
    } catch (err) {
      toast('⚠️ No se pudo guardar (espacio lleno). Elimina fotos o descarga un respaldo.');
    }
  }
  $('#adminSave').addEventListener('click', () => { clearTimeout(saveT); persist(true); });

  let toastT;
  function toast(msg) {
    const t = $('#toast'); t.textContent = msg; t.hidden = false;
    clearTimeout(toastT); toastT = setTimeout(() => (t.hidden = true), 2600);
  }

  // Optimiza imágenes antes de guardarlas
  function readImage(file, maxSize = 1400, quality = .82) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => {
        const img = new Image();
        img.onload = () => {
          const scale = Math.min(1, maxSize / Math.max(img.width, img.height));
          const c = document.createElement('canvas');
          c.width = Math.round(img.width * scale); c.height = Math.round(img.height * scale);
          c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
          resolve(c.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = reader.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // Instructora
  function renderAdmInstr() {
    const box = $('#admInstrPreview');
    box.innerHTML = state.instructora.foto ? `<img src="${esc(state.instructora.foto)}" alt="">` : `<span>${esc(initials(state.instructora.nombre))}</span>`;
  }
  $('#admInstrFile').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    state.instructora.foto = await readImage(f, 1000);
    e.target.value = '';
    renderAdmInstr(); render(); persist(true);
  });
  $('#admInstrRemove').addEventListener('click', () => {
    state.instructora.foto = ''; renderAdmInstr(); render(); persist(true);
  });

  // Galería
  function renderAdmGallery() {
    const g = state.galeria;
    $('#admGallery').innerHTML = g.length ? g.map((it, i) => `
      <div class="adm-photo" data-i="${i}">
        <img src="${esc(it.src)}" alt="">
        <div>
          <input placeholder="Descripción (opcional)" value="${esc(it.titulo || '')}" data-cap>
          <div class="adm-photo__actions">
            <button type="button" data-move="-1" title="Mover antes">←</button>
            <button type="button" data-move="1" title="Mover después">→</button>
            <button type="button" class="del" data-del title="Eliminar">Eliminar</button>
          </div>
        </div>
      </div>`).join('') : '<p class="muted">Aún no hay fotos.</p>';
  }
  async function addGalleryFiles(files) {
    const list = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (!list.length) return;
    toast(`Procesando ${list.length} foto(s)…`);
    for (const f of list) {
      try { state.galeria.push({ src: await readImage(f), titulo: '' }); } catch { /* ignora archivo dañado */ }
    }
    renderAdmGallery(); render(); persist(true);
  }
  $('#admGalFiles').addEventListener('change', (e) => { addGalleryFiles(e.target.files); e.target.value = ''; });
  const dz = $('#dropzone');
  ['dragenter', 'dragover'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.add('is-over'); }));
  ['dragleave', 'drop'].forEach(ev => dz.addEventListener(ev, (e) => { e.preventDefault(); dz.classList.remove('is-over'); }));
  dz.addEventListener('drop', (e) => addGalleryFiles(e.dataTransfer.files));

  $('#admGallery').addEventListener('input', (e) => {
    if (!e.target.matches('[data-cap]')) return;
    const i = +e.target.closest('.adm-photo').dataset.i;
    state.galeria[i].titulo = e.target.value;
    render(); scheduleSave();
  });
  $('#admGallery').addEventListener('click', (e) => {
    const card = e.target.closest('.adm-photo'); if (!card) return;
    const i = +card.dataset.i;
    if (e.target.matches('[data-del]')) {
      if (!confirm('¿Eliminar esta foto?')) return;
      state.galeria.splice(i, 1);
    } else if (e.target.matches('[data-move]')) {
      const j = i + Number(e.target.dataset.move);
      if (j < 0 || j >= state.galeria.length) return;
      [state.galeria[i], state.galeria[j]] = [state.galeria[j], state.galeria[i]];
    } else return;
    renderAdmGallery(); render(); persist(false);
  });

  // Testimonios
  function renderAdmTestis() {
    const ts = state.testimonios;
    $('#admTestis').innerHTML = ts.length ? ts.map((t, i) => `
      <div class="adm-testi" data-i="${i}">
        <div class="adm-testi__top">
          <div class="admin__avatar">${t.foto ? `<img src="${esc(t.foto)}" alt="">` : esc(initials(t.nombre))}</div>
          <label class="btn btn--ghost btn--sm file-btn">Foto<input type="file" accept="image/*" data-tfoto hidden></label>
          <button type="button" class="btn btn--danger btn--sm" data-tdel>Eliminar</button>
        </div>
        <div class="grid2">
          <label>Nombre<input data-t="nombre" value="${esc(t.nombre)}"></label>
          <label>Profesión<input data-t="profesion" value="${esc(t.profesion)}"></label>
        </div>
        <label>Testimonio<textarea rows="3" data-t="texto">${esc(t.texto)}</textarea></label>
      </div>`).join('') : '<p class="muted">Aún no hay testimonios.</p>';
  }
  $('#admAddTesti').addEventListener('click', () => {
    state.testimonios.push({ nombre: '', profesion: '', texto: '', foto: '' });
    renderAdmTestis(); scheduleSave();
  });
  $('#admTestis').addEventListener('input', (e) => {
    const k = e.target.dataset.t; if (!k) return;
    const i = +e.target.closest('.adm-testi').dataset.i;
    state.testimonios[i][k] = e.target.value;
    render(); scheduleSave();
  });
  $('#admTestis').addEventListener('click', (e) => {
    if (!e.target.matches('[data-tdel]')) return;
    if (!confirm('¿Eliminar este testimonio?')) return;
    state.testimonios.splice(+e.target.closest('.adm-testi').dataset.i, 1);
    renderAdmTestis(); render(); persist(false);
  });
  $('#admTestis').addEventListener('change', async (e) => {
    if (!e.target.matches('[data-tfoto]')) return;
    const f = e.target.files[0]; if (!f) return;
    const i = +e.target.closest('.adm-testi').dataset.i;
    state.testimonios[i].foto = await readImage(f, 300);
    renderAdmTestis(); render(); persist(true);
  });

  // Publicar / respaldo
  $('#admExport').addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob); a.download = 'contenido.json';
    document.body.appendChild(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    toast('✓ Archivo descargado');
  });
  $('#admImport').addEventListener('change', async (e) => {
    const f = e.target.files[0]; if (!f) return;
    try {
      const data = JSON.parse(await f.text());
      state = merge(clone(DEFAULTS), data);
      await persist(false);
      fillAdmin(); render(); startCountdown();
      toast('✓ Respaldo importado');
    } catch { toast('⚠️ Archivo no válido'); }
    e.target.value = '';
  });
  $('#admReset').addEventListener('click', async () => {
    if (!confirm('Esto borra los cambios guardados en este navegador y vuelve al contenido publicado. ¿Continuar?')) return;
    await dbDel(LOCAL_KEY);
    await loadContent();
    fillAdmin(); render(); startCountdown();
    toast('Cambios locales descartados');
  });

  /* ---------- Inicio ---------- */
  render();          // pinta valores por defecto de inmediato
  startCountdown();
  loadContent().then(() => { render(); startCountdown(); });
})();
