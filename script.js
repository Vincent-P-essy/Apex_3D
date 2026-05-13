'use strict';

/* ================================================================
   CONFIGURATION — Remplacez ces valeurs avec vos identifiants
   ================================================================ */
var CONFIG = {

  // EmailJS — https://www.emailjs.com/ (gratuit jusqu'à 200 emails/mois)
  // 1. Créez un compte sur emailjs.com
  // 2. Ajoutez un service Gmail (Email Services > Add New Service)
  // 3. Créez un template avec les variables : from_name, from_email, objet, message
  // 4. Copiez vos IDs ci-dessous
  emailjs: {
    serviceId:  'service_XXXXXXX',    // Dashboard > Email Services > Service ID
    templateId: 'template_XXXXXXX',   // Dashboard > Email Templates > Template ID
    publicKey:  'XXXXXXXXXXXXXXXXX'   // Dashboard > Account > Public Key
  },

  // Google Analytics 4 — https://analytics.google.com/
  // Admin > Flux de données > Measurement ID (format G-XXXXXXXXXX)
  ga4: {
    measurementId: 'G-XXXXXXXXXX'
  },

  // WhatsApp — votre numéro au format international sans le +
  // Exemple: +33 6 12 34 56 78 → '33612345678'
  whatsapp: {
    number:  '33600000000',
    message: 'Bonjour, je suis intéressé par vos couteaux Apex 3D !'
  },

  // Stripe Payment Links — https://dashboard.stripe.com/payment-links
  // Créez un lien de paiement par produit et collez l'URL ici
  stripe: {
    classique: 'https://buy.stripe.com/REMPLACER_CLASSIQUE',
    ombre:     'https://buy.stripe.com/REMPLACER_OMBRE',
    dore:      'https://buy.stripe.com/REMPLACER_DORE',
    santoku:   'https://buy.stripe.com/REMPLACER_SANTOKU',
    ranger:    'https://buy.stripe.com/REMPLACER_RANGER',
    custom:    '#contact'
  }
};

/* ================================================================ */

var PRODUCTS = {
  classique: { name: 'Le Classique',  tag: 'Chef — Polyvalent',       price: '35€',    rawPrice: 35,  desc: 'La référence de la coutellerie numérique. Lame longue de chef en PLA+ haute résistance, profil de coupe idéal pour les cuisines du quotidien. Manche ergonomique noir avec grip texturé et rivets dorés.', material: 'PLA+',           length: '21 cm',   weight: '~90 g',  delivery: '3-5 jours' },
  ombre:     { name: "L'Ombre",       tag: 'Tactique — Compact',       price: '45€',    rawPrice: 45,  desc: 'Un tactique compact au profil clip-point acéré. Lame en PETG noir mat ultra-résistant aux chocs. Manche ergonomique avec rainures anti-dérapantes.',                                                       material: 'PETG',           length: '18 cm',   weight: '~75 g',  delivery: '3-5 jours' },
  dore:      { name: 'Le Doré',       tag: 'Décoratif — Collection',   price: '60€',    rawPrice: 60,  desc: "La pièce maîtresse. Entièrement imprimée en PLA Métallique doré, ornée de gravures géométriques. Livrée dans un écrin noir capitonné. Une œuvre d'art fonctionnelle.",                                   material: 'PLA Métallique', length: '22 cm',   weight: '~95 g',  delivery: '3-5 jours' },
  santoku:   { name: 'Le Santoku',    tag: 'Chef — Style japonais',    price: '40€',    rawPrice: 40,  desc: "L'hommage au savoir-faire japonais. Lame santoku avec alvéoles anti-adhésion. Manche bois synthétique chaud avec insert décoratif doré.",                                                                  material: 'PLA+',           length: '19 cm',   weight: '~85 g',  delivery: '3-5 jours' },
  ranger:    { name: 'Le Ranger',     tag: 'Tactique — Survie',        price: '55€',    rawPrice: 55,  desc: 'Construit pour résister. Lame drop-point en ABS haute résistance. Scie intégrée sur le dos de la lame. Manche antidérapant avec grip profond.',                                                          material: 'ABS',            length: '24 cm',   weight: '~110 g', delivery: '3-5 jours' },
  custom:    { name: 'Sur Mesure',    tag: 'Personnalisé — Unique',    price: 'dès 50€', rawPrice: 50, desc: 'Votre vision, nos mains. Forme de lame, couleur du filament, texte gravé (prénom, date, initiales). Chaque pièce unique, conçue spécialement pour vous.',                                               material: 'Au choix',       length: 'Sur devis', weight: 'Variable', delivery: '5-7 jours' }
};

/* ---- Splash ---- */
(function initSplash() {
  var splash = document.getElementById('splash');
  if (!splash) return;
  document.body.style.overflow = 'hidden';
  setTimeout(function () {
    splash.classList.add('hidden');
    document.body.style.overflow = '';
  }, 1600);
})();

/* ---- Cursor ---- */
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
  var interactives = 'a, button, .filter-btn, .btn-detail, .btn-cart, .card, .process-step, .testimonial-card, input, textarea, select, #cart-toggle, #whatsapp-btn';
  document.querySelectorAll(interactives).forEach(function (el) {
    el.addEventListener('mouseenter', function () { document.body.classList.add('cursor-hover'); });
    el.addEventListener('mouseleave', function () { document.body.classList.remove('cursor-hover'); });
  });
})();

/* ---- Scroll progress ---- */
(function initScrollProgress() {
  var bar = document.getElementById('scroll-progress');
  if (!bar) return;
  window.addEventListener('scroll', function () {
    var pct = (window.scrollY / (document.documentElement.scrollHeight - window.innerHeight)) * 100;
    bar.style.width = pct + '%';
  }, { passive: true });
})();

/* ---- Navbar ---- */
(function initNavbar() {
  var navbar = document.getElementById('navbar');
  if (!navbar) return;
  window.addEventListener('scroll', function () {
    navbar.classList.toggle('scrolled', window.scrollY > 50);
  }, { passive: true });
})();

/* ---- Mobile menu ---- */
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

/* ---- Particles ---- */
(function initParticles() {
  var canvas = document.getElementById('particles-canvas');
  if (!canvas) return;
  var ctx = canvas.getContext('2d');
  function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
  resize();
  window.addEventListener('resize', resize, { passive: true });
  var particles = [];
  for (var i = 0; i < 40; i++) {
    particles.push({ x: Math.random() * canvas.width, y: Math.random() * canvas.height, r: 1 + Math.random() * 1.5, dx: (Math.random() - 0.5) * 0.5, dy: -(0.1 + Math.random() * 0.3), alpha: 0.2 + Math.random() * 0.5, pulse: Math.random() * Math.PI * 2 });
  }
  (function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    particles.forEach(function (p) {
      p.pulse += 0.02;
      var a = p.alpha * (0.6 + 0.4 * Math.sin(p.pulse));
      ctx.beginPath(); ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(201,168,76,' + a + ')';
      ctx.shadowColor = 'rgba(201,168,76,0.5)'; ctx.shadowBlur = 6;
      ctx.fill(); ctx.shadowBlur = 0;
      p.x += p.dx; p.y += p.dy;
      if (p.y < -10) p.y = canvas.height + 10;
      if (p.x < -10) p.x = canvas.width + 10;
      if (p.x > canvas.width + 10) p.x = -10;
    });
    requestAnimationFrame(draw);
  })();
})();

/* ---- Knife parallax ---- */
(function initKnifeParallax() {
  var knife = document.getElementById('hero-knife');
  if (!knife) return;
  document.addEventListener('mousemove', function (e) {
    var dx = (e.clientX - window.innerWidth  / 2) / window.innerWidth  * 24;
    var dy = (e.clientY - window.innerHeight / 2) / window.innerHeight * 16;
    knife.style.transform = 'translate(' + dx + 'px,' + dy + 'px)';
  });
})();

/* ---- Scroll reveal ---- */
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

/* ---- Counters ---- */
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

/* ---- Card tilt ---- */
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

/* ---- Magnetic buttons ---- */
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

/* ---- Catalogue filter ---- */
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

/* ---- Smooth scroll ---- */
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

/* ================================================================
   COOKIE CONSENT RGPD
   ================================================================ */
(function initCookieConsent() {
  var banner  = document.getElementById('cookie-banner');
  var accept  = document.getElementById('cookie-accept');
  var reject  = document.getElementById('cookie-reject');
  if (!banner) return;

  var consent = localStorage.getItem('apex3d_cookie_consent');
  if (consent === 'accepted') { initGA4(); return; }
  if (consent === 'rejected') return;

  setTimeout(function () {
    banner.classList.add('visible');
    banner.setAttribute('aria-hidden', 'false');
  }, 2000);

  accept.addEventListener('click', function () {
    localStorage.setItem('apex3d_cookie_consent', 'accepted');
    hideBanner();
    initGA4();
    trackEvent('cookie_consent', { action: 'accepted' });
  });

  reject.addEventListener('click', function () {
    localStorage.setItem('apex3d_cookie_consent', 'rejected');
    hideBanner();
  });

  function hideBanner() {
    banner.classList.remove('visible');
    banner.setAttribute('aria-hidden', 'true');
  }
})();

/* ================================================================
   GOOGLE ANALYTICS 4
   ================================================================ */
function initGA4() {
  var id = CONFIG.ga4.measurementId;
  if (!id || id === 'G-XXXXXXXXXX') return;
  var scriptTag = document.querySelector('script[src*="googletagmanager"]');
  if (scriptTag) scriptTag.src = scriptTag.src.replace('G-PLACEHOLDER', id);
  gtag('js', new Date());
  gtag('config', id, { anonymize_ip: true });
}

function trackEvent(eventName, params) {
  if (typeof gtag === 'function' && localStorage.getItem('apex3d_cookie_consent') === 'accepted') {
    gtag('event', eventName, params || {});
  }
}

/* ================================================================
   WHATSAPP BUTTON
   ================================================================ */
(function initWhatsApp() {
  var btn = document.getElementById('whatsapp-btn');
  if (!btn) return;
  var n = CONFIG.whatsapp.number;
  var m = encodeURIComponent(CONFIG.whatsapp.message);
  btn.href = 'https://wa.me/' + n + '?text=' + m;
})();

/* ================================================================
   PANIER (CART)
   ================================================================ */
var cart = JSON.parse(localStorage.getItem('apex3d_cart') || '[]');

function saveCart() {
  localStorage.setItem('apex3d_cart', JSON.stringify(cart));
  renderCartCount();
  renderCartItems();
}

function renderCartCount() {
  var badge = document.getElementById('cart-count');
  if (!badge) return;
  var total = cart.reduce(function (sum, item) { return sum + item.qty; }, 0);
  badge.textContent = total;
  badge.style.display = total > 0 ? 'flex' : 'none';
}

function renderCartItems() {
  var container = document.getElementById('cart-items');
  var totalEl   = document.getElementById('cart-total');
  var checkoutBtn = document.getElementById('cart-checkout-btn');
  if (!container) return;

  if (cart.length === 0) {
    container.innerHTML = '<div class="cart-empty"><svg viewBox="0 0 24 24" width="48" height="48" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="9" cy="21" r="1"/><circle cx="20" cy="21" r="1"/><path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"/></svg><p>Votre panier est vide</p></div>';
    if (totalEl) totalEl.textContent = '0€';
    if (checkoutBtn) checkoutBtn.style.display = 'none';
    return;
  }

  if (checkoutBtn) checkoutBtn.style.display = '';

  var total = 0;
  container.innerHTML = cart.map(function (item) {
    var p = PRODUCTS[item.id];
    total += p.rawPrice * item.qty;
    return '<div class="cart-item">' +
      '<div class="cart-item-info">' +
        '<span class="cart-item-name">' + p.name + '</span>' +
        '<span class="cart-item-price">' + p.rawPrice + '€ / unité</span>' +
      '</div>' +
      '<div class="cart-item-controls">' +
        '<button onclick="changeQty(\'' + item.id + '\',-1)" aria-label="Retirer un">−</button>' +
        '<span>' + item.qty + '</span>' +
        '<button onclick="changeQty(\'' + item.id + '\',1)" aria-label="Ajouter un">+</button>' +
        '<button class="cart-item-remove" onclick="removeFromCart(\'' + item.id + '\')" aria-label="Supprimer">×</button>' +
      '</div>' +
    '</div>';
  }).join('');

  if (totalEl) totalEl.textContent = total + '€';

  // Si un seul produit, pointer directement vers Stripe
  if (cart.length === 1 && checkoutBtn) {
    var link = CONFIG.stripe[cart[0].id];
    if (link && link !== '#contact' && link.indexOf('REMPLACER') === -1) {
      checkoutBtn.href = link;
      checkoutBtn.target = '_blank';
      checkoutBtn.textContent = 'Payer en ligne';
    } else {
      checkoutBtn.href = '#contact';
      checkoutBtn.target = '';
      checkoutBtn.textContent = 'Commander';
    }
  } else if (checkoutBtn) {
    checkoutBtn.href = '#contact';
    checkoutBtn.target = '';
    checkoutBtn.textContent = 'Commander (' + total + '€)';
  }
}

function addToCart(id) {
  if (id === 'custom') { window.location.href = '#contact'; return; }
  var existing = cart.find(function (i) { return i.id === id; });
  if (existing) {
    existing.qty++;
  } else {
    cart.push({ id: id, qty: 1 });
  }
  saveCart();
  openCart();
  trackEvent('add_to_cart', { item_name: PRODUCTS[id].name, value: PRODUCTS[id].rawPrice });

  // Animation feedback sur le bouton
  var btns = document.querySelectorAll('[onclick="addToCart(\'' + id + '\')"]');
  btns.forEach(function (btn) {
    btn.classList.add('cart-added');
    setTimeout(function () { btn.classList.remove('cart-added'); }, 600);
  });
}

function removeFromCart(id) {
  cart = cart.filter(function (i) { return i.id !== id; });
  saveCart();
}

function changeQty(id, delta) {
  var item = cart.find(function (i) { return i.id === id; });
  if (!item) return;
  item.qty += delta;
  if (item.qty <= 0) removeFromCart(id);
  else saveCart();
}

function openCart() {
  var sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;
  sidebar.classList.add('open');
  sidebar.setAttribute('aria-hidden', 'false');
  renderCartItems();
}

function closeCart() {
  var sidebar = document.getElementById('cart-sidebar');
  if (!sidebar) return;
  sidebar.classList.remove('open');
  sidebar.setAttribute('aria-hidden', 'true');
}

(function initCart() {
  var toggle = document.getElementById('cart-toggle');
  if (toggle) toggle.addEventListener('click', function () {
    var sidebar = document.getElementById('cart-sidebar');
    if (sidebar && sidebar.classList.contains('open')) closeCart();
    else openCart();
  });
  renderCartCount();
})();

/* ================================================================
   PRODUCT MODALS
   ================================================================ */
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

  var stripeLink = CONFIG.stripe[id] || '#contact';
  var hasStripe  = stripeLink !== '#contact' && stripeLink.indexOf('REMPLACER') === -1;
  var payBtn = hasStripe
    ? '<a href="' + stripeLink + '" class="btn-primary btn-magnetic" target="_blank" rel="noopener" onclick="trackEvent(\'begin_checkout\',{item_name:\'' + p.name + '\'})">Payer maintenant — ' + p.price + '</a>'
    : '<a href="#contact" class="btn-primary btn-magnetic" onclick="closeModal()">Commander</a>';

  body.innerHTML =
    '<div class="modal-knife-img">' + (cardSvg ? cardSvg.outerHTML : '') + '</div>' +
    '<p class="modal-tag">' + p.tag + '</p>' +
    '<h2 class="modal-title" id="modal-title">' + p.name + '</h2>' +
    '<p class="modal-price">' + p.price + '</p>' +
    '<p class="modal-desc">' + p.desc + '</p>' +
    '<div class="modal-specs">' +
      '<div class="modal-spec"><span class="modal-spec-label">Matière</span><span class="modal-spec-val">' + p.material + '</span></div>' +
      '<div class="modal-spec"><span class="modal-spec-label">Longueur</span><span class="modal-spec-val">' + p.length + '</span></div>' +
      '<div class="modal-spec"><span class="modal-spec-label">Poids</span><span class="modal-spec-val">' + p.weight + '</span></div>' +
      '<div class="modal-spec"><span class="modal-spec-label">Livraison</span><span class="modal-spec-val">' + p.delivery + '</span></div>' +
    '</div>' +
    '<div class="modal-cta">' +
      payBtn +
      (id !== 'custom' ? '<button class="btn-ghost btn-magnetic" onclick="addToCart(\'' + id + '\'); closeModal()">Ajouter au panier</button>' : '') +
    '</div>';

  modal.classList.add('open');
  document.body.style.overflow = 'hidden';
  trackEvent('view_item', { item_name: p.name });
}

function closeModal() {
  var modal = document.getElementById('product-modal');
  if (!modal) return;
  modal.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', function (e) {
  if (e.key === 'Escape') { closeModal(); closeCart(); }
});

/* ================================================================
   FORMULAIRE DE CONTACT — EmailJS
   ================================================================ */
(function initEmailJS() {
  var cfg = CONFIG.emailjs;
  if (!cfg.publicKey || cfg.publicKey === 'XXXXXXXXXXXXXXXXX') return;
  emailjs.init({ publicKey: cfg.publicKey });
})();

function submitForm(e) {
  e.preventDefault();
  var btn     = document.getElementById('submit-btn');
  var success = document.getElementById('form-success');
  var form    = e.target;
  var cfg     = CONFIG.emailjs;

  btn.textContent = 'Envoi en cours…';
  btn.disabled    = true;
  btn.style.opacity = '0.7';

  var isConfigured = cfg.serviceId !== 'service_XXXXXXX' && cfg.templateId !== 'template_XXXXXXX' && cfg.publicKey !== 'XXXXXXXXXXXXXXXXX';

  if (!isConfigured) {
    // Mode démo : simule l'envoi si EmailJS non configuré
    setTimeout(function () {
      btn.textContent  = 'Message envoyé !';
      btn.style.opacity = '1';
      if (success) success.style.display = 'block';
      form.reset();
      trackEvent('form_submit', { form_type: 'contact_demo' });
      setTimeout(function () {
        btn.textContent = 'Envoyer le message';
        btn.disabled = false;
        if (success) success.style.display = 'none';
      }, 4000);
    }, 1200);
    return;
  }

  var templateParams = {
    from_name:  form.name.value,
    from_email: form.email.value,
    objet:      form.objet.value,
    message:    form.message.value,
    to_email:   'vincent.plessy12@gmail.com'
  };

  emailjs.send(cfg.serviceId, cfg.templateId, templateParams)
    .then(function () {
      btn.textContent  = 'Message envoyé !';
      btn.style.opacity = '1';
      if (success) success.style.display = 'block';
      form.reset();
      trackEvent('form_submit', { form_type: 'contact' });
      setTimeout(function () {
        btn.textContent = 'Envoyer le message';
        btn.disabled = false;
        if (success) success.style.display = 'none';
      }, 4000);
    })
    .catch(function (err) {
      console.error('EmailJS error:', err);
      btn.textContent = 'Erreur — réessayez';
      btn.style.opacity = '1';
      btn.disabled = false;
    });
}

/* ================================================================
   CHATBOT WIDGET
   ================================================================ */
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
    return msg;
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
    addMsg(text, false);
    input.value = '';

    // Indicateur "réfléchit..."
    var typingDiv = addMsg('…', true);
    typingDiv.style.opacity = '0.5';

    setTimeout(function () {
      if (typingDiv.parentNode) typingDiv.parentNode.removeChild(typingDiv);
      var reply = (typeof getBotAnswer === 'function') ? getBotAnswer(text) : 'Merci ! Contactez Vincent à vincent.plessy12@gmail.com.';
      addMsg(reply, true);
      trackEvent('chatbot_message', { query_length: text.length });
    }, 600 + Math.random() * 400);
  }

  if (sendBtn) sendBtn.addEventListener('click', handleSend);
  if (input)   input.addEventListener('keydown', function (e) { if (e.key === 'Enter') handleSend(); });
})();
