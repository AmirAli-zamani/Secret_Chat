(function () {
    'use strict';

    const MAX_VISIBLE = 3;      // حداکثر ۳ پیام هم‌زمان
    const HIDE_AFTER = 5000;    // ۵ ثانیه
    const FADE_MS = 350;

    // ============================================================
    //               Queue Manager
    // ============================================================
    const queue = [];  // { el, timer }

    function dismiss(entry) {
        if (!entry || entry.dismissed) return;
        entry.dismissed = true;

        if (entry.timer) {
            clearTimeout(entry.timer);
            entry.timer = null;
        }

        const el = entry.el;
        if (!el || !el.parentNode) return;

        el.style.transition = `opacity ${FADE_MS}ms ease, transform ${FADE_MS}ms ease, max-height ${FADE_MS}ms ease, margin ${FADE_MS}ms ease, padding ${FADE_MS}ms ease`;
        el.style.opacity = '0';
        el.style.transform = 'translateY(-10px) scale(.96)';
        el.style.maxHeight = '0';
        el.style.marginTop = '0';
        el.style.marginBottom = '0';
        el.style.paddingTop = '0';
        el.style.paddingBottom = '0';
        el.style.overflow = 'hidden';

        setTimeout(() => {
            if (el.parentNode) el.remove();
            // حذف از صف
            const idx = queue.indexOf(entry);
            if (idx >= 0) queue.splice(idx, 1);
            // اگه صف خالی شد و کانتینر موند، پاکش کن
            cleanupContainer();
        }, FADE_MS + 30);
    }

    function dismissOldest() {
        // قدیمی‌ترین پیام رو بردار
        const oldest = queue.find(e => !e.dismissed);
        if (oldest) dismiss(oldest);
    }

    function cleanupContainer() {
        // اگه هیچ پیام زنده‌ای نمونده، کانتینرها رو حذف کن
        if (queue.filter(e => !e.dismissed).length === 0) {
            document.querySelectorAll('.messages-wrap, .chat-messages-global')
                .forEach(w => {
                    if (!w.querySelector('.chat-alert, .alert')) w.remove();
                });
        }
    }

    // ============================================================
    //               Close Button
    // ============================================================
    function attachCloseButton(entry) {
        const el = entry.el;
        if (el.querySelector('.auto-hide-close')) return;

        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'auto-hide-close';
        btn.innerHTML = '×';
        btn.title = 'بستن';
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            dismiss(entry);
        });
        el.style.position = 'relative';
        el.appendChild(btn);
    }

    // ============================================================
    //               Register Alert
    // ============================================================
    function registerAlert(el) {
        // اگه قبلاً ثبت شده، نادیده بگیر
        if (el.dataset.autoHideDone === '1') return;
        el.dataset.autoHideDone = '1';

        const entry = { el, timer: null, dismissed: false };
        queue.push(entry);

        attachCloseButton(entry);

        // اگه بیشتر از MAX_VISIBLE شد → قدیمی‌ترین رو بردار
        const active = queue.filter(e => !e.dismissed);
        while (active.length > MAX_VISIBLE) {
            const oldest = active.shift();
            dismiss(oldest);
        }

        // تایمر ۵ ثانیه
        entry.timer = setTimeout(() => dismiss(entry), HIDE_AFTER);
    }

    // ============================================================
    //               Boot
    // ============================================================
    function boot() {
        // چت (chat-alert داخل chat-messages-global)
        document.querySelectorAll('.chat-messages-global .chat-alert')
            .forEach(registerAlert);

        // لندینگ (messages-wrap .alert)
        document.querySelectorAll('.messages-wrap .alert')
            .forEach(registerAlert);

        // پیام‌های Django admin
        document.querySelectorAll('.messagelist li, ul.messagelist > li, .messages > li')
            .forEach((el) => {
                const entry = { el, timer: null, dismissed: false };
                queue.push(entry);
                entry.timer = setTimeout(() => dismiss(entry), HIDE_AFTER);
            });
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
