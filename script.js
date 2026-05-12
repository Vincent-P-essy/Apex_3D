// Mobile menu
const menuToggle = document.querySelector('.menu-toggle');
const navLinks = document.querySelector('.nav-links');
menuToggle.addEventListener('click', () => {
  const isOpen = navLinks.classList.toggle('open');
  menuToggle.setAttribute('aria-expanded', isOpen);
});
navLinks.querySelectorAll('a').forEach(a => a.addEventListener('click', () => {
  navLinks.classList.remove('open');
  menuToggle.setAttribute('aria-expanded', 'false');
}));

// Catalogue filter
const filterBtns = document.querySelectorAll('.filter-btn');
const cards = document.querySelectorAll('.card');

filterBtns.forEach(btn => {
  btn.addEventListener('click', () => {
    filterBtns.forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    const filter = btn.dataset.filter;
    cards.forEach(card => {
      const match = filter === 'all' || card.dataset.category === filter;
      card.classList.toggle('hidden', !match);
    });
  });
});

// Modal
const overlay = document.getElementById('modal-overlay');

function openModal(title, desc, material, price, category) {
  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-desc').textContent = desc;
  document.getElementById('modal-material').textContent = material;
  document.getElementById('modal-price').textContent = price;

  const badgeEl = document.getElementById('modal-badge');
  const labels = { chef: 'Chef', tactical: 'Tactique', decoratif: 'Décoratif', custom: 'Sur mesure' };
  badgeEl.textContent = labels[category] || category;
  badgeEl.className = 'modal-badge';

  overlay.classList.add('open');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  overlay.classList.remove('open');
  document.body.style.overflow = '';
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Form submission
function submitForm(e) {
  e.preventDefault();
  const successEl = document.getElementById('form-success');
  successEl.style.display = 'block';
  e.target.reset();
  setTimeout(() => { successEl.style.display = 'none'; }, 5000);
}

// Counter animation for stats
const statNumbers = document.querySelectorAll('.stat-number');
const statObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting && !entry.target.dataset.animated) {
      entry.target.dataset.animated = 'true';
      const el = entry.target;
      const raw = el.textContent.trim();
      const num = parseInt(raw);
      if (!isNaN(num) && num > 1) {
        const suffix = raw.replace(String(num), '');
        let current = 0;
        const steps = 40;
        const increment = Math.ceil(num / steps);
        const timer = setInterval(() => {
          current = Math.min(current + increment, num);
          el.textContent = current + suffix;
          if (current >= num) clearInterval(timer);
        }, 25);
      }
    }
  });
}, { threshold: 0.6 });
statNumbers.forEach(n => statObserver.observe(n));

// Animate cards on scroll
const observer = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.style.opacity = '1';
      entry.target.style.transform = 'translateY(0)';
    }
  });
}, { threshold: 0.1 });

cards.forEach((card, i) => {
  card.style.opacity = '0';
  card.style.transform = 'translateY(24px)';
  card.style.transition = `opacity 0.4s ease ${i * 0.07}s, transform 0.4s ease ${i * 0.07}s, border-color 0.25s ease, box-shadow 0.25s ease`;
  observer.observe(card);
});
