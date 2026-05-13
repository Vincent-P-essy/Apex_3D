'use strict';

(function initSplash() {
  var splash = document.getElementById('splash');
  if (!splash) return;
  document.body.style.overflow = 'hidden';
  setTimeout(function () {
    splash.classList.add('hidden');
    document.body.style.overflow = '';
  }, 1600);
})();

(function initCursor() {
  var cursor   = document.getElementById('cursor');
  var follower = document.getElementById('cursor-follower');
  if (!cursor || !follower || window.innerWidth <= 768) return;
  var mouseX = 0, mouseY = 0, followerX = 0, followerY = 0;
  document.addEventListener('mousemove', function (e) {
    mouseX = e.clientX; mouseY = e.clientY;
    cursor.style.left = mouseX + 'px'; cursor.style.top = mouseY + 'px';
  });
  (function animateFollower() {
    followerX += (mouseX - followerX) * 0.12;
    followerY += (mouseY - followerY) * 0.12;
    follower.style.left = followerX + 'px'; follower.style.top = followerY + 'px';
    requestAnimationFrame(animateFollower);
  })();
  document.querySelectorAll('a, button, .filter-btn, .btn-detail, .card, .process-step, .testimonial-card, input, textarea, select').forEach(function (el) {
    el.addEventListener('mouseenter', function () { document.body.classList.add('cursor-hover'); });
    el.addEventListener('mouseleave', function () { document.body.classList.remove('cursor-hover'); });
  });
})();

(function initScrollProgress() {
  var bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', function () {
    var pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    bar.style.width = pct + '%';
  }, { passive: true });
})();

(function initNavbar() {
  var navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', function () {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
})();

(function initMobileMenu() {
  var toggle   = document.getElementById('menu-toggle');
  var navLinks = document.getElementById('nav-links');
  if (!toggle || !navLinks) return;
  toggle.addEventListener('click', function () {
    var isOpen = navLinks.classList.toggle('open');
    toggle.classList.toggle('open', isOpen);
    toggle.setAttribute('aria-expanded', String(isOpen));
  });
  navLinks.querySelectorAll('a').forEach(function (link) {
    link.addEventListener('click', function () {
      navLinks.classList.remove('open');
      toggle.classList.remove('open');
      toggle.setAttribute('aria-expanded', 'false');
    });
  });
})();

(function initParticles() {
  var canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  var particles = [];
  for (var i = 0; i < 40; i++) {
    particles.push({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height,
      r: 1 + Math.random() * 1.5,
      dx: (Math.random() - 0.5) * 0.5,
      dy: -(0.1 + Math.random() * 0.3),
      alpha: 0.2 + Math.random() * 0.5,
      pulse: Math.random() * Math.PI * 2
    });
  }
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function (p) {
      p.pulse += 0.02;
      var a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201,168,76,' + a + ')';
      ctx.shadowColor = 'rgba(201,168,76,0.5)';
      ctx.shadowBlur = 6;
      ctx.fill();
      ctx.shadowBlur = 0;
      p.x += p.dx; p.y += p.dy;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
    });
    requestAnimationFrame(draw);
  })();
})();

(function initKnifeParallax() {
  var knife = document.getElementById('hero-knife');
  if (!knife) return;
  document.addEventListener('mousemove', function (e) {
    var dx = (e.clientX - window.innerWidth  / 2) / window.innerWidth  * 24;
    var dy = (e.clientY - window.innerHeight / 2) / window.innerHeight * 16;
    knife.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
})();

(function initReveal() {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var delay = parseInt(el.getAttribute('data-delay') || '0', 10);
      setTimeout(function () { el.classList.add('visible'); }, delay);
      observer.unobserve(el);
    });
  }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
  document.querySelectorAll('.reveal').forEach(function (el) { observer.observe(el); });
})();

(function initCounters() {
  var observer = new IntersectionObserver(function (entries) {
    entries.forEach(function (entry) {
      if (!entry.isIntersecting) return;
      var el = entry.target;
      var target = parseInt(el.getAttribute('data-count'), 10);
      var start = performance.now();
      (function tick(now) {
        var p = Math.min((now - start) / 1500, 1);
        var e = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(e * target);
        if (p < 1) requestAnimationFrame(tick); else el.textContent = target;
      })(start);
      observer.unobserve(el);
    });
  }, { threshold: 0.5 });
  document.querySelectorAll('[data-count]').forEach(function (el) { observer.observe(el); });
})();

(function initCardTilt() {
  document.querySelectorAll('.card').forEach(function (card) {
    card.addEventListener('mouseenter', function () { card.style.transition = 'transform 0.1s ease'; });
    card.addEventListener('mousemove', function (e) {
      var rect = card.getBoundingClientRect();
      var dx = (e.clientX - rect.left - rect.width  / 2) / (rect.width  / 2);
      var dy = (e.clientY - rect.top  - rect.height / 2) / (rect.height / 2);
      card.style.transform = 'perspective(800px) rotateX(' + (dy * -8) + 'deg) rotateY(' + (dx * 8) + 'deg) scale3d(1.02,1.02,1.02)';
    });
    card.addEventListener('mouseleave', function () {
      card.style.transition = 'transform 0.5s cubic-bezier(0.4,0,0.2,1)';
      card.style.transform = 'perspective(800px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    });
  });
})();

(function initMagneticButtons() {
  if (window.innerWidth <= 768) return;
  document.querySelectorAll('.btn-magnetic').forEach(function (btn) {
    btn.addEventListener('mouseenter', function () { btn.style.transition = 'transform 0.15s ease'; });
    btn.addEventListener('mousemove', function (e) {
      var rect = btn.getBoundingClientRect();
      var dx = (e.clientX - rect.left - rect.width  / 2) * 0.3;
      var dy = (e.clientY - rect.top  - rect.height / 2) * 0.3;
      btn.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
    });
    btn.addEventListener('mouseleave', function () {
      btn.style.transition = 'transform 0.4s cubic-bezier(0.4,0,0.2,1)';
      btn.style.transform = 'translate(0,0)';
    });
  });
})();

(function initFilter() {
  var btns  = document.querySelectorAll('.filter-btn');
  var cards = document.querySelectorAll('.card');
  btns.forEach(function (btn) {
    btn.addEventListener('click', function () {
      btns.forEach(function (b) { b.classList.remove('active'); });
      btn.classList.add('active');
      var filter = btn.getAttribute('data-filter');
      cards.forEach(function (card) {
        card.classList.toggle('hidden', filter !== 'all' && card.getAttribute('data-category') !== filter);
      });
    });
  });
})();

var PRODUCTS = {
  classique: { name: 'Le Classique', tag: 'Chef — Polyvalent', price: '35€', desc: 'La référence de la coutellerie numérique. Lame longue de chef en PLA+ haute résistance, profil de coupe idéal pour les cuisines du quotidien. Manche ergonomique noir avec grip texturé et rivets dorés.', material: 'PLA+', length: '21 cm', weight: '~90 g', delivery: '3-5 jours' },
  ombre:     { name: "L'Ombre",      tag: 'Tactique — Compact', price: '45€', desc: 'Un tactique compact au profil clip-point acéré. Lame en PETG noir mat ultra-résistant aux chocs. Manche ergonomique avec rainures anti-dérapantes.', material: 'PETG', length: '18 cm', weight: '~75 g', delivery: '3-5 jours' },
  dore:      { name: 'Le Doré',      tag: 'Décoratif — Collection', price: '60€', desc: "La pièce maîtresse. Entièrement imprimée en PLA Métallique doré, ornée de gravures géométriques. Livrée dans un écrin noir capitonné. Une œuvre d'art fonctionnelle.", material: 'PLA Métallique', length: '22 cm', weight: '~95 g', delivery: '3-5 jours' },
  santoku:   { name: 'Le Santoku',   tag: 'Chef — Style japonais', price: '40€', desc: "L'hommage au savoir-faire japonais. Lame santoku avec alvéoles anti-adhésion. Manche bois synthétique chaud avec insert décoratif doré.", material: 'PLA+', length: '19 cm', weight: '~85 g', delivery: '3-5 jours' },
  ranger:    { name: 'Le Ranger',    tag: 'Tactique — Survie', price: '55€', desc: 'Construit pour résister. Lame drop-point en ABS haute résistance. Scie intégrée sur le dos de la lame. Manche antidérapant avec grip profond.', material: 'ABS', length: '24 cm', weight: '~110 g', delivery: '3-5 jours' },
  custom:    { name: 'Sur Mesure',   tag: 'Personnalisé — Unique', price: 'dès 50€', desc: 'Votre vision, nos mains. Forme de lame, couleur du filament, texte gravé (prénom, date, initiales). Chaque pièce unique, conçue spécialement pour vous.', material: 'Au choix', length: 'Sur devis', weight: 'Variable', delivery: '5-7 jours' }
};

function openModal(id) {
  var p = PRODUCTS[id]; if (!p) return;
  var modal = document.getElementById('product-modal');
  var body  = document.getElementById('modal-body');
  if (!modal || !body) return;
  var cardSvg = null;
  document.querySelectorAll('[data-category]').forEach(function (card) {
    var btn = card.querySelector('.btn-detail');
    if (btn && btn.getAttribute('onclick') && btn.getAttribute('onclick').indexOf(id) !== -1)
      cardSvg = card.querySelector('.card-image svg');
  });
  body.innerHTML =
    '<div class="modal-knife-img">' + (cardSvg ? cardSvg.outerHTML : '') + '</div>' +
    '<p class="modal-tag">' + p.tag + '</p>' +
    '<h2 class="modal-title">' + p.name + '</h2>' +
    '<p class="modal-price">' + p.price + '</p>' +
    '<p class="modal-desc">' + p.desc + '</p>' +
    '<div class="modal-specs">' +
      '<div class="modal-spec"><span class="modal-spec-label">Matière</span><span class="modal-spec-val">' + p.material + '</span></div>' +
      '<div class="modal-spec"><span class="modal-spec-label">Longueur</span><span class="modal-spec-val">' + p.length + '</span></div>' +
      '<div class="modal-spec"><span class="modal-spec-label">Poids</span><span class="modal-spec-val">' + p.weight + '</span></div>' +
      '<div class="modal-spec"><span class="modal-spec-label">Livraison</span><span class="modal-spec-val">' + p.delivery + '</span></div>' +
    '</div>' +
    '<div class="modal-cta">' +
      '<a href="#contact" class="btn-primary btn-magnetic" onclick="closeModal()">Commander</a>' +
      '<button class="btn-ghost" onclick="closeModal()">Fermer</button>' +
    '</div>';
  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  var modal = document.getElementById('product-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeModal(); });

function submitForm(e) {
  e.preventDefault();
  var btn     = document.getElementById('submit-btn');
  var success = document.getElementById('form-success');
  btn.textContent = 'Envoi en cours...'; btn.disabled = true; btn.style.opacity = '0.7';
  setTimeout(function () {
    btn.textContent = 'Message envoyé !'; btn.style.opacity = '1';
    if (success) success.style.display = 'block';
    e.target.reset();
    setTimeout(function () {
      btn.textContent = 'Envoyer le message'; btn.disabled = false;
      if (success) success.style.display = 'none';
    }, 4000);
  }, 1200);
}

(function initChatbotWidget() {
  var toggle   = document.getElementById('chatbot-toggle');
  var panel    = document.getElementById('chatbot-panel');
  var closeBtn = document.getElementById('chatbot-close');
  var sendBtn  = document.getElementById('chatbot-send');
  var input    = document.getElementById('chatbot-input');
  var messages = document.getElementById('chatbot-messages');
  if (!toggle || !panel) return;

  function addMsg(text, isBot) {
    if (!messages) return;
    var msg = document.createElement('div');
    msg.style.cssText = isBot
      ? 'background:var(--dark-3);border:1px solid var(--border-dim);border-radius:12px 12px 12px 2px;padding:0.6rem 0.875rem;font-size:0.85rem;color:var(--cream-dim);max-width:85%;'
      : 'background:var(--gold-dim);border:1px solid var(--border);border-radius:12px 12px 2px 12px;padding:0.6rem 0.875rem;font-size:0.85rem;color:var(--cream);max-width:85%;align-self:flex-end;margin-left:auto;';
    msg.innerHTML = text.replace(/\n/g, '<br/>');
    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
  }

  toggle.addEventListener('click', function () {
    var isOpen = panel.classList.toggle('open');
    if (isOpen && messages && messages.children.length === 0)
      addMsg('Bonjour ! Je suis l\'assistant Apex 3D. Catalogue, prix, livraison, sur mesure — posez-moi votre question !', true);
  });
  if (closeBtn) closeBtn.addEventListener('click', function () { panel.classList.remove('open'); });

  function handleSend() {
    if (!input) return;
    var text = input.value.trim(); if (!text) return;
    addMsg(text, false); input.value = '';
    setTimeout(function () {
      var reply = (typeof getBotAnswer === 'function') ? getBotAnswer(text) :
        'Merci ! Pour toute demande, remplissez le formulaire de contact — Hugo vous répond sous 24h.';
      addMsg(reply, true);
    }, 600);
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (input) input.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSend(); });
})();

(function initSmoothScroll() {
  document.querySelectorAll('a[href^="#"]').forEach(function (link) {
    link.addEventListener('click', function (e) {
      var target = document.querySelector(link.getAttribute('href'));
      if (!target) return;
      e.preventDefault();
      var navH = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--nav-h')) || 72;
      window.scrollTo({ top: target.getBoundingClientRect().top + window.scrollY - navH, behavior: 'smooth' });
    });
  });
})();
