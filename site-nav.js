/* =========================================================================
   Legend of Fenrirak — nav bar behaviour + shared scroll-experience kit.

   Every feature below checks for its own element before doing anything,
   so pages that don't use a feature (Home, AfterShowdowns) are completely
   unaffected — only About and Creators currently use the pop-in-on-scroll
   animation, progress thread, back-to-top and lightbox.

   Further down: a matching set of opt-in accents — a hover brighten and
   push-tilt, an ambient cursor light, a soothing drifting glow, scroll
   parallax, and a scroll-scrubbed text glow — following the exact same
   rule.
   ========================================================================= */

(function () {
    'use strict';

    // Quick sanity check for testing: open DevTools > Console. If this
    // line isn't there, the browser is running a different site-nav.js
    // than the one you think it is (almost always a caching issue) —
    // nothing below matters until that's fixed first.
    if (window.console) console.log('[site-nav.js] loaded — build 2026-09-02e');

    var reduceMotion = window.matchMedia &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ---- Games dropdown (hover on desktop is CSS-only; this adds
       tap/click toggling for touch screens, plus Escape to close) ------- */
    function initGamesMenu() {
        var groups = Array.prototype.slice.call(document.querySelectorAll('.nav-group'));
        if (!groups.length) return;

        function closeAll(except) {
            groups.forEach(function (g) {
                if (g === except) return;
                g.classList.remove('open');
                var t = g.querySelector('.nav-trigger');
                if (t) t.setAttribute('aria-expanded', 'false');
            });
        }

        groups.forEach(function (group) {
            var trigger = group.querySelector('.nav-trigger');
            if (!trigger) return;

            trigger.addEventListener('click', function (e) {
                e.preventDefault();
                var willOpen = !group.classList.contains('open');
                closeAll(group);
                group.classList.toggle('open', willOpen);
                trigger.setAttribute('aria-expanded', willOpen ? 'true' : 'false');
            });
        });

        document.addEventListener('click', function (e) {
            if (!e.target.closest || !e.target.closest('.nav-group')) closeAll(null);
        });

        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape') closeAll(null);
        });
    }

    /* ---- keep --topbar-h in sync, so each section's scroll-margin-top
       clears the real bar height, whatever that is at the current
       screen size ----------------------------------------------------- */
    function initStickyOffset() {
        var bar = document.querySelector('.topbar');
        if (!bar) return;

        function measure() {
            document.documentElement.style.setProperty('--topbar-h', bar.offsetHeight + 'px');
        }

        measure();
        window.addEventListener('resize', measure);
        if (window.ResizeObserver) new ResizeObserver(measure).observe(bar);
    }

    /* ---- pop-in-as-you-scroll ------------------------------------------
       True scroll-scrubbed reveal: every ".pop-in" element's opacity and
       position are recalculated on every scroll frame, directly from how
       far its GROUP (the whole chapter/topic it belongs to, e.g. one
       game) has scrolled up through the viewport — not a fixed-duration
       animation that gets triggered once and then plays on its own, and
       not each item's own position either. Stop scrolling halfway and
       everything sits at exactly that halfway point; scroll back up and
       it fades back down together. It's driven by the scrollbar the same
       way the word-by-word brightening on a page like Jesko Jets is.

       Reveal is computed from the GROUP's top, shared by every item in
       it (plus a small per-item pixel offset purely so a row cascades
       left-to-right instead of popping in all at once), rather than each
       item's own top. A chapter is routinely taller than the viewport —
       heading and intro copy at the top, a button and a row of photos
       at the bottom — and item-by-item reveal meant the bottom images
       only finished fading in once you'd scrolled well past the top of
       the chapter, so by the time everything was visible the heading
       had already scrolled away. Tying reveal to the group's own
       entrance means the whole chapter finishes fading in shortly after
       it appears, all together — further scrolling into a tall chapter
       is then just reading it, not still waiting on it to render.

       No CSS class or rule ever hides this content — the only thing that
       ever sets its opacity is this function actually running. So if
       this script is ever blocked entirely, nothing is hidden in the
       first place; the page is simply static, not broken. ------------- */
    function initPopIn() {
        var groups = Array.prototype.slice.call(document.querySelectorAll('.pop-group'));
        if (!groups.length) return;

        var groupEntries = groups.map(function (group) {
            var items = Array.prototype.slice.call(group.querySelectorAll('.pop-in'));
            return {
                group: group,
                items: items.map(function (el, i) { return { el: el, offset: i * 22 }; })
            };
        }).filter(function (g) { return g.items.length; });
        if (!groupEntries.length) return;

        if (reduceMotion) {
            groupEntries.forEach(function (g) {
                g.items.forEach(function (entry) { entry.el.style.opacity = 1; });
            });
            return;
        }

        function update() {
            var vh = window.innerHeight;
            var startY = vh * 0.92;
            var endY = vh * 0.50;

            groupEntries.forEach(function (g) {
                // One rect read per GROUP, not per item — this is also
                // cheaper than the old item-by-item version once a
                // chapter has more than a couple of images in it.
                var groupTop = g.group.getBoundingClientRect().top;

                g.items.forEach(function (entry) {
                    var top = groupTop + entry.offset;
                    var progress = (startY - top) / (startY - endY);
                    if (progress < 0) progress = 0;
                    else if (progress > 1) progress = 1;

                    if (progress >= 1) {
                        /* Fully revealed: clear the inline styles rather than
                           setting them to their "settled" values, so this
                           element's own CSS (e.g. a :hover lift on a button)
                           can take over again. An inline style always wins
                           over a stylesheet rule, even one saying "none". */
                        entry.el.style.opacity = '';
                        entry.el.style.transform = '';
                    } else {
                        /* Floored at 0.3, never 0 — matches the floor
                           initRevealText already uses (0.25) below. An
                           element below the fold gets this opacity the
                           moment the page loads, before any scroll event
                           fires, and Google's renderer doesn't scroll the
                           page for you: leaving this at literal 0 meant
                           every image in every .pop-group (most of the
                           images on the page) rendered fully invisible on
                           first load, which is exactly the kind of hidden
                           content Google Images skips over. A 0.3 floor
                           keeps the same fade-and-slide-up effect for real
                           visitors while guaranteeing nothing is ever
                           actually invisible in the rendered DOM. */
                        entry.el.style.opacity = 0.3 + progress * 0.7;
                        entry.el.style.transform = 'translateY(' + (26 * (1 - progress)) + 'px)';
                    }
                });
            });
        }

        var ticking = false;
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () { update(); ticking = false; });
                ticking = true;
            }
        }

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);

        /* Images loading in changes page layout after the fact — re-run
           once each one settles so positions (and thus reveal state)
           stay accurate instead of drifting from what's on screen. */
        document.querySelectorAll('img').forEach(function (img) {
            if (!img.complete) img.addEventListener('load', onScroll, { once: true });
        });
    }

    /* ---- top scroll-progress thread ------------------------------------ */
    function initProgress() {
        var bar = document.querySelector('.scroll-progress');
        if (!bar) return;

        var ticking = false;
        function update() {
            var doc = document.documentElement;
            var max = doc.scrollHeight - doc.clientHeight;
            var pct = max > 0 ? (doc.scrollTop / max) * 100 : 0;
            bar.style.width = pct + '%';
            ticking = false;
        }
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(update);
                ticking = true;
            }
        }
        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
    }

    /* ---- floating back-to-top ------------------------------------------ */
    function initBackToTop() {
        var btn = document.querySelector('.back-to-top');
        if (!btn) return;

        function onScroll() {
            btn.classList.toggle('visible', window.scrollY > 500);
        }
        onScroll();
        window.addEventListener('scroll', onScroll, { passive: true });

        btn.addEventListener('click', function (e) {
            e.preventDefault();
            window.scrollTo({ top: 0, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    }

    /* ---- lightbox -------------------------------------------------------
       Any <img class="lightbox-trigger"> opens an enlarged view on click. */
    function initLightbox() {
        var triggers = Array.prototype.slice.call(document.querySelectorAll('.lightbox-trigger'));
        if (!triggers.length) return;

        var overlay = document.createElement('div');
        overlay.className = 'lightbox-overlay';
        overlay.innerHTML =
            '<button type="button" class="lightbox-close" aria-label="Close image">&times;</button>' +
            '<img alt="">';
        document.body.appendChild(overlay);

        var img = overlay.querySelector('img');
        var closeBtn = overlay.querySelector('.lightbox-close');
        var lastFocused = null;

        function open(src, alt) {
            lastFocused = document.activeElement;
            img.src = src;
            img.alt = alt || '';
            overlay.classList.add('open');
            closeBtn.focus();
        }
        function close() {
            overlay.classList.remove('open');
            img.src = '';
            if (lastFocused && lastFocused.focus) lastFocused.focus();
        }

        triggers.forEach(function (t) {
            t.addEventListener('click', function () {
                open(t.currentSrc || t.src, t.alt);
            });
        });

        overlay.addEventListener('click', function (e) {
            if (e.target === overlay) close();
        });
        closeBtn.addEventListener('click', close);
        document.addEventListener('keydown', function (e) {
            if (e.key === 'Escape' && overlay.classList.contains('open')) close();
        });
    }

    /* ---- cursor-tracked push-tilt (hover) --------------------------------
       .tilt-hover computes a small perspective tilt from the pointer's
       position inside the element and pushes the opposite way — hover
       near the left edge and it leans right, near the bottom and it
       leans up, so it reads as being "pushed" from wherever the cursor
       is rather than tilting the same fixed way every time. rAF-
       throttled so a fast mouse can't queue up more style writes than
       the browser can paint. (.glow-hover has nothing to set up here —
       it's a plain CSS :hover/:focus-within brighten now.) */
    function initTiltHover() {
        var tiltEls = Array.prototype.slice.call(document.querySelectorAll('.tilt-hover'));
        if (reduceMotion || !tiltEls.length) return;

        function bindTilt(el) {
            var maxDeg = 9;
            var frame = null, rotX = 0, rotY = 0;
            function apply() {
                el.style.transform = 'perspective(600px) rotateX(' + rotX.toFixed(2) +
                    'deg) rotateY(' + rotY.toFixed(2) + 'deg)';
                frame = null;
            }
            el.addEventListener('mousemove', function (e) {
                var rect = el.getBoundingClientRect();
                var px = (e.clientX - rect.left) / rect.width - 0.5;
                var py = (e.clientY - rect.top) / rect.height - 0.5;
                rotX = -py * maxDeg * 2;
                rotY = px * maxDeg * 2;
                if (!frame) frame = window.requestAnimationFrame(apply);
            });
            el.addEventListener('mouseleave', function () {
                rotX = 0; rotY = 0;
                el.style.transform = 'perspective(600px) rotateX(0deg) rotateY(0deg)';
            });
        }

        tiltEls.forEach(bindTilt);
    }

    /* ---- soothing wave glow (always on) ------------------------------------
       Builds one .dye-layer + .dye-blob pair per .dye-hover element. The
       blob's ring shape and its bright crest both come from CSS (the
       conic-gradient plus the mask that carves out a band the shape of
       the card's own rounded rectangle); all this does is nudge the
       gradient's --dye-angle custom property forward a small amount on
       a slow timer, which is what makes the bright crest crawl smoothly
       around that band rather than sit still. Updating --dye-angle
       forces the browser to repaint .dye-blob's gradient and re-run
       .dye-layer's blur on the result (a changing background can't ride
       the compositor the way a transform can), so this deliberately
       does that on a ~90ms timer rather than every animation frame —
       at this rotation speed the jump between steps is far too small
       to see, but it cuts the repaint work to a small fraction of what
       60fps would cost. Under prefers-reduced-motion the ring is still
       inserted (so it's still visible) but --dye-angle is left at its
       CSS default and never updated, so the crest holds at one fixed
       spot instead of travelling. */
    function initDyeField() {
        var hosts = Array.prototype.slice.call(document.querySelectorAll('.dye-hover'));
        if (!hosts.length) return;

        var DEGREES_PER_MS = 360 / 16000; // one slow, smooth lap every ~16s
        var STEP_MS = 90;                 // how often --dye-angle actually updates

        hosts.forEach(function (host) {
            var layer = document.createElement('div');
            layer.className = 'dye-layer';
            var blob = document.createElement('div');
            blob.className = 'dye-blob';
            layer.appendChild(blob);
            // Behind the card's own in-flow content regardless of DOM
            // order (see the z-index: -1 rule), but inserted first anyway
            // so the source order matches the paint order for anyone
            // reading the markup later.
            host.insertBefore(layer, host.firstChild);
            if (reduceMotion) return;

            var angle = Math.random() * 360; // each card starts its crest at a different spot

            window.setInterval(function () {
                angle = (angle + STEP_MS * DEGREES_PER_MS) % 360;
                blob.style.setProperty('--dye-angle', angle.toFixed(2) + 'deg');
            }, STEP_MS);
        });
    }

    /* ---- ambient ember light ---------------------------------------------
       A single .ember-field div drifts a soft radial light toward the
       cursor. Position eases toward the pointer each frame (a simple lerp)
       rather than snapping straight to it, so it reads as something with
       a little weight — an ember drifting on its own air currents, not a
       spotlight glued to the mouse. */
    function initEmberField() {
        var field = document.querySelector('.ember-field');
        if (!field || reduceMotion) return;

        var targetX = 0, targetY = 0, curX = 0, curY = 0, raf = null;

        function tick() {
            curX += (targetX - curX) * 0.08;
            curY += (targetY - curY) * 0.08;
            field.style.setProperty('--ex', curX.toFixed(1) + 'px');
            field.style.setProperty('--ey', curY.toFixed(1) + 'px');

            if (Math.abs(targetX - curX) > 0.5 || Math.abs(targetY - curY) > 0.5) {
                raf = window.requestAnimationFrame(tick);
            } else {
                raf = null;
            }
        }

        window.addEventListener('mousemove', function (e) {
            targetX = e.clientX - window.innerWidth / 2;
            targetY = e.clientY - window.innerHeight / 2;
            if (!raf) raf = window.requestAnimationFrame(tick);
        }, { passive: true });
    }

    /* ---- scroll parallax drift --------------------------------------- */
    function initParallax() {
        var els = Array.prototype.slice.call(document.querySelectorAll('.parallax'));
        if (!els.length || reduceMotion) return;

        var items = els.map(function (el) {
            var speed = parseFloat(el.getAttribute('data-speed'));
            return { el: el, speed: isNaN(speed) ? 0.2 : speed };
        });

        function update() {
            var mid = window.innerHeight / 2;
            items.forEach(function (item) {
                var rect = item.el.getBoundingClientRect();
                var offset = (mid - (rect.top + rect.height / 2)) * item.speed;
                item.el.style.transform = 'translateY(' + offset.toFixed(1) + 'px)';
            });
        }

        var ticking = false;
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () { update(); ticking = false; });
                ticking = true;
            }
        }

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
    }

    /* ---- scroll-scrubbed text glow ----------------------------------------
       Splits each .reveal-text element into one <span class="word"> per
       word (plain text only — see the CSS comment for why) and brightens
       them in sequence as the block travels through the reveal band. Same
       scrub-not-trigger philosophy as initPopIn above: this is recomputed
       from scratch every frame from the element's live position, never a
       one-shot animation, so scrolling back up dims words back down. */
    function initRevealText() {
        var blocks = Array.prototype.slice.call(document.querySelectorAll('.reveal-text'));
        if (!blocks.length) return;

        var entries = blocks.map(function (block) {
            var pieces = block.textContent.split(/(\s+)/);
            block.textContent = '';
            pieces.forEach(function (chunk) {
                if (chunk === '') return;
                if (/^\s+$/.test(chunk)) {
                    block.appendChild(document.createTextNode(chunk));
                } else {
                    var span = document.createElement('span');
                    span.className = 'word';
                    span.textContent = chunk;
                    block.appendChild(span);
                }
            });
            return { el: block, words: Array.prototype.slice.call(block.querySelectorAll('.word')) };
        });

        if (reduceMotion) {
            entries.forEach(function (entry) {
                entry.words.forEach(function (w) { w.style.opacity = 1; });
            });
            return;
        }

        function update() {
            var vh = window.innerHeight;
            /* Band is 1/6 of the screen tall, and fully resolved once
               the block's TOP reaches the bottom 1/4 of the screen
               (i.e. 3/4 of the way down). This is deliberately based
               only on screen position, not the block's own height —
               tying it to rect.height instead (as an earlier version
               did) made tall blocks finish revealing while still up
               around the middle of the screen, since a lot of scroll
               distance passes between a tall block's top and bottom. */
            var revealEnd = vh * 0.75;
            var revealStart = revealEnd + vh / 6;

            entries.forEach(function (entry) {
                var rect = entry.el.getBoundingClientRect();
                var progress = (revealStart - rect.top) / (revealStart - revealEnd);
                if (progress < 0) progress = 0;
                else if (progress > 1) progress = 1;

                var lit = progress * entry.words.length;
                entry.words.forEach(function (word, i) {
                    var diff = lit - i;
                    var op;
                    if (diff <= 0) op = 0.25;
                    else if (diff >= 1) op = 1;
                    else op = 0.25 + diff * 0.75;
                    word.style.opacity = op;
                });
            });
        }

        var ticking = false;
        function onScroll() {
            if (!ticking) {
                window.requestAnimationFrame(function () { update(); ticking = false; });
                ticking = true;
            }
        }

        update();
        window.addEventListener('scroll', onScroll, { passive: true });
        window.addEventListener('resize', onScroll);
    }

    function init() {
        initGamesMenu();
        initStickyOffset();
        initPopIn();
        initProgress();
        initBackToTop();
        initLightbox();
        initTiltHover();
        initEmberField();
        initDyeField();
        initParallax();
        initRevealText();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
