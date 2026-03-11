/* ============================================================
   app.js — Scroll-Driven Frame Sequencing + Animations
   Lenis smooth scroll + GSAP ScrollTrigger + Canvas frames
============================================================ */

gsap.registerPlugin(ScrollTrigger);

// ── Lenis Smooth Scroll ──────────────────────────────────────
const lenis = new Lenis({
  duration: 1.2,
  easing: (t) => Math.min(1, 1.001 - Math.pow(2, -10 * t)),
  smoothWheel: true
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

// ── Config ───────────────────────────────────────────────────
const TOTAL_FRAMES      = 121;   // Kling-glasses-main.mp4 extracted frames
const HERO_TOTAL_FRAMES = 121;   // hero loop canvas — hero-section-animation.mp4
const IMAGE_SCALE       = 0.85;
const FRAME_SPEED       = 2.0;
const HERO_FPS          = 24;    // hero canvas loop playback speed

// ── Right-Side Scroll Canvas ─────────────────────────────────
const canvas = document.getElementById('glasses-canvas');
const ctx    = canvas.getContext('2d');
let currentFrame = 0;

function resizeCanvas() {
  const dpr = window.devicePixelRatio || 1;
  // Canvas is full 100vw — sync to full viewport resolution
  canvas.width  = window.innerWidth  * dpr;
  canvas.height = window.innerHeight * dpr;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.scale(dpr, dpr);
  renderFrame(currentFrame);
}

function renderFrame(index) {
  const i   = Math.min(Math.max(Math.round(index), 0), TOTAL_FRAMES - 1);
  const img = frames[i];
  if (!img || !img.complete || !img.naturalWidth) return;

  const W = canvas.offsetWidth;
  const H = canvas.offsetHeight;
  const scale  = Math.max(W / img.naturalWidth, H / img.naturalHeight) * IMAGE_SCALE;
  const drawW  = img.naturalWidth  * scale;
  const drawH  = img.naturalHeight * scale;
  ctx.clearRect(0, 0, W, H);
  // Shift glasses right on desktop; center on mobile
  const xShift = window.innerWidth < 768 ? W * 0.02 : W * 0.20;
  ctx.drawImage(img, (W - drawW) / 2 + xShift, (H - drawH) / 2, drawW, drawH);
  currentFrame = i;
}

// ── Preload: scroll canvas frames ────────────────────────────
const frames = [];
let loadedCount = 0;

for (let i = 1; i <= TOTAL_FRAMES; i++) {
  const img = new Image();
  img.src = `frames/frame_${String(i).padStart(4, '0')}.webp`;
  img.onload  = () => { if (++loadedCount >= TOTAL_FRAMES) initScrollAnimations(); };
  img.onerror = () => { if (++loadedCount >= TOTAL_FRAMES) initScrollAnimations(); };
  frames.push(img);
}

// ── Hero Canvas Loop ─────────────────────────────────────────
// Plays frames-hero/ in a continuous loop until the hero video is provided.
// Gracefully does nothing if frames-hero/ doesn't exist yet.
const heroCanvas = document.getElementById('hero-canvas');
const heroCtx    = heroCanvas.getContext('2d');
const heroFrames = [];
let heroLoaded = 0;
let heroFrameIndex = 0;

function resizeHeroCanvas() {
  const dpr = window.devicePixelRatio || 1;
  heroCanvas.width  = heroCanvas.offsetWidth  * dpr;
  heroCanvas.height = heroCanvas.offsetHeight * dpr;
  heroCtx.setTransform(1, 0, 0, 1, 0, 0);
  heroCtx.scale(dpr, dpr);
}

function renderHeroFrame(index) {
  const img = heroFrames[index];
  if (!img || !img.complete || !img.naturalWidth) return;
  const W = heroCanvas.offsetWidth;
  const H = heroCanvas.offsetHeight;
  resizeHeroCanvas();
  const scale = Math.max(W / img.naturalWidth, H / img.naturalHeight);
  const dw = img.naturalWidth  * scale;
  const dh = img.naturalHeight * scale;
  heroCtx.clearRect(0, 0, W, H);
  heroCtx.drawImage(img, (W - dw) / 2, (H - dh) / 2, dw, dh);
}

function startHeroLoop() {
  if (heroFrames.filter(f => f.complete && f.naturalWidth).length === 0) return;
  let last = 0;
  let direction = 1; // 1 = forward, -1 = reverse (ping-pong)
  const interval = 1000 / HERO_FPS;
  function tick(ts) {
    if (ts - last >= interval) {
      renderHeroFrame(heroFrameIndex);
      heroFrameIndex += direction;
      if (heroFrameIndex >= HERO_TOTAL_FRAMES - 1) { heroFrameIndex = HERO_TOTAL_FRAMES - 1; direction = -1; }
      else if (heroFrameIndex <= 0)                 { heroFrameIndex = 0;                     direction =  1; }
      last = ts;
    }
    requestAnimationFrame(tick);
  }
  requestAnimationFrame(tick);
}

// Load hero frames — silent fail if folder doesn't exist yet
for (let i = 1; i <= HERO_TOTAL_FRAMES; i++) {
  const img = new Image();
  img.src = `frames-hero/frame_${String(i).padStart(4, '0')}.webp`;
  img.onload  = () => { if (++heroLoaded >= HERO_TOTAL_FRAMES) startHeroLoop(); };
  img.onerror = () => { heroLoaded++; };
  heroFrames.push(img);
}

// ── Section Absolute Positioning ─────────────────────────────
// Each section is centered at its vh mark within #scroll-container.
// Values are % of 800vh (the container height).
const SECTION_CENTERS = {
  features:   12,   //  96vh into container → document 196vh
  lens:       27,   // 216vh into container → document 316vh
  components: 43,   // 344vh into container → document 444vh
  broll:      62,   // 496vh into container → document 596vh
  cta:        82    // 656vh into container → document 756vh
};

function positionSections() {
  const containerEl = document.getElementById('scroll-container');
  if (!containerEl) return;

  const isMobile = window.innerWidth < 768;

  if (isMobile) {
    // Gap-based: stack sections using their actual rendered heights
    const gap       = window.innerHeight * 0.12;   // 12vh breathing room between sections
    const startTop  = window.innerHeight * 0.28;   // first section starts 28vh into container
    const ids = ['features', 'lens', 'components', 'broll', 'cta'];
    let cursor = startTop;
    ids.forEach(id => {
      const el = document.getElementById(id);
      if (!el) return;
      el.style.top = `${cursor}px`;
      cursor += el.offsetHeight + gap;
    });
  } else {
    // Desktop: fixed % centres relative to 800vh container
    const containerH = window.innerHeight * 8;
    Object.entries(SECTION_CENTERS).forEach(([id, pct]) => {
      const el = document.getElementById(id);
      if (!el) return;
      const centerPx = containerH * (pct / 100);
      el.style.top = `${centerPx - el.offsetHeight / 2}px`;
    });
  }

  // Trim container to end just after the CTA section — no dead space
  const ctaEl = document.getElementById('cta');
  if (ctaEl) {
    const ctaBottom = parseFloat(ctaEl.style.top) + ctaEl.offsetHeight;
    containerEl.style.height = `${ctaBottom + window.innerHeight * 0.1}px`;
  }
}

window.addEventListener('resize', () => {
  resizeCanvas();
  positionSections();
  ScrollTrigger.refresh();
});

// ── Init: runs once all scroll frames are loaded ─────────────
function initScrollAnimations() {
  resizeCanvas();
  positionSections();
  renderFrame(0); // show glasses intact immediately

  // ── Section horizontal drift — "overflow flowing over" the canvas ──
  // Each section starts slightly pushed right and eases left as it enters view.
  // This gives the content the feel of gliding over the canvas area.
  document.querySelectorAll('#scroll-container > section').forEach(section => {
    gsap.fromTo(section,
      { x: 28, willChange: 'transform' },
      {
        x: 0,
        ease: 'none',
        scrollTrigger: {
          trigger: section,
          start: 'top 95%',
          end: 'top 20%',
          scrub: 1.4
        }
      }
    );
  });

  // Reveal canvas as hero scrolls out of view
  gsap.to('#glasses-canvas', {
    opacity: 1,
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start: 'top top',
      end: 'bottom top',
      scrub: true
    }
  });

  // Main frame scrub — entire page scroll (0 → bottom) drives frames
  const proxy = { frame: 0 };
  gsap.to(proxy, {
    frame: TOTAL_FRAMES - 1,
    ease: 'none',
    scrollTrigger: {
      trigger: 'body',
      start: 'top top',
      end: 'bottom bottom',
      scrub: 0.5,
      onUpdate: () => renderFrame(proxy.frame)
    }
  });

  // ── Hero Entrance ───────────────────────────────────────────
  const heroTL = gsap.timeline({ delay: 0.2 });

  heroTL
    .to('.hero-label', {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out'
    })
    .to('.hero-word', {
      opacity: 1,
      y: 0,
      duration: 1.1,
      ease: 'power4.out',
      stagger: 0.15
    }, '-=0.5')
    .to('.hero-tagline', {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out'
    }, '-=0.6')
    .to('.scroll-indicator', {
      opacity: 1,
      duration: 1,
      ease: 'power2.out'
    }, '-=0.4');

  // Hero content fades out on scroll
  gsap.to('.hero-content', {
    opacity: 0,
    y: -40,
    ease: 'none',
    scrollTrigger: {
      trigger: '#hero',
      start: 'center top',
      end: 'bottom top',
      scrub: true
    }
  });

  // ── Features Section ────────────────────────────────────────
  gsap.from('#features .section-header', {
    opacity: 0,
    y: 50,
    duration: 1.0,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#features',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    }
  });

  document.querySelectorAll('.feature-card').forEach((card, i) => {
    gsap.to(card, {
      opacity: 1,
      y: 0,
      duration: 0.9,
      ease: 'power3.out',
      delay: i * 0.12,
      scrollTrigger: {
        trigger: '#features .features-grid',
        start: 'top 82%',
        toggleActions: 'play none none reverse'
      }
    });
  });

  // ── Lens Technology Section ─────────────────────────────────
  gsap.from('#lens .section-header', {
    opacity: 0,
    y: 40,
    duration: 1.0,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#lens',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    }
  });

  document.querySelectorAll('.lens-item').forEach((item, i) => {
    gsap.to(item, {
      opacity: 1,
      x: 0,
      duration: 0.85,
      ease: 'power3.out',
      delay: i * 0.14,
      scrollTrigger: {
        trigger: '#lens .lens-list',
        start: 'top 82%',
        toggleActions: 'play none none reverse'
      }
    });
  });

  // ── Components Section ──────────────────────────────────────
  gsap.from('#components .section-header', {
    opacity: 0,
    y: 50,
    duration: 1.0,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#components',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    }
  });

  const partAnimations = {
    'part-left-temple':  { x: -120, y: 0,   opacity: 0 },
    'part-left-hinge':   { x: -60,  y: 30,  opacity: 0 },
    'part-left-lens':    { x: -80,  y: 0,   opacity: 0 },
    'part-bridge':       { x: 0,    y: -60, opacity: 0 },
    'part-right-lens':   { x: 80,   y: 0,   opacity: 0 },
    'part-right-hinge':  { x: 60,   y: 30,  opacity: 0 },
    'part-right-temple': { x: 120,  y: 0,   opacity: 0 },
  };

  Object.entries(partAnimations).forEach(([id, from], i) => {
    const el = document.getElementById(id);
    if (!el) return;
    gsap.from(el, {
      ...from,
      duration: 1.0,
      ease: 'power4.out',
      delay: i * 0.08,
      scrollTrigger: {
        trigger: '.components-stage',
        start: 'top 82%',
        toggleActions: 'play none none reverse'
      }
    });
  });

  // ── B-Roll Section ──────────────────────────────────────────
  gsap.from('#broll .broll-heading', {
    opacity: 0,
    y: 40,
    duration: 1.0,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#broll',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    }
  });

  gsap.from('#broll .broll-body', {
    opacity: 0,
    y: 30,
    duration: 0.9,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#broll',
      start: 'top 75%',
      toggleActions: 'play none none reverse'
    }
  });

  gsap.from('#broll .broll-specs', {
    opacity: 0,
    y: 20,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#broll',
      start: 'top 70%',
      toggleActions: 'play none none reverse'
    }
  });

  // ── CTA Section ─────────────────────────────────────────────
  gsap.from('#cta .section-label', {
    opacity: 0,
    y: 30,
    duration: 0.8,
    ease: 'power3.out',
    scrollTrigger: {
      trigger: '#cta',
      start: 'top 80%',
      toggleActions: 'play none none reverse'
    }
  });

  gsap.to('.cta-heading', {
    clipPath: 'inset(0% 0 0 0)',
    duration: 1.4,
    ease: 'power4.inOut',
    scrollTrigger: {
      trigger: '#cta',
      start: 'top 78%',
      toggleActions: 'play none none reverse'
    }
  });

  gsap.to(['.cta-sub', '.cta-button'], {
    opacity: 1,
    y: 0,
    duration: 0.9,
    ease: 'power3.out',
    stagger: 0.15,
    scrollTrigger: {
      trigger: '#cta',
      start: 'top 72%',
      toggleActions: 'play none none reverse'
    }
  });

  // Refresh ScrollTrigger now that sections are positioned
  ScrollTrigger.refresh();
}

// ── Page Transition ───────────────────────────────────────────
const overlay = document.getElementById('page-transition');

document.querySelector('.cta-link').addEventListener('click', (e) => {
  e.preventDefault();
  const href = e.currentTarget.getAttribute('href');
  gsap.to(overlay, {
    clipPath: 'circle(150% at 50% 50%)',
    duration: 0.9,
    ease: 'power2.inOut',
    onComplete: () => { window.location.href = href; }
  });
});

window.addEventListener('pageshow', () => {
  if (overlay.style.clipPath === 'circle(150% at 50% 50%)') {
    gsap.to(overlay, {
      clipPath: 'circle(0% at 50% 50%)',
      duration: 0.7,
      ease: 'power2.inOut'
    });
  }
});
