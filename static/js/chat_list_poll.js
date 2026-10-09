(function () {
    const app = document.querySelector('.chat-app');
    if (!app) return;

    // فقط روی صفحه‌ی لیست اجرا شو (نه چت‌روم)
    if (app.dataset.currentPage !== 'list') return;

    const peersEl = document.getElementById('chatPeers');
    const csrf = document.querySelector('meta[name="csrf-token"]').content;
    if (!peersEl) return;

    const POLL_VISIBLE = 3000;   // ۳ ثانیه وقتی تب فعاله
    const POLL_HIDDEN = 8000;    // ۸ ثانیه وقتی مخفیه

    const baseTitle = document.title.replace(/^\(\d+\)\s*/, '');

    // صدای اعلان
    let audioCtx = null;
    function playBeep() {
        try {
            if (!audioCtx) {
                audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            }
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain);
            gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.12, audioCtx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
        } catch (e) { /* ignore */ }
    }

    function escapeHtml(s) {
        return (s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    function buildItem(p) {
        const initial = (p.username[0] || '?').toUpperCase();
        return `
            <a href="${p.url}" class="chat-peer-item">
                <div class="chat-avatar sm">${initial}</div>
                <div class="chat-peer-info">
                    <div class="chat-peer-top">
                        <span class="chat-peer-name">${escapeHtml(p.username)}</span>
                        ${p.time ? `<span class="chat-peer-time">${escapeHtml(p.time)}</span>` : ''}
                    </div>
                    <div class="chat-peer-bottom">
                        <span class="chat-peer-preview">${escapeHtml(p.preview)}</span>
                        ${p.unread ? `<span class="chat-unread">${p.unread}</span>` : ''}
                    </div>
                </div>
            </a>
        `;
    }

    function buildEmpty() {
        return `
            <div class="chat-empty-peers">
                <div class="chat-empty-icon">💬</div>
                <p>هنوز با کسی چت نکردی.</p>
                <p class="small">از کادر بالا یه ID وارد کن یا جست‌وجو کن.</p>
            </div>
        `;
    }

    let lastUnread = 0;
    let firstLoad = true;

    function updateTitle(totalUnread) {
        if (totalUnread > 0) {
            document.title = `(${totalUnread}) ${baseTitle}`;
        } else {
            document.title = baseTitle;
        }
    }

    function render(peers) {
        // ناحیه‌ی اسکرول کاربر رو حفظ کن (اگه نزدیک بالا بود، برگردون)
        const oldScroll = peersEl.scrollTop;

        if (!peers.length) {
            peersEl.innerHTML = buildEmpty();
        } else {
            peersEl.innerHTML = peers.map(buildItem).join('');
        }

        // حفظ اسکرول
        peersEl.scrollTop = oldScroll;
    }

    async function poll() {
        try {
            const r = await fetch('/welcome/api/peers/', {
                cache: 'no-store',
                headers: { 'X-CSRFToken': csrf },
            });
            if (r.status === 403) {
                // سشن تموم شده → برو به صفحه‌ی ورود
                window.location.href = '/auth/';
                return;
            }
            if (!r.ok) return;

            const data = await r.json();
            const peers = data.peers || [];
            const totalUnread = data.total_unread || 0;

            render(peers);
            updateTitle(totalUnread);

            // اگه پیام خوانده‌نشده زیاد شده → بوق
            if (!firstLoad && totalUnread > lastUnread) {
                playBeep();
                // نوتیفیکیشن مرورگر
                if (document.hidden && 'Notification' in window && Notification.permission === 'granted') {
                    try {
                        new Notification('پیام جدید در گلبو', {
                            body: 'یه پیام جدید داری 💬',
                            tag: 'chat-list-unread',
                        });
                    } catch (e) { /* ignore */ }
                }
            }
            lastUnread = totalUnread;
            firstLoad = false;

        } catch (e) {
            // خطای شبکه — ignore، دفعه‌ی بعد تلاش می‌کنه
        }
    }

    let timer = null;
    function schedule() {
        if (timer) clearTimeout(timer);
        const interval = document.hidden ? POLL_HIDDEN : POLL_VISIBLE;
        timer = setTimeout(async () => {
            await poll();
            schedule();
        }, interval);
    }

    // اجرا
    poll();
    schedule();

    // وقتی تب برگشت → فوری چک کن
    document.addEventListener('visibilitychange', () => {
        if (!document.hidden) poll();
    });
    window.addEventListener('focus', () => poll());

    // درخواست مجوز نوتیفیکیشن
    if ('Notification' in window && Notification.permission === 'default') {
        Notification.requestPermission().catch(() => {});
    }
})();
