'use strict';

// Interface hors rendu 3D. Fonctionne seule si WebGL est indisponible ;
// dialogue avec js/main.js par évènements (apex:progress, apex:intro, apex:modal, apex:engrave).
const APEX = (window.__apex = window.__apex || {});
const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
const FINE = window.matchMedia('(hover: hover) and (pointer: fine)').matches;

const PRODUCTS = {
  classique: { name: 'Le Classique', tag: 'Chef — Polyvalent', price: '35€', desc: 'La référence de la coutellerie numérique. Lame longue de chef en PLA+ haute résistance, profil de coupe idéal pour les cuisines du quotidien. Manche ergonomique noir avec grip texturé et rivets dorés.', material: 'PLA+', length: '21 cm', weight: '~90 g', delivery: '3-5 jours' },
  ombre:     { name: "L'Ombre",      tag: 'Tactique — Compact', price: '45€', desc: 'Un tactique compact au profil clip-point acéré. Lame en PETG noir mat ultra-résistant aux chocs. Manche ergonomique avec rainures anti-dérapantes.', material: 'PETG', length: '18 cm', weight: '~75 g', delivery: '3-5 jours' },
  dore:      { name: 'Le Doré',      tag: 'Décoratif — Collection', price: '60€', desc: "La pièce maîtresse. Entièrement imprimée en PLA Métallique doré, ornée de gravures géométriques. Livrée dans un écrin noir capitonné. Une œuvre d'art fonctionnelle.", material: 'PLA Métallique', length: '22 cm', weight: '~95 g', delivery: '3-5 jours' },
  santoku:   { name: 'Le Santoku',   tag: 'Chef — Style japonais', price: '40€', desc: "L'hommage au savoir-faire japonais. Lame santoku avec alvéoles anti-adhésion. Manche bois synthétique chaud avec insert décoratif doré.", material: 'PLA+', length: '19 cm', weight: '~85 g', delivery: '3-5 jours' },
  ranger:    { name: 'Le Ranger',    tag: 'Tactique — Survie', price: '55€', desc: 'Construit pour résister. Lame drop-point en ABS haute résistance. Scie intégrée sur le dos de la lame. Manche antidérapant avec grip profond.', material: 'ABS', length: '24 cm', weight: '~110 g', delivery: '3-5 jours' },
  custom:    { name: 'Sur Mesure',   tag: 'Personnalisé — Unique', price: 'dès 50€', desc: 'Votre vision, nos mains. Forme de lame, couleur du filament, texte gravé (prénom, date, initiales). Chaque pièce unique, conçue spécialement pour vous.', material: 'Au choix', length: 'Sur devis', weight: 'Variable', delivery: '5-7 jours' }
};

const $ = (s, root = document) => root.querySelector(s);
const $$ = (s, root = document) => Array.from(root.querySelectorAll(s));

// Pré-remplit le formulaire de contact puis y amène l'utilisateur.
function prefillContact(objet, message) {
  const select = $('#fobjet');
  const area = $('#fmsg');
  if (select) select.value = objet;
  if (area && message) area.value = message;
  const contact = $('#contact');
  if (contact) contact.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' });
  setTimeout(() => { if ($('#fname')) $('#fname').focus({ preventScroll: true }); }, REDUCED ? 0 : 900);
}

(function initLoader() {
  const loader = $('#loader');
  const hero = $('#hero');
  const reveal = () => {
    if (hero) hero.classList.add('is-in');
    APEX.introRequested = true;
    window.dispatchEvent(new Event('apex:intro'));
  };
  if (!loader) { reveal(); return; }

  const pct = $('#loader-pct');
  const label = $('#loader-label');
  const steps = [[0, "Calibrage de l'atelier"], [0.12, 'Modélisation des lames'], [0.54, 'Montage du studio lumière'], [0.76, 'Compilation des shaders'], [0.96, 'Mise au point']];
  const canModule = typeof HTMLScriptElement !== 'undefined' && HTMLScriptElement.supports && HTMLScriptElement.supports('importmap');
  const start = performance.now();
  const MIN = REDUCED ? 200 : 1500;
  const MAX = 10000;
  let target = APEX.progress || 0;
  let shown = 0;
  if (!canModule || APEX.failed) target = 1;

  window.addEventListener('apex:progress', (e) => {
    target = Math.max(target, e.detail.p);
  });
  document.documentElement.classList.add('is-loading');

  const tick = (now) => {
    const elapsed = now - start;
    if (elapsed > MAX) target = 1;
    shown += (target - shown) * (REDUCED ? 1 : 0.075);
    if (target - shown < 0.003) shown = target;
    loader.style.setProperty('--p', shown.toFixed(4));
    if (pct) pct.textContent = String(Math.round(shown * 100));
    if (label) {
      let text = steps[0][1];
      steps.forEach(([p, t]) => { if (shown >= p) text = t; });
      if (label.textContent !== text) label.textContent = text;
    }
    if (shown >= 1 && elapsed >= MIN) {
      loader.classList.add('is-done');
      loader.setAttribute('aria-busy', 'false');
      document.documentElement.classList.remove('is-loading');
      reveal();
      setTimeout(() => loader.remove(), 1200);
      return;
    }
    requestAnimationFrame(tick);
  };
  loader.setAttribute('aria-busy', 'true');
  requestAnimationFrame(tick);
})();

(function initCursor() {
  if (!FINE || REDUCED) return;
  const cursor = $('.cursor');
  if (!cursor) return;
  const dot = $('.cursor-dot', cursor);
  const ring = $('.cursor-ring', cursor);
  const label = $('.cursor-label', cursor);
  document.body.classList.add('has-cursor');
  let mx = -100, my = -100, rx = -100, ry = -100;
  window.addEventListener('pointermove', (e) => {
    mx = e.clientX;
    my = e.clientY;
    dot.style.transform = `translate3d(${mx}px, ${my}px, 0)`;
  }, { passive: true });
  document.addEventListener('pointerleave', () => cursor.classList.add('is-hidden'));
  document.addEventListener('pointerenter', () => cursor.classList.remove('is-hidden'));
  (function follow() {
    rx += (mx - rx) * 0.18;
    ry += (my - ry) * 0.18;
    ring.style.transform = `translate3d(${rx}px, ${ry}px, 0)`;
    requestAnimationFrame(follow);
  })();
  const labelled = { '.card-media': 'Voir 360°', '.modal-viewer': 'Glisser', '.atelier-stage': 'Gravure' };
  document.addEventListener('pointerover', (e) => {
    const t = e.target;
    let text = '';
    for (const sel in labelled) if (t.closest(sel)) text = labelled[sel];
    cursor.classList.toggle('is-label', !!text);
    if (text) label.textContent = text;
    cursor.classList.toggle('is-hover', !text && !!t.closest('a, button, input, textarea, select, label, [role="button"]'));
  });
})();

(function initScrollUi() {
  const bar = $('#scroll-progress');
  const navbar = $('#navbar');
  const forge = $('#processus');
  const steps = $$('.forge-step');
  const forgeBar = $('#forge-bar');
  const root = document.documentElement;
  let ticking = false;
  const update = () => {
    ticking = false;
    const max = root.scrollHeight - window.innerHeight;
    if (bar) bar.style.transform = `scaleX(${max > 0 ? window.scrollY / max : 0})`;
    if (navbar) navbar.classList.toggle('scrolled', window.scrollY > 40);
    // séquence de fabrication : étape active selon la progression du défilement
    if (forge && root.classList.contains('has-gl') && !root.classList.contains('no-webgl')) {
      const r = forge.getBoundingClientRect();
      const p = Math.min(1, Math.max(0, -r.top / Math.max(1, r.height - window.innerHeight)));
      const active = p < 0.26 ? 0 : p < 0.53 ? 1 : p < 0.77 ? 2 : 3;
      steps.forEach((s, i) => s.classList.toggle('is-active', i === active));
      if (forgeBar) forgeBar.style.transform = `scaleX(${p})`;
    }
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  window.addEventListener('resize', update, { passive: true });
  update();

  // lien de navigation de la section courante
  const links = $$('.nav-links a[href^="#"]:not(.nav-cta)');
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      links.forEach((l) => l.classList.toggle('is-current', l.getAttribute('href') === '#' + entry.target.id));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  links.forEach((l) => {
    const target = $(l.getAttribute('href'));
    if (target) io.observe(target);
  });
})();

(function initMobileMenu() {
  const toggle = $('#menu-toggle');
  const navLinks = $('#nav-links');
  if (!toggle || !navLinks) return;
  const set = (open) => {
    navLinks.classList.toggle('open', open);
    toggle.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
  };
  toggle.addEventListener('click', () => set(!navLinks.classList.contains('open')));
  $$('a', navLinks).forEach((link) => link.addEventListener('click', () => set(false)));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') set(false); });
})();

(function initReveal() {
  const els = $$('.reveal');
  // décalage en cascade pour les éléments frères (grilles)
  els.forEach((el) => {
    const siblings = Array.from(el.parentElement.children).filter((c) => c.classList.contains('reveal'));
    const i = siblings.indexOf(el);
    if (siblings.length > 1) el.style.setProperty('--delay', `${(i % 3) * 0.12}s`);
  });
  if (!('IntersectionObserver' in window)) { els.forEach((el) => el.classList.add('visible')); return; }
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('visible');
      io.unobserve(entry.target);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  els.forEach((el) => io.observe(el));
})();

(function initCounters() {
  const els = $$('[data-count]');
  if (REDUCED || !('IntersectionObserver' in window)) return;
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      const el = entry.target;
      const target = parseInt(el.getAttribute('data-count'), 10);
      const start = performance.now();
      (function tick(now) {
        const p = Math.min((now - start) / 1600, 1);
        el.textContent = String(Math.round((1 - Math.pow(1 - p, 3)) * target));
        if (p < 1) requestAnimationFrame(tick);
      })(start);
      io.unobserve(el);
    });
  }, { threshold: 0.6 });
  els.forEach((el) => { el.textContent = '0'; io.observe(el); });
})();

(function initMagnetic() {
  if (!FINE || REDUCED) return;
  $$('.btn-magnetic').forEach((btn) => {
    const inner = btn.querySelector('span');
    btn.addEventListener('pointermove', (e) => {
      const r = btn.getBoundingClientRect();
      const dx = e.clientX - r.left - r.width / 2;
      const dy = e.clientY - r.top - r.height / 2;
      btn.style.transform = `translate(${dx * 0.22}px, ${dy * 0.3}px)`;
      if (inner) inner.style.transform = `translate(${dx * 0.1}px, ${dy * 0.12}px)`;
    });
    btn.addEventListener('pointerleave', () => {
      btn.style.transition = 'transform 0.6s cubic-bezier(0.16, 1, 0.3, 1)';
      btn.style.transform = '';
      if (inner) inner.style.transform = '';
      setTimeout(() => { btn.style.transition = ''; }, 600);
    });
  });
})();

(function initCards() {
  $$('.card').forEach((card) => {
    card.addEventListener('pointermove', (e) => {
      const r = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${e.clientX - r.left}px`);
      card.style.setProperty('--my', `${e.clientY - r.top}px`);
    });
  });
})();

(function initFilter() {
  const wrap = $('.catalogue-filters');
  const btns = $$('.filter-btn');
  const cards = $$('.card');
  const glider = $('.filter-glider');
  if (!wrap || !btns.length) return;
  const place = () => {
    const active = btns.find((b) => b.classList.contains('active')) || btns[0];
    const wrapped = btns.some((b) => b.offsetTop !== btns[0].offsetTop);
    wrap.classList.toggle('no-glider', wrapped);
    if (!glider) return;
    glider.style.opacity = wrapped ? '0' : '1';
    glider.style.width = `${active.offsetWidth}px`;
    glider.style.transform = `translateX(${active.offsetLeft}px)`;
  };
  const apply = (filter) => {
    const first = new Map(cards.map((c) => [c, c.getBoundingClientRect()]));
    cards.forEach((c) => c.classList.toggle('hidden', filter !== 'all' && c.getAttribute('data-category') !== filter));
    if (REDUCED || !Element.prototype.animate) return;
    cards.forEach((c) => {
      if (c.classList.contains('hidden')) return;
      const f = first.get(c);
      const l = c.getBoundingClientRect();
      const easing = 'cubic-bezier(0.16, 1, 0.3, 1)';
      if (!f.width) {
        c.animate([{ opacity: 0, transform: 'scale(0.94)' }, { opacity: 1, transform: 'none' }], { duration: 600, easing });
      } else if (f.left !== l.left || f.top !== l.top) {
        c.animate([{ transform: `translate(${f.left - l.left}px, ${f.top - l.top}px)` }, { transform: 'none' }], { duration: 700, easing });
      }
    });
  };
  btns.forEach((btn) => {
    btn.addEventListener('click', () => {
      btns.forEach((b) => { b.classList.toggle('active', b === btn); b.setAttribute('aria-pressed', String(b === btn)); });
      place();
      apply(btn.getAttribute('data-filter'));
    });
  });
  window.addEventListener('resize', place, { passive: true });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(place);
  place();
})();

(function initModal() {
  const modal = $('#product-modal');
  if (!modal) return;
  const viewer = $('.modal-viewer', modal);
  const content = $('.modal-content', modal);
  let lastFocus = null;
  let current = null;
  let closeTimer = 0;

  const fill = (id) => {
    const p = PRODUCTS[id];
    $('#modal-tag').textContent = p.tag;
    $('#modal-title').textContent = p.name;
    $('#modal-price').textContent = p.price;
    $('#modal-desc').textContent = p.desc;
    const specs = $('#modal-specs');
    specs.textContent = '';
    [['Matière', p.material], ['Longueur', p.length], ['Poids', p.weight], ['Livraison', p.delivery]].forEach(([k, v]) => {
      const box = document.createElement('div');
      box.className = 'modal-spec';
      const dt = document.createElement('dt');
      dt.textContent = k;
      const dd = document.createElement('dd');
      dd.textContent = v;
      box.append(dt, dd);
      specs.append(box);
    });
    // repli sans WebGL : illustration de la carte
    $$('.modal-fallback', viewer).forEach((n) => n.remove());
    if (!document.documentElement.classList.contains('webgl')) {
      const svg = $(`.card[data-model="${id}"] .card-fallback`);
      if (svg) {
        const fb = document.createElement('div');
        fb.className = 'modal-fallback';
        fb.append(svg.cloneNode(true));
        viewer.append(fb);
      }
    }
  };

  const open = (id, trigger) => {
    if (!PRODUCTS[id]) return;
    clearTimeout(closeTimer);
    current = id;
    lastFocus = trigger || document.activeElement;
    fill(id);
    modal.hidden = false;
    document.documentElement.style.overflow = 'hidden';
    window.dispatchEvent(new CustomEvent('apex:modal', { detail: { id } }));
    requestAnimationFrame(() => requestAnimationFrame(() => modal.classList.add('open')));
    setTimeout(() => $('.modal-close', modal).focus(), 60);
  };

  const close = () => {
    if (modal.hidden) return;
    modal.classList.remove('open');
    document.documentElement.style.overflow = '';
    window.dispatchEvent(new CustomEvent('apex:modal', { detail: { id: null } }));
    closeTimer = setTimeout(() => { modal.hidden = true; }, 450);
    if (lastFocus && lastFocus.focus) lastFocus.focus({ preventScroll: true });
  };

  $$('[data-open]').forEach((btn) => btn.addEventListener('click', () => open(btn.getAttribute('data-open'), btn)));
  $$('.card-media').forEach((media) => media.addEventListener('click', () => {
    const btn = $('[data-open]', media.closest('.card'));
    if (btn) open(btn.getAttribute('data-open'), btn);
  }));
  $$('[data-close]', modal).forEach((el) => el.addEventListener('click', close));
  $('#modal-order').addEventListener('click', (e) => {
    e.preventDefault();
    const p = PRODUCTS[current];
    close();
    prefillContact(current === 'custom' ? 'mesure' : 'commande', p ? `Bonjour Hugo, je souhaite commander : ${p.name} (${p.price}).` : '');
  });
  document.addEventListener('keydown', (e) => {
    if (modal.hidden) return;
    if (e.key === 'Escape') { close(); return; }
    if (e.key !== 'Tab') return;
    // piège de focus dans la fiche
    const items = $$('a[href], button:not([disabled]), [tabindex="0"]', content).filter((el) => el.offsetParent !== null);
    if (!items.length) return;
    const first = items[0], last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  });
})();

(function initEngraving() {
  const form = $('#engrave-form');
  if (!form) return;
  const input = $('#engrave-text');
  const count = $('#engrave-count');
  const fallback = $('#engrave-fallback-text');
  let timer = 0;
  const read = () => ({
    text: input.value,
    font: (form.querySelector('input[name="font"]:checked') || {}).value || 'serif',
    finish: (form.querySelector('input[name="finish"]:checked') || {}).value || 'acier',
  });
  const push = (delay) => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      const detail = read();
      APEX.engrave = detail;
      window.dispatchEvent(new CustomEvent('apex:engrave', { detail }));
    }, delay);
  };
  const sync = () => {
    if (count) count.textContent = `${input.value.length}/${input.maxLength}`;
    if (fallback) fallback.textContent = input.value || ' ';
  };
  form.addEventListener('submit', (e) => e.preventDefault());
  input.addEventListener('input', () => { sync(); push(260); });
  $$('input[type="radio"]', form).forEach((r) => r.addEventListener('change', () => push(0)));
  $('#engrave-request').addEventListener('click', () => {
    const d = read();
    const fonts = { serif: 'classique', script: 'italique', sans: 'moderne', mono: 'technique' };
    const text = d.text.trim();
    prefillContact('mesure', `Bonjour Hugo, je souhaite un couteau sur mesure${text ? ` gravé « ${text} »` : ''} — police ${fonts[d.font] || d.font}, finition ${d.finish}.`);
  });
  sync();
})();

(function initContactForm() {
  const form = $('#contact-form');
  if (!form) return;
  const btn = $('#submit-btn');
  const label = btn.querySelector('span') || btn;
  const success = $('#form-success');
  form.addEventListener('submit', (e) => {
    e.preventDefault();
    let ok = true;
    $$('input[required], textarea[required]', form).forEach((field) => {
      const valid = field.checkValidity();
      field.classList.toggle('is-invalid', !valid);
      field.setAttribute('aria-invalid', String(!valid));
      if (!valid && ok) { field.focus(); ok = false; }
    });
    if (!ok) return;
    label.textContent = 'Envoi en cours...';
    btn.disabled = true;
    setTimeout(() => {
      label.textContent = 'Message envoyé !';
      if (success) success.hidden = false;
      form.reset();
      setTimeout(() => {
        label.textContent = 'Envoyer le message';
        btn.disabled = false;
        if (success) success.hidden = true;
      }, 4000);
    }, 1200);
  });
})();

(function initChatbotWidget() {
  const toggle = $('#chatbot-toggle');
  const panel = $('#chatbot-panel');
  const closeBtn = $('#chatbot-close');
  const sendBtn = $('#chatbot-send');
  const input = $('#chatbot-input');
  const messages = $('#chatbot-messages');
  if (!toggle || !panel || !messages) return;

  // Réponses du bot : HTML de confiance (base locale). Texte utilisateur : textContent uniquement.
  const addMsg = (text, isBot) => {
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + (isBot ? 'bot' : 'user');
    if (isBot) msg.innerHTML = text.replace(/\n/g, '<br/>');
    else msg.textContent = text;
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
    return msg;
  };
  const setOpen = (open) => {
    panel.classList.toggle('open', open);
    toggle.setAttribute('aria-expanded', String(open));
    if (open && messages.children.length === 0) addMsg("Bonjour ! Je suis l'assistant Apex 3D. Catalogue, prix, livraison, sur mesure — posez-moi votre question !", true);
    if (open && input) input.focus();
  };
  toggle.addEventListener('click', () => setOpen(!panel.classList.contains('open')));
  if (closeBtn) closeBtn.addEventListener('click', () => setOpen(false));

  const handleSend = () => {
    if (!input) return;
    const text = input.value.trim();
    if (!text) return;
    addMsg(text, false);
    input.value = '';
    const typing = document.createElement('div');
    typing.className = 'chat-msg bot';
    typing.innerHTML = '<span class="chat-typing"><i></i><i></i><i></i></span>';
    messages.appendChild(typing);
    messages.scrollTop = messages.scrollHeight;
    setTimeout(() => {
      typing.remove();
      const reply = typeof getBotAnswer === 'function' ? getBotAnswer(text)
        : 'Merci ! Pour toute demande, remplissez le formulaire de contact — Hugo vous répond sous 24h.';
      addMsg(reply, true);
    }, 650 + Math.random() * 400);
  };
  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (input) input.addEventListener('keydown', (e) => { if (e.key === 'Enter') handleSend(); });
})();
