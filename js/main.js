/* ============================================
   WZY - 旋转地球 · 真实陆地轮廓 · 绿色主题
   使用 canvas clip() 消除闪烁线
   修复: 透明黑块 → 用页面底色填充 canvas 背景
   ============================================ */

(function () {
    'use strict';

    var canvas = document.getElementById('particleCanvas');
    if (!canvas) { return; }
    var ctx = canvas.getContext('2d');
    if (!ctx) { return; }

    var GEO = window.GEO_POLYS || [];

    /* ---- 预处理地理数据：转弧度 ---- */
    var polys = [];
    (function preprocess() {
        for (var p = 0; p < GEO.length; p++) {
            var rings = [];
            for (var r = 0; r < GEO[p].length; r++) {
                var ring = GEO[p][r];
                var pts = [];
                for (var i = 0; i < ring.length; i++) {
                    pts.push({
                        phi: (90 - ring[i][1]) * Math.PI / 180,
                        theta: ring[i][0] * Math.PI / 180
                    });
                }
                rings.push(pts);
            }
            polys.push(rings);
        }
    })();

    var R = 0, cx = 0, cy = 0;
    var rotY = 0, rotX = 0.22;
    var autoSpeed = -0.10;
    var userDragging = false;
    var lastX = 0, userVelX = 0;

    var animId = null, lastTime = 0;
    var isReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* 正交投影 */
    function proj3(pt) {
        var sp = Math.sin(pt.phi), cp = Math.cos(pt.phi);
        var th = pt.theta + rotY;
        var x = sp * Math.sin(th);
        var y = cp;
        var z = sp * Math.cos(th);

        var cosX = Math.cos(rotX), sinX = Math.sin(rotX);
        var y2 = y * cosX - z * sinX;
        var z2 = y * sinX + z * cosX;

        return { x: cx + x * R, y: cy - y2 * R, z: z2 };
    }

    /* 把环按正面(z>0)/背面拆成段 */
    function splitRing(ring) {
        var front = [], back = [], cur = [], curFront = null;
        for (var i = 0; i < ring.length; i++) {
            var pr = proj3(ring[i]);
            var f = pr.z > 0;
            if (curFront === null) { curFront = f; cur = [pr]; }
            else if (f === curFront) { cur.push(pr); }
            else {
                if (cur.length > 1) (curFront ? front : back).push(cur);
                curFront = f;
                cur = [pr];
            }
        }
        if (cur.length > 1) (curFront ? front : back).push(cur);
        return { front: front, back: back };
    }

    /* 沿球缘弧线封口（代替直线弦，消除斜切带伪影） */
    function rimClose(seg) {
        var a0 = Math.atan2(seg[0].y - cy, seg[0].x - cx);
        var a1 = Math.atan2(seg[seg.length - 1].y - cy, seg[seg.length - 1].x - cx);
        var d = a0 - a1;
        while (d > Math.PI) d -= 2 * Math.PI;
        while (d < -Math.PI) d += 2 * Math.PI;
        ctx.arc(cx, cy, R, a1, a1 + d, d < 0);
    }

    /* 添加段路径（open=true 仅海岸线不封口） */
    function addSegs(segs, open) {
        for (var s = 0; s < segs.length; s++) {
            var seg = segs[s];
            ctx.moveTo(seg[0].x, seg[0].y);
            for (var k = 1; k < seg.length; k++) ctx.lineTo(seg[k].x, seg[k].y);
            if (!open) { rimClose(seg); ctx.closePath(); }
        }
    }

    /* ---- 绘制 ---- */
    function drawGlobe() {
        var w = window.innerWidth;
        var h = window.innerHeight;

        /* 用页面底色填充，阻止后面 section 透出来 */
        ctx.fillStyle = '#08080c';
        ctx.fillRect(0, 0, w, h);

        var isMobile = w < 768;
        R = Math.min(h * 0.32, w * (isMobile ? 0.36 : 0.24));
        cx = isMobile ? w * 0.5 : w * 0.76;
        cy = isMobile ? h * 0.7 : h * 0.5;

        /* 外发光 */
        var glow = ctx.createRadialGradient(cx, cy, R * 0.85, cx, cy, R * 1.6);
        glow.addColorStop(0, 'rgba(74, 222, 128, 0.18)');
        glow.addColorStop(0.5, 'rgba(74, 222, 128, 0.06)');
        glow.addColorStop(1, 'rgba(74, 222, 128, 0)');
        ctx.fillStyle = glow;
        ctx.beginPath();
        ctx.arc(cx, cy, R * 1.6, 0, Math.PI * 2);
        ctx.fill();

        /* 球体玻璃底 */
        var inner = ctx.createRadialGradient(cx - R * 0.28, cy - R * 0.28, R * 0.05, cx, cy, R);
        inner.addColorStop(0, 'rgba(74, 222, 128, 0.04)');
        inner.addColorStop(0.75, 'rgba(74, 222, 128, 0.015)');
        inner.addColorStop(1, 'rgba(74, 222, 128, 0.04)');
        ctx.fillStyle = inner;
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.fill();

        /* 拆段 */
        var frontSegs = [], backSegs = [];
        for (var p = 0; p < polys.length; p++) {
            for (var r = 0; r < polys[p].length; r++) {
                var s = splitRing(polys[p][r]);
                for (var f = 0; f < s.front.length; f++) frontSegs.push(s.front[f]);
                for (var b = 0; b < s.back.length; b++) backSegs.push(s.back[b]);
            }
        }

        /* 圆形裁剪 */
        ctx.save();
        ctx.beginPath();
        ctx.arc(cx, cy, R - 0.5, 0, Math.PI * 2);
        ctx.clip();

        /* === 背面大陆（透明透视，极淡） === */
        ctx.beginPath();
        addSegs(backSegs, false);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.05)';
        ctx.fill();
        ctx.beginPath();
        addSegs(backSegs, true);
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.12)';
        ctx.lineWidth = 0.7;
        ctx.stroke();

        /* === 正面大陆 - 填充（弧线封口，nonzero 合并重叠） === */
        ctx.beginPath();
        addSegs(frontSegs, false);
        ctx.fillStyle = 'rgba(74, 222, 128, 0.2)';
        ctx.fill();

        /* === 正面大陆 - 描边（仅海岸线） === */
        ctx.beginPath();
        addSegs(frontSegs, true);
        ctx.lineJoin = 'round';
        ctx.lineCap = 'round';
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.9)';
        ctx.lineWidth = 1.1;
        ctx.stroke();

        ctx.restore();

        /* 地球轮廓 */
        ctx.beginPath();
        ctx.arc(cx, cy, R, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(74, 222, 128, 0.65)';
        ctx.lineWidth = 1.5;
        ctx.stroke();
    }

    /* ---- 动画 ---- */
    function animate(timestamp) {
        if (!lastTime) lastTime = timestamp;
        var dt = Math.min(0.05, (timestamp - lastTime) / 1000);
        lastTime = timestamp;

        if (!userDragging) {
            if (Math.abs(userVelX) > 0.0001) {
                rotY += userVelX * dt;
                userVelX *= 0.95;
            } else {
                rotY += autoSpeed * dt;
                userVelX = 0;
            }
        }

        drawGlobe();
        animId = requestAnimationFrame(animate);
    }

    function getPos(e) {
        if (e.touches && e.touches[0]) return { x: e.touches[0].clientX, y: e.touches[0].clientY };
        if (e.changedTouches && e.changedTouches[0]) return { x: e.changedTouches[0].clientX, y: e.changedTouches[0].clientY };
        return { x: e.clientX, y: e.clientY };
    }

    function onDown(e) {
        var p = getPos(e);
        var dx = p.x - cx, dy = p.y - cy;
        if (Math.sqrt(dx * dx + dy * dy) > R * 1.3) return;
        userDragging = true;
        lastX = p.x;
        userVelX = 0;
        e.preventDefault();
    }

    function onMove(e) {
        if (!userDragging) return;
        var p = getPos(e);
        var dx = p.x - lastX;
        lastX = p.x;
        rotY += dx * 0.005;
        userVelX = dx * 0.005;
        e.preventDefault();
    }

    function onUp() {
        userDragging = false;
        userVelX = userVelX * 0.5;
    }

    var listenersBound = false;

    function resizeCanvas() {
        var dpr = Math.min(window.devicePixelRatio || 1, 2);
        var w = window.innerWidth, h = window.innerHeight;
        canvas.width = w * dpr;
        canvas.height = h * dpr;
        canvas.style.width = w + 'px';
        canvas.style.height = h + 'px';
        ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    function start() {
        if (isReducedMotion) return;
        resizeCanvas();

        if (!listenersBound) {
            listenersBound = true;
            canvas.addEventListener('mousedown', onDown);
            canvas.addEventListener('mousemove', onMove);
            canvas.addEventListener('mouseup', onUp);
            canvas.addEventListener('mouseleave', onUp);
            canvas.addEventListener('touchstart', onDown, { passive: false });
            canvas.addEventListener('touchmove', onMove, { passive: false });
            canvas.addEventListener('touchend', onUp);
            window.addEventListener('resize', resizeCanvas);
        }

        if (animId) cancelAnimationFrame(animId);
        lastTime = 0;
        animId = requestAnimationFrame(animate);
    }

    function stop() {
        if (animId) { cancelAnimationFrame(animId); animId = null; }
    }

    document.addEventListener('visibilitychange', function () {
        if (document.hidden) stop();
        else start();
    });

    /* ---------- DOM 交互 ---------- */
    var navbar = document.getElementById('navbar');
    var navToggle = document.getElementById('navToggle');
    var navMenu = document.getElementById('navMenu');
    var navLinks = document.querySelectorAll('.nav-link');
    var socialBtns = document.querySelectorAll('.social-btn');
    var toast = document.getElementById('toast');
    var sections = document.querySelectorAll('section[id]');
    var toastTimer = null;

    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { toast.classList.remove('show'); }, 2200);
    }

    function copyToClipboard(text) {
        if (navigator.clipboard && window.isSecureContext) {
            return navigator.clipboard.writeText(text).then(function () { return true; }).catch(function () { return fallbackCopy(text); });
        }
        return Promise.resolve(fallbackCopy(text));
    }

    function fallbackCopy(text) {
        try {
            var ta = document.createElement('textarea');
            ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
            document.body.appendChild(ta); ta.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(ta);
            return ok;
        } catch (e) { return false; }
    }

    navToggle.addEventListener('click', function () { navToggle.classList.toggle('open'); navMenu.classList.toggle('open'); });
    navLinks.forEach(function (link) { link.addEventListener('click', function () { navToggle.classList.remove('open'); navMenu.classList.remove('open'); }); });

    function onScroll() {
        var sy = window.scrollY;
        navbar.classList.toggle('scrolled', sy > 20);

        var fade = Math.max(0, 1 - sy / (window.innerHeight * 0.55));
        canvas.style.opacity = fade;
        canvas.style.pointerEvents = fade < 0.1 ? 'none' : 'auto';

        if (fade < 0.02) {
            stop();
        } else if (!animId && !document.hidden) {
            lastTime = 0;
            animId = requestAnimationFrame(animate);
        }

        var scrollY = sy + 100, current = '';
        sections.forEach(function (s) { if (scrollY >= s.offsetTop && scrollY < s.offsetTop + s.offsetHeight) current = s.id; });
        navLinks.forEach(function (l) { l.classList.toggle('active', l.getAttribute('href') === '#' + current); });
    }
    window.addEventListener('scroll', onScroll, { passive: true });

    socialBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var account = btn.dataset.account, platform = btn.dataset.platform, link = btn.dataset.link;
            if (link) { window.open(link, '_blank', 'noopener,noreferrer'); return; }
            copyToClipboard(account).then(function (ok) {
                showToast(ok ? '已复制' + platform + '号：' + account : '复制失败');
            });
        });
    });

    var revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry, index) {
                if (entry.isIntersecting) {
                    setTimeout(function () { entry.target.classList.add('visible'); }, index * 80);
                    observer.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -40px 0px' });
        revealElements.forEach(function (el) { observer.observe(el); });
    } else {
        revealElements.forEach(function (el) { el.classList.add('visible'); });
    }

    onScroll();
    start();
})();
