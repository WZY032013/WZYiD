/* ============================================
   WZY 个人名片 - 交互脚本
   ============================================ */

(function () {
    'use strict';

    /* ---------- DOM 元素 ---------- */
    var navbar = document.getElementById('navbar');
    var navToggle = document.getElementById('navToggle');
    var navMenu = document.getElementById('navMenu');
    var navLinks = document.querySelectorAll('.nav-link');
    var socialBtns = document.querySelectorAll('.social-btn');
    var toast = document.getElementById('toast');
    var sections = document.querySelectorAll('section[id]');

    var toastTimer = null;

    /* ---------- Toast 提示 ---------- */
    function showToast(message) {
        toast.textContent = message;
        toast.classList.add('show');
        if (toastTimer) clearTimeout(toastTimer);
        toastTimer = setTimeout(function () {
            toast.classList.remove('show');
        }, 2200);
    }

    /* ---------- 复制到剪贴板 ---------- */
    function copyToClipboard(text) {
        return new Promise(function (resolve) {
            if (navigator.clipboard && window.isSecureContext) {
                navigator.clipboard.writeText(text).then(function () {
                    resolve(true);
                }).catch(function () {
                    resolve(fallbackCopy(text));
                });
            } else {
                resolve(fallbackCopy(text));
            }
        });
    }

    function fallbackCopy(text) {
        try {
            var textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            var ok = document.execCommand('copy');
            document.body.removeChild(textarea);
            return ok;
        } catch (err) {
            return false;
        }
    }

    /* ---------- 移动端菜单切换 ---------- */
    navToggle.addEventListener('click', function () {
        navToggle.classList.toggle('open');
        navMenu.classList.toggle('open');
    });

    // 点击菜单项后关闭移动端菜单
    navLinks.forEach(function (link) {
        link.addEventListener('click', function () {
            navToggle.classList.remove('open');
            navMenu.classList.remove('open');
        });
    });

    /* ---------- 导航栏滚动效果 ---------- */
    function onScroll() {
        if (window.scrollY > 20) {
            navbar.classList.add('scrolled');
        } else {
            navbar.classList.remove('scrolled');
        }
        updateActiveNav();
    }

    window.addEventListener('scroll', onScroll, { passive: true });

    /* ---------- 滚动时高亮当前导航项 ---------- */
    function updateActiveNav() {
        var scrollY = window.scrollY + 100;
        var current = '';
        sections.forEach(function (section) {
            var top = section.offsetTop;
            var height = section.offsetHeight;
            if (scrollY >= top && scrollY < top + height) {
                current = section.getAttribute('id');
            }
        });
        navLinks.forEach(function (link) {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    }

    /* ---------- 社交按钮点击 ---------- */
    socialBtns.forEach(function (btn) {
        btn.addEventListener('click', function () {
            var account = btn.dataset.account;
            var platform = btn.dataset.platform;
            var link = btn.dataset.link;

            // 如果有链接（如小红书），直接跳转
            if (link) {
                window.open(link, '_blank', 'noopener,noreferrer');
                return;
            }

            // 否则复制账号
            copyToClipboard(account).then(function (ok) {
                if (ok) {
                    showToast('已复制' + platform + '号：' + account);
                } else {
                    showToast('复制失败，请手动复制：' + account);
                }
            });
        });
    });

    /* ---------- 滚动渐入动画 ---------- */
    var revealElements = document.querySelectorAll('.reveal');
    if ('IntersectionObserver' in window) {
        var observer = new IntersectionObserver(function (entries) {
            entries.forEach(function (entry, index) {
                if (entry.isIntersecting) {
                    setTimeout(function () {
                        entry.target.classList.add('visible');
                    }, index * 80);
                    observer.unobserve(entry.target);
                }
            });
        }, {
            threshold: 0.15,
            rootMargin: '0px 0px -40px 0px'
        });

        revealElements.forEach(function (el) { observer.observe(el); });
    } else {
        revealElements.forEach(function (el) { el.classList.add('visible'); });
    }

    /* ---------- 初始化 ---------- */
    onScroll();
})();
