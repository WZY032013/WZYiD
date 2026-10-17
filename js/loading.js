/* ============================================
 * loading.js —— WZY 个人名片 · 加载动效运行时
 *
 * 暴露全局 LP：
 *   LP.splash     启动页（真实进度 / 会话内只出现一次）
 *   LP.top        顶部进度条 start() / set(p) / done()
 *   LP.optimistic 乐观 UI（复制等提交型交互：先上屏 → 确认 / 失败可重试）
 *
 * 真实进度来源（本项目实际存在的加载成本）：
 *   1. DOM 就绪
 *   2. 样式表就绪
 *   3. geo.js 地理数据解析完成（window.GEO_POLYS 就绪）——本项目最重的一块
 *   4. canvas 粒子背景完成首帧绘制
 * 不做假进度循环；无外部依赖；尊重 prefers-reduced-motion。
 * ============================================ */
(function (w, d) {
    'use strict';
    if (w.LP) return;

    var KEY = 'wzy.splash.v1';
    var reduce = w.matchMedia && w.matchMedia('(prefers-reduced-motion: reduce)').matches;

    function $(id) { return d.getElementById(id); }
    function nextFrame(fn) { w.requestAnimationFrame(function () { w.requestAnimationFrame(fn); }); }

    /* ==========================================================
     * 1. 启动页 Splash —— 真实进度
     * ========================================================== */
    var splash = (function () {
        var host = null, bar = null, pctEl = null, stageEl = null;        var total = 4, doneSteps = 0, finished = false, guardTimer = null;

        function build() {
            if (host) return;
            host = d.createElement('div');
            host.id = 'lpSplash';
            host.setAttribute('role', 'status');
            host.setAttribute('aria-live', 'polite');
            host.innerHTML =
                '<div class="lp-mark">' +
                    '<div class="lp-spinner"></div>' +
                    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round">' +
                        '<circle cx="12" cy="12" r="9"/>' +
                        '<path d="M3 12h18M12 3c2.6 2.6 2.6 15.4 0 18M12 3c-2.6 2.6-2.6 15.4 0 18"/>' +
                    '</svg>' +
                '</div>' +
                '<div class="lp-word"><div class="lp-title">DEVELOPER</div>' +
                '<div class="lp-sub">WZY · 个人名片</div></div>' +
                '<div class="lp-bar"><i></i></div>' +
                '<div class="lp-pct">0%</div>' +
                '<div class="lp-stage">正在准备…</div>';
            d.body.appendChild(host);
            bar = host.querySelector('.lp-bar');
            pctEl = host.querySelector('.lp-pct');
            stageEl = host.querySelector('.lp-stage');
        }

        function paint() {
            var p = Math.max(0, Math.min(1, doneSteps / total));
            // 进度条走transform: scaleX(var(--p))（GPU 友好），不动画 width
            if (bar) bar.style.setProperty('--p', p.toFixed(4));
            if (pctEl) pctEl.textContent = Math.round(p * 100) + '%';
        }

        return {
            /** 立即构建启动页节点（供外部在 DOM 就绪后按需调用） */
            build: build,
            steps: function (n) { if (n > 0) { total = n; paint(); } },
            /** 完成一步（必须由真实事件调用） */
            step: function (label) {
                if (finished) return;
                doneSteps++;
                if (label && stageEl) stageEl.textContent = label;
                paint();
            },
            say: function (label) { if (!finished && stageEl) stageEl.textContent = label; },
            /** 关闭启动页：淡出 + 轻微放大 */
            done: function (cb) {
                if (finished) { if (cb) cb(); return; }
                finished = true;
                clearTimeout(guardTimer);
                doneSteps = total;
                paint();
                if (stageEl) stageEl.textContent = '就绪';
                var finish = function () {
                    if (!host) return;
                    host.classList.add('lp-gone');
                    setTimeout(function () { if (host && host.parentNode) host.parentNode.removeChild(host); }, 540);
                    if (cb) cb();
                };
                try { w.sessionStorage.setItem(KEY, '1'); } catch (e) { }
                if (reduce) { finish(); return; }
                setTimeout(finish, 240);
            },
            guard: function () {
                clearTimeout(guardTimer);
                guardTimer = setTimeout(function () { splash.done(); }, 6000);
            },
            get finished() { return finished; }
        };
    })();

    /** 启动流程（真实进度，共 4 步），会话内只出现一次 */
    function mountSplash() {
        // 本项目的启动页依赖首页独有的旋转地球（canvas + geo.js 数据）；
        // projects.html / resume.html 无此结构，直接跳过启动页，避免空等兜底超时。
        if (!$('particleCanvas')) {
            try { w.sessionStorage.setItem(KEY, '1'); } catch (e) { }
            return;
        }
        var seen = false;
        try { seen = w.sessionStorage.getItem(KEY) === '1'; } catch (e) { }
        if (seen) return;

        try { w.sessionStorage.setItem(KEY, '1'); } catch (e) { }
        splash.build();
        splash.guard();

        splash.step('正在读取名片…');                        // 1. DOM 就绪

        // 2. 样式表就绪
        if (d.styleSheets && d.styleSheets.length) splash.step('正在铺设版式…');
        else nextFrame(function () { splash.step('正在铺设版式…'); });

        // 3. geo.js 地理数据解析完成（本项目最重的加载成本）
        splash.say('正在装载地理数据…');

        // 4. canvas 首帧绘制完成
        var tries = 0;
        (function poll() {
            var geoReady = !!(w.GEO_POLYS && w.GEO_POLYS.length);
            var canvas = $('particleCanvas');
            var canvasReady = !!(canvas && canvas.width > 0 && canvas.height > 0);
            if (geoReady) splash.step('正在装载地理数据…');
            if (geoReady && canvasReady) {
                splash.step('正在点亮地球…');
                nextFrame(function () { splash.done(); });
                return;
            }
            if (++tries > 220) {                // 兜底：约 3.7s 后不再遮挡界面
                splash.done();
                return;
            }
            w.requestAnimationFrame(poll);
        })();
    }

    /* ==========================================================
     * 2. 顶部进度条
     * ========================================================== */
    var top = (function () {
        var host = null, hideTimer = null, raf = null;
        function build() {
            if (host) return;
            host = d.createElement('div');
            host.id = 'lpTop';
            host.setAttribute('aria-hidden', 'true');
            host.appendChild(d.createElement('i'));   // 填充条：scaleX(var(--p))
            host.appendChild(d.createElement('b'));   // 头部亮点：与填充条同duration/easing 收尾
            d.body.appendChild(host);
        }
        function apply(p) {
            host.style.setProperty('--p', Math.max(0, Math.min(1, p)).toFixed(4));
        }
        return {
            /** 开始：不确定时长，渐近推进到 0.9 */
            start: function () {
                build();
                clearTimeout(hideTimer);
                w.cancelAnimationFrame(raf);
                host.classList.remove('lp-done');
                host.classList.add('lp-on');
                if (reduce) { apply(0.9); return; }
                var p = 0;
                var tick = function () {
                    p += (0.9 - p) * 0.18;
                    apply(p);
                    if (p < 0.9) raf = w.requestAnimationFrame(tick);
                };
                raf = w.requestAnimationFrame(tick);
            },
            /** 设定真实进度（0~1） */
            set: function (p) { if (!host) build(); w.cancelAnimationFrame(raf); apply(p); },
            /** 完成：补满后淡出 */
            done: function (delay) {
                if (!host) return;
                w.cancelAnimationFrame(raf);
                apply(1);
                clearTimeout(hideTimer);
                hideTimer = setTimeout(function () {
                    host.classList.add('lp-done');
                    host.classList.remove('lp-on');
                }, delay == null ? 200 : delay);
            }
        };
    })();

    /* ==========================================================
     * 3. 乐观 UI —— 提交型交互（复制账号 / 打开外链）
     * ========================================================== */
    var optimistic = (function () {
        var host = null, ico = null, txt = null, actBtn = null;
        var hideTimer = null, retryFn = null;

        var ICONS = {
            pending: '<path d="M12 3a9 9 0 1 1-9 9" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>',
            ok: '<path d="M5 12.5l4.5 4.5L19 7.5" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/>',
            fail: '<path d="M12 7v6M12 16.5v.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>'
        };

        function build() {
            if (host) return;
            host = d.createElement('div');
            host.id = 'lpOptimistic';
            host.setAttribute('role', 'status');
            host.setAttribute('aria-live', 'polite');
            host.innerHTML =
                '<svg class="lp-ico" viewBox="0 0 24 24">' + ICONS.pending + '</svg>' +
                '<span class="lp-txt"></span>' +
                '<button class="lp-act" type="button" hidden>重试</button>';
            d.body.appendChild(host);
            ico = host.querySelector('.lp-ico');
            txt = host.querySelector('.lp-txt');
            actBtn = host.querySelector('.lp-act');
            actBtn.addEventListener('click', function () {
                if (retryFn) { var f = retryFn; retryFn = null; f(); }
            });
        }

        function show(state, msg, retry) {
            build();
            clearTimeout(hideTimer);
            host.className = 'lp-on lp-' + state;
            ico.innerHTML = ICONS[state] || ICONS.pending;
            txt.textContent = msg;
            if (retry) { retryFn = retry; actBtn.hidden = false; }
            else { retryFn = null; actBtn.hidden = true; }
        }

        return {
            /** 乐观上屏 */
            pending: function (msg, retry) { show('pending', msg || '处理中…', retry); },
            /** 成功确认 */
            ok: function (msg) {
                show('ok', msg || '已完成');
                hideTimer = setTimeout(function () { if (host) host.classList.remove('lp-on'); }, 2400);
            },
            /** 失败回滚 + 重试 */
            fail: function (msg, retry) {
                show('fail', msg || '操作失败', retry);
                hideTimer = setTimeout(function () { if (host) host.classList.remove('lp-on'); }, retry ? 8000 : 3000);
            },
            hide: function () { if (host) host.classList.remove('lp-on'); }
        };
    })();

    /* ==========================================================
     * 4. 自动挂载层
     * ========================================================== */

    /**
     * 复制按钮 → 乐观 UI：点击瞬间即上屏「正在复制…」，
     * 结果由 main.js 复制完成后派发的 `card:copy` 事件驱动（真实回执，非定时猜测）；
     * 若事件始终未到（老缓存/脚本异常），3s 后兜底收尾，不会永久悬挂。
     * 项目原本用 #toast 反馈，此处由气泡统一承载（并收起原生 toast，避免双重提示）。
     */
    function watchCopyButtons() {
        var btns = d.querySelectorAll('[data-account]');
        if (!btns.length) return;

        var cur = null;   // 当前在飞的复制请求：{ btn, platform, account, timer }

        /**收敛一次复制请求。
         *  注意顺序：必须先把 timer/btn 取到局部变量，再把 cur 置 null；
         *  若先置 null 再读 cur.timer 会抛 TypeError，导致 ok/fail 永不执行、气泡永久悬挂。 */
        var settle = function (ok, platform, account) {
            if (!cur) return;
            var btn = cur.btn;
            var tmr = cur.timer;
            cur = null;
            if (tmr) clearTimeout(tmr);

            var t = $('toast');
            // 收起原生 toast，由气泡统一承载反馈
            if (t) { t.classList.remove('show'); clearTimeout(t._lpHide); }

            if (ok) {
                optimistic.ok('已复制' + (platform || '') + '号：' + (account || ''));
            } else {
                optimistic.fail('复制失败，请重试', function () { btn.click(); });
            }
        };

        // main.js 派发的真实回执；detail 缺失时按 ok 处理（仅影响文案）
        d.addEventListener('card:copy', function (e) {
            var det = (e && e.detail) || {};
            // 连点不同平台时，丢弃与当前请求不对应的迟到回执，避免串状态
            if (cur && det.account && det.account !== cur.account) return;
            settle(det.ok !== false, det.platform, det.account);
        });

        Array.prototype.forEach.call(btns, function (btn) {
            btn.addEventListener('click', function () {
                // 有外链的按钮走 window.open，无需乐观反馈
                if (btn.getAttribute('data-link')) return;
                var platform = btn.getAttribute('data-platform') || '社交';
                var account = btn.getAttribute('data-account') || '';

                // 上一请求若仍在飞（连点），先按“已取消”收敛，避免旧 timer 残留
                if (cur) {
                    if (cur.timer) clearTimeout(cur.timer);
                    cur = null;
                }

                cur = { btn: btn, platform: platform, account: account, timer: null };
                optimistic.pending('正在复制' + platform + '号…');
                // 兜底：main.js 未派发事件时也要收敛，不让气泡永久悬挂
                cur.timer = w.setTimeout(function () { settle(true, platform, account); }, 3000);
            }, true);
        });
    }

    /** 视图/页面切换（同页锚点滚动）→ 顶部进度条 */
    function watchNav() {
        d.addEventListener('click', function (e) {
            var a = e.target && e.target.closest ? e.target.closest('.nav-link') : null;
            if (!a) return;
            var href = a.getAttribute('href') || '';
            if (href.charAt(0) !== '#') return;      // 跨页跳转交给浏览器
            top.start();
            w.requestAnimationFrame(function () {
                w.requestAnimationFrame(function () { top.done(180); });
            });
        }, true);
    }

    /** 资源加载（图片等）→ 顶部进度条，用真实在途请求驱动 */
    function watchImages() {
        var imgs = d.querySelectorAll('img');
        if (!imgs.length) return;
        var inflight = 0, shown = false;
        Array.prototype.forEach.call(imgs, function (img) {
            if (img.complete) return;
            inflight++;
            if (!shown && !seenSplash()) { shown = true; top.start(); }
            var settle = function () {
                inflight--;
                if (inflight <= 0) top.done(200);
            };
            img.addEventListener('load', settle, { once: true });
            img.addEventListener('error', settle, { once: true });
        });
    }
    function seenSplash() {
        try { return w.sessionStorage.getItem(KEY) === '1'; } catch (e) { return false; }
    }

    /* ---------------- 导出 ---------------- */
    w.LP = {
        version: '1.0.0',
        splash: splash,
        top: top,
        optimistic: optimistic,
        reduce: reduce
    };

    if (d.body) { mountSplash(); watchCopyButtons(); watchNav(); watchImages(); }
    else d.addEventListener('DOMContentLoaded', function () {
        mountSplash(); watchCopyButtons(); watchNav(); watchImages();
    }, { once: true });
})(window, document);