(function () {
  'use strict';
  var reduce = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  function $(s, r) { return (r || document).querySelector(s); }
  function $$(s, r) { return [].slice.call((r || document).querySelectorAll(s)); }

  /* ---------- Mobile menu ---------- */
  var toggle = $('.nav-toggle'), nav = $('.main-nav');
  if (toggle && nav) {
    var setOpen = function (open) {
      nav.classList.toggle('is-open', open);
      toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
    };
    toggle.addEventListener('click', function () { setOpen(!nav.classList.contains('is-open')); });
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && nav.classList.contains('is-open')) { setOpen(false); toggle.focus(); }
    });
    window.addEventListener('resize', function () { if (window.innerWidth > 960) setOpen(false); });
  }

  /* ---------- Homepage: reveal + counters ---------- */
  (function () {
    var els = $$('.reveal');
    if (!els.length) return;
    function animateCount(el) {
      var target = parseInt(el.getAttribute('data-count'), 10), suffix = el.getAttribute('data-suffix') || '';
      if (isNaN(target)) return;
      if (reduce) { el.textContent = target.toLocaleString() + suffix; return; }
      var start = null;
      function step(ts) {
        if (!start) start = ts;
        var p = Math.min((ts - start) / 1200, 1), eased = 1 - Math.pow(1 - p, 3);
        el.textContent = Math.round(target * eased).toLocaleString() + suffix;
        if (p < 1) requestAnimationFrame(step);
      }
      requestAnimationFrame(step);
    }
    function show(el) {
      el.classList.add('is-visible');
      $$('.stat-num[data-count]', el).forEach(animateCount);
    }
    if (!('IntersectionObserver' in window)) { els.forEach(show); return; }
    var io = new IntersectionObserver(function (entries) {
      entries.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  })();

  /* ---------- Homepage: button magnet + photo parallax ---------- */
  if (!reduce && $('#tab-ledger')) {
    $$('#tab-ledger .btn').forEach(function (btn) {
      btn.addEventListener('mousemove', function (e) {
        var r = btn.getBoundingClientRect(), max = 7;
        var x = Math.max(Math.min((e.clientX - r.left - r.width / 2) * 0.25, max), -max);
        var y = Math.max(Math.min((e.clientY - r.top - r.height / 2) * 0.25, max), -max) - 2;
        btn.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px)';
      });
      btn.addEventListener('mouseleave', function () { btn.style.transform = ''; });
    });
    var heroPhoto = $('#tab-ledger .hero-photo-wrap'), expPhoto = $('#tab-ledger .experience-photo'), ticking = false;
    if (heroPhoto || expPhoto) {
      var parallax = function () {
        if (heroPhoto) heroPhoto.style.transform = 'translateY(' + ((heroPhoto.getBoundingClientRect().top - window.innerHeight / 2) * 0.06).toFixed(1) + 'px)';
        if (expPhoto) expPhoto.style.transform = 'translateY(' + ((expPhoto.getBoundingClientRect().top - window.innerHeight / 2) * 0.08).toFixed(1) + 'px)';
        ticking = false;
      };
      window.addEventListener('scroll', function () { if (!ticking) { requestAnimationFrame(parallax); ticking = true; } }, { passive: true });
      parallax();
    }
  }

  /* ---------- Carrier marquee pause ---------- */
  var mq = $('.carrier-marquee'), mqBtn = $('.marquee-toggle');
  if (mq && mqBtn) {
    mqBtn.addEventListener('click', function () {
      var paused = mq.classList.toggle('is-paused');
      mqBtn.setAttribute('aria-pressed', paused ? 'true' : 'false');
      mqBtn.textContent = paused ? 'Resume scrolling' : 'Pause scrolling';
    });
  }

  /* ---------- Shared: scroll-reveal for inner pages ---------- */
  function initRv(root, singles, groups, photoSel) {
    if (!root) return;
    function mark(el, d, dir) { el.classList.add('rv'); if (dir) el.classList.add(dir); if (d) el.style.setProperty('--d', d + 's'); }
    singles.forEach(function (s) { $$(s, root).forEach(function (el) { mark(el, 0); }); });
    if (photoSel) $$(photoSel, root).forEach(function (el) { mark(el, 0.05, getComputedStyle(el).order === '2' ? 'rv-r' : 'rv-l'); });
    groups.forEach(function (g) { $$(g[0], root).forEach(function (el, i) { mark(el, (g[1] ? i % g[1] : i) * 0.09); }); });
    var els = $$('.rv', root);
    function show(el) { el.classList.add('in'); setTimeout(function () { el.classList.add('done'); }, 1300); }
    if (reduce || !('IntersectionObserver' in window)) { els.forEach(show); return; }
    var io = new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { show(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -40px 0px' });
    els.forEach(function (el) { io.observe(el); });
  }

  /* ---------- Services ---------- */
  var svc = document.getElementById('tab-services');
  if (svc) {
    initRv(svc,
      ['.svc-benefits-head', '.addl-head', '.carriers-head', '.svc-mid-inner', '.svc-text',
       '.pbs-services-band .container > .eyebrow', '.pbs-services-band .container > h2',
       '.why-section .container > .eyebrow', '.why-section .container > h2'],
      [['.pbs-service', 4], ['.why-card', 3], ['.addl-item', 2], ['.carrier-logo', 5]], '.svc-photo');
    var links = $$('.svc-jump a[href^="#"]', svc);
    var spy = function () {
      var cur = null;
      links.forEach(function (a) {
        var el = document.getElementById(a.getAttribute('href').slice(1));
        if (el && el.getBoundingClientRect().top <= 120) cur = a;
      });
      links.forEach(function (a) {
        a.classList.toggle('is-active', a === cur);
        if (a === cur) a.setAttribute('aria-current', 'location'); else a.removeAttribute('aria-current');
      });
    };
    window.addEventListener('scroll', spy, { passive: true }); spy();
    var tg = document.getElementById('addl-toggle');
    if (tg) tg.addEventListener('click', function () {
      var open = tg.dataset.state !== 'open';
      $$('.addl-item', svc).forEach(function (d) { d.open = open; });
      tg.dataset.state = open ? 'open' : 'closed';
      tg.textContent = open ? 'Collapse all' : 'Expand all';
    });
  }

  /* ---------- About ---------- */
  initRv(document.getElementById('tab-about'),
    ['.ab-copy', '.ab-photo', '.ab-caption', '.ab-lead', '.ab-callout .container', '.ab-cta-inner',
     '.ab-approach .container > .eyebrow', '.ab-approach .container > h2'],
    [['.ab-tile', 0]]);

  /* ---------- Library: search ---------- */
  (function () {
    var input = document.getElementById('lib-search');
    if (!input) return;
    var cards = $$('#lib-grid .lib-card'), empty = document.getElementById('lib-empty');
    input.addEventListener('input', function () {
      var q = input.value.trim().toLowerCase(), shown = 0;
      cards.forEach(function (c) {
        var hit = !q || c.dataset.name.indexOf(q) !== -1 || c.textContent.toLowerCase().indexOf(q) !== -1;
        c.style.display = hit ? '' : 'none';
        if (hit) shown++;
      });
      empty.style.display = shown ? 'none' : 'block';
    });
  })();

  /* ---------- Contact ---------- */
  var ct = document.getElementById('tab-contact');
  if (ct) {
    initRv(ct, ['.ct-info > .eyebrow', '.ct-info > h2', '.ct-formwrap', '.ct-map'], [['.ct-card', 0]]);
    var form = document.getElementById('ct-form'), note = document.getElementById('ct-note');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var firstBad = null;
      $$('[required]', form).forEach(function (f) {
        var bad = !f.value.trim() || (f.type === 'email' && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(f.value));
        f.style.borderColor = bad ? 'var(--maroon)' : '';
        if (bad) { f.setAttribute('aria-invalid', 'true'); if (!firstBad) firstBad = f; } else { f.removeAttribute('aria-invalid'); }
      });
      note.hidden = false;
      if (firstBad) { note.textContent = 'Please add your name and a valid email so we can reply.'; firstBad.focus(); }
      else { note.textContent = 'Thanks! Your message looks good. (This form is not connected to email yet.)'; }
    });
  }

  /* ---------- Deep links: re-align after images/animations settle ---------- */
  if (location.hash.length > 1) {
    window.addEventListener('load', function () {
      var el = document.getElementById(decodeURIComponent(location.hash.slice(1)));
      if (el) setTimeout(function () { el.scrollIntoView(); }, 250);
    });
  }
})();
