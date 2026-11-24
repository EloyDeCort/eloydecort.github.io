/* ==========================================================================
   Eloy De Cort — site behaviour
   Vanilla JS: language switch, sticky header, mobile nav, scroll spy,
   reveal animations, project modals, copy-to-clipboard.
   ========================================================================== */
(function () {
  "use strict";

  var root = document.documentElement;
  root.classList.remove("no-js");
  root.classList.add("js");

  var reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ----------------------------------------------------------------------
     Language
     ---------------------------------------------------------------------- */
  var LANG_KEY = "edc-lang";

  function storedLang() {
    try { return window.localStorage.getItem(LANG_KEY); } catch (e) { return null; }
  }

  function preferredLang() {
    var stored = storedLang();
    if (stored === "en" || stored === "zh") return stored;
    var nav = (navigator.languages && navigator.languages[0]) || navigator.language || "";
    return /^zh/i.test(nav) ? "zh" : "en";
  }

  /* the CV follows the language: English PDF or 中文简历 */
  var CV_FILES = {
    en: "CV - Eloy De Cort - Senior Technical Audio Engineer.pdf",
    zh: "cv-zh/CV - Eloy De Cort - 技术音频工程师.pdf"
  };

  function applyCv(lang) {
    var links = document.querySelectorAll("a[data-cv]");
    Array.prototype.forEach.call(links, function (a) {
      a.setAttribute("href", CV_FILES[lang] || CV_FILES.en);
    });
  }

  function applyLang(lang, persist) {
    root.setAttribute("data-lang", lang);
    root.setAttribute("lang", lang === "zh" ? "zh-CN" : "en");
    if (persist) {
      try { window.localStorage.setItem(LANG_KEY, lang); } catch (e) {}
    }
    applyCv(lang);
    var options = document.querySelectorAll("[data-lang-opt]");
    Array.prototype.forEach.call(options, function (opt) {
      var on = opt.getAttribute("data-lang-opt") === lang;
      opt.setAttribute("aria-current", on ? "true" : "false");
    });
    var toggle = document.getElementById("langSwitch");
    if (toggle) {
      toggle.setAttribute(
        "aria-label",
        lang === "zh" ? "Switch to English" : "切换到中文"
      );
    }
  }

  applyLang(preferredLang(), false);

  var langSwitch = document.getElementById("langSwitch");
  if (langSwitch) {
    langSwitch.addEventListener("click", function () {
      applyLang(root.getAttribute("data-lang") === "zh" ? "en" : "zh", true);
    });
  }

  /* ----------------------------------------------------------------------
     Sticky header
     ---------------------------------------------------------------------- */
  var header = document.getElementById("siteHeader");
  var progress = document.getElementById("scrollProgress");
  var heroContent = document.querySelector(".hero-inner");
  var stuck = false;

  function onScrollHeader() {
    var y = window.scrollY;

    if (progress) {
      var max = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (max > 0 ? (y / max) * 100 : 0).toFixed(2) + "%";
    }

    /* hero content lifts away as you scroll past it */
    if (heroContent && !reducedMotion) {
      var ratio = Math.min(y / Math.max(window.innerHeight * 0.8, 1), 1);
      heroContent.style.transform = "translate3d(0," + (ratio * 70).toFixed(1) + "px,0)";
      heroContent.style.opacity = String(Math.max(0.08, 1 - ratio * 0.94));
    }

    var shouldStick = y > 24;
    if (shouldStick === stuck) return;
    stuck = shouldStick;
    header.classList.toggle("is-stuck", stuck);
  }
  window.addEventListener("scroll", onScrollHeader, { passive: true });
  onScrollHeader();

  /* ----------------------------------------------------------------------
     Mobile navigation
     ---------------------------------------------------------------------- */
  var nav = document.getElementById("primaryNav");
  var navToggle = document.getElementById("navToggle");

  function setNav(open) {
    if (!nav || !navToggle) return;
    nav.classList.toggle("is-open", open);
    navToggle.setAttribute("aria-expanded", open ? "true" : "false");
    navToggle.setAttribute("aria-label", open ? "Close menu" : "Open menu");
    document.body.classList.toggle("is-locked", open);
  }

  if (navToggle && nav) {
    navToggle.addEventListener("click", function () {
      setNav(!nav.classList.contains("is-open"));
    });

    nav.addEventListener("click", function (e) {
      var link = e.target.closest("a");
      if (link && !link.hasAttribute("download")) setNav(false);
    });
  }

  /* ----------------------------------------------------------------------
     Scroll spy
     ---------------------------------------------------------------------- */
  var navLinks = Array.prototype.slice.call(
    document.querySelectorAll("#primaryNav > a[href^='#']")
  );
  var spyTargets = navLinks
    .map(function (link) {
      var id = link.getAttribute("href").slice(1);
      var el = document.getElementById(id);
      return el ? { link: link, el: el } : null;
    })
    .filter(Boolean);

  if ("IntersectionObserver" in window && spyTargets.length) {
    var spy = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          navLinks.forEach(function (l) { l.classList.remove("is-active"); });
          var match = spyTargets.filter(function (t) { return t.el === entry.target; })[0];
          if (match) match.link.classList.add("is-active");
        });
      },
      { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
    );
    spyTargets.forEach(function (t) { spy.observe(t.el); });
  }

  /* ----------------------------------------------------------------------
     Reveal on scroll
     ---------------------------------------------------------------------- */
  var revealItems = Array.prototype.slice.call(document.querySelectorAll(".reveal"));

  if ("IntersectionObserver" in window && revealItems.length) {
    revealItems.forEach(function (el) {
      var siblings = el.parentElement
        ? Array.prototype.slice.call(el.parentElement.children)
        : [];
      var index = siblings.filter(function (s) { return s.classList.contains("reveal"); }).indexOf(el);
      el.style.setProperty("--i", Math.max(0, Math.min(index, 5)));
    });

    var revealer = new IntersectionObserver(
      function (entries, observer) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting) return;
          entry.target.classList.add("is-in");
          observer.unobserve(entry.target);
        });
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 }
    );

    revealItems.forEach(function (el) { revealer.observe(el); });
  } else {
    revealItems.forEach(function (el) { el.classList.add("is-in"); });
  }

  /* ----------------------------------------------------------------------
     Project modals
     ---------------------------------------------------------------------- */
  var FOCUSABLE =
    'a[href], button:not([disabled]), iframe, [tabindex]:not([tabindex="-1"])';
  var activeModal = null;
  var lastFocused = null;

  function loadFrames(modal) {
    Array.prototype.forEach.call(modal.querySelectorAll("iframe[data-src]"), function (frame) {
      if (!frame.getAttribute("src")) frame.setAttribute("src", frame.getAttribute("data-src"));
    });
  }

  /* Replacing the node is the only reliable way to stop playback and reset the
     frame: pointing src at about:blank while the modal is display:none can be
     deferred, which left audio playing and the player dead on the next open. */
  function unloadFrames(modal) {
    Array.prototype.forEach.call(modal.querySelectorAll("iframe[data-src]"), function (frame) {
      var fresh = frame.cloneNode(false);
      fresh.removeAttribute("src");
      if (frame.parentNode) frame.parentNode.replaceChild(fresh, frame);
    });
  }

  /* media strip inside a modal ------------------------------------------- */
  function mediaParts(modal) {
    var wrap = modal.querySelector(".modal-media-wrap");
    if (!wrap) return null;
    return {
      strip: wrap.querySelector(".modal-media"),
      frames: wrap.querySelectorAll(".media-frame"),
      prev: wrap.querySelector("[data-media-prev]"),
      next: wrap.querySelector("[data-media-next]"),
      count: wrap.querySelector("[data-media-count]")
    };
  }

  function syncMedia(modal) {
    var p = mediaParts(modal);
    if (!p || !p.strip || !p.strip.clientWidth) return;
    var total = p.frames.length;
    if (total < 2) {
      if (p.prev) p.prev.classList.add("is-hidden");
      if (p.next) p.next.classList.add("is-hidden");
      if (p.count) p.count.textContent = "";
      return;
    }
    var index = Math.round(p.strip.scrollLeft / p.strip.clientWidth) + 1;
    if (p.count) p.count.textContent = index + " / " + total;
    if (p.prev) p.prev.classList.toggle("is-hidden", index <= 1);
    if (p.next) p.next.classList.toggle("is-hidden", index >= total);
  }

  function bindMedia(modal) {
    var p = mediaParts(modal);
    if (!p || !p.strip) return;
    if (!p.strip.getAttribute("data-bound")) {
      p.strip.setAttribute("data-bound", "1");
      p.strip.addEventListener("scroll", function () { syncMedia(modal); }, { passive: true });
    }
    syncMedia(modal);
    window.setTimeout(function () {
      if (activeModal === modal) syncMedia(modal);
    }, 80);
  }

  function openModal(modal) {
    if (!modal || activeModal) return;
    lastFocused = document.activeElement;
    activeModal = modal;
    modal.hidden = false;
    loadFrames(modal);
    document.body.classList.add("is-locked");
    setNav(false);

    var scroller = modal.querySelector(".modal-scroll");
    if (scroller) scroller.scrollTop = 0;

    var strip = modal.querySelector(".modal-media");
    if (strip) strip.scrollLeft = 0;

    bindMedia(modal);

    var closeBtn = modal.querySelector(".modal-close");
    if (closeBtn) closeBtn.focus({ preventScroll: true });
  }

  function closeModal() {
    if (!activeModal) return;
    var modal = activeModal;
    activeModal = null;
    /* tear the players down while the modal is still visible */
    unloadFrames(modal);
    modal.hidden = true;
    document.body.classList.remove("is-locked");
    if (lastFocused && typeof lastFocused.focus === "function") {
      lastFocused.focus({ preventScroll: true });
    }
    lastFocused = null;
  }

  document.addEventListener("click", function (e) {
    var mediaBtn = e.target.closest("[data-media-prev], [data-media-next]");
    if (mediaBtn && activeModal) {
      var wrap = mediaBtn.closest(".modal-media-wrap");
      var strip = wrap && wrap.querySelector(".modal-media");
      if (strip) {
        var dir = mediaBtn.hasAttribute("data-media-next") ? 1 : -1;
        strip.scrollBy({ left: dir * strip.clientWidth, behavior: "smooth" });
      }
      return;
    }

    var opener = e.target.closest("[data-modal]");
    if (opener) {
      e.preventDefault();
      openModal(document.getElementById(opener.getAttribute("data-modal")));
      return;
    }
    if (e.target.closest("[data-close]")) {
      e.preventDefault();
      closeModal();
    }
  });

  document.addEventListener("keydown", function (e) {
    if (e.key === "Escape") {
      if (activeModal) closeModal();
      else if (nav && nav.classList.contains("is-open")) setNav(false);
      return;
    }

    if (e.key === "Tab" && activeModal) {
      var items = Array.prototype.filter.call(
        activeModal.querySelectorAll(FOCUSABLE),
        function (el) { return el.offsetParent !== null; }
      );
      if (!items.length) return;
      var first = items[0];
      var last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    }
  });

  /* ----------------------------------------------------------------------
     Copy email
     ---------------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-copy]"), function (btn) {
    var original = btn.innerHTML;
    var timer = null;

    btn.addEventListener("click", function () {
      var value = btn.getAttribute("data-copy");

      function done(ok) {
        btn.innerHTML = ok
          ? '<span class="l-en">Copied</span><span class="l-zh">已复制</span>'
          : '<span class="l-en">Press Ctrl+C</span><span class="l-zh">请按 Ctrl+C</span>';
        clearTimeout(timer);
        timer = setTimeout(function () { btn.innerHTML = original; }, 2000);
      }

      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(value).then(function () { done(true); }, function () { done(false); });
      } else {
        done(false);
      }
    });
  });

  /* ----------------------------------------------------------------------
     Count-up stats
     ---------------------------------------------------------------------- */
  var counters = Array.prototype.slice.call(document.querySelectorAll("[data-count]"));
  var statsBand = document.querySelector(".stats-band");

  function animateCount(el) {
    var target = parseInt(el.getAttribute("data-count"), 10) || 0;
    if (reducedMotion || target <= 0) {
      el.textContent = String(target);
      return;
    }
    var start = performance.now();
    var duration = 1200;
    function step(now) {
      var t = Math.min((now - start) / duration, 1);
      var eased = 1 - Math.pow(1 - t, 3);
      el.textContent = String(Math.round(target * eased));
      if (t < 1) window.requestAnimationFrame(step);
    }
    window.requestAnimationFrame(step);
  }

  if (counters.length && statsBand && "IntersectionObserver" in window) {
    var counted = false;
    var countObserver = new IntersectionObserver(
      function (entries) {
        entries.forEach(function (entry) {
          if (!entry.isIntersecting || counted) return;
          counted = true;
          counters.forEach(animateCount);
          countObserver.disconnect();
        });
      },
      { threshold: 0.35 }
    );
    countObserver.observe(statsBand);
  }

  /* ----------------------------------------------------------------------
     Cursor-tracked light sweep on project cards
     ---------------------------------------------------------------------- */
  if (window.matchMedia && window.matchMedia("(pointer: fine)").matches) {
    Array.prototype.forEach.call(document.querySelectorAll(".card"), function (card) {
      var media = card.querySelector(".card-media");
      if (!media) return;
      card.addEventListener("pointermove", function (e) {
        var rect = media.getBoundingClientRect();
        if (!rect.width || !rect.height) return;
        var x = ((e.clientX - rect.left) / rect.width) * 100;
        var y = ((e.clientY - rect.top) / rect.height) * 100;
        media.style.setProperty("--mx", x.toFixed(1) + "%");
        media.style.setProperty("--my", y.toFixed(1) + "%");
      });
    });
  }

  /* ----------------------------------------------------------------------
     Hero waveform — a dense audio signal spanning the full width
     ---------------------------------------------------------------------- */
  (function buildWave() {
    var group = document.getElementById("waveBars");
    if (!group) return;

    var W = 2400, MID = 80, MAXH = 148, NB = 210;
    var step = W / NB;
    var bw = step * 0.46;
    var seed = 20261124;
    function rnd() {
      seed = (seed * 1664525 + 1013904223) % 4294967296;
      return seed / 4294967296;
    }

    var NS = "http://www.w3.org/2000/svg";
    var frag = document.createDocumentFragment();

    for (var i = 0; i < NB; i++) {
      var x = i * step + (step - bw) / 2;

      /* broad swells across the take, plus a little grain */
      var env = 0.34 +
                0.24 * Math.sin(x / 330 + 1.1) +
                0.17 * Math.sin(x / 128 + 0.5) +
                0.09 * Math.sin(x / 54);
      env = Math.max(0.10, Math.min(1, env + (rnd() - 0.5) * 0.10));

      /* transient shape of each bar */
      var v = Math.abs(
        0.62 * Math.sin(x * 0.41 + 1.3) +
        0.38 * Math.sin(x * 1.17 + 0.4)
      );
      var h = Math.max(4, (0.16 + 0.84 * v) * env * MAXH);

      var r = document.createElementNS(NS, "rect");
      r.setAttribute("x", x.toFixed(1));
      r.setAttribute("y", (MID - h / 2).toFixed(1));
      r.setAttribute("width", bw.toFixed(2));
      r.setAttribute("height", h.toFixed(1));
      r.setAttribute("rx", (bw / 2).toFixed(2));
      frag.appendChild(r);
    }

    group.appendChild(frag);
  })();

  /* ----------------------------------------------------------------------
     Footer year
     ---------------------------------------------------------------------- */
  Array.prototype.forEach.call(document.querySelectorAll("[data-year]"), function (el) {
    el.textContent = String(new Date().getFullYear());
  });
})();
