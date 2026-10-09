(function () {
    const app = document.querySelector('.chat-app');
    if (!app || !app.dataset.peer) return;

    const peer = app.dataset.peer;
    const csrf = document.querySelector('meta[name="csrf-token"]').content;
    const messagesEl = document.getElementById('chatMessages');
    const form = document.getElementById('chatForm');
    const textInput = document.getElementById('chatText');
    const fileInput = document.getElementById('chatFile');
    const sendBtn = form.querySelector('.chat-send-btn');
    const peerStatus = document.getElementById('peerStatus');

    const modal = document.getElementById('attachModal');
    const modalMedia = document.getElementById('attachModalMedia');
    const modalCaption = document.getElementById('attachModalCaption');
    const modalSend = document.getElementById('attachModalSend');
    const modalHint = document.getElementById('attachModalHint');

    const replyBar = document.getElementById('replyBar');
    const replyBarName = document.getElementById('replyBarName');
    const replyBarText = document.getElementById('replyBarText');
    const replyCancelBtn = document.getElementById('replyCancelBtn');

    const msgMenu = document.getElementById('msgMenu');

    let lastId = parseInt(app.dataset.lastId || '0', 10);
    let stagedFile = null;
    let stagedFileType = null;
    let stagedFileObjectUrl = null;
    let sending = false;
    let currentReplyTo = null;

    // === Typing Indicator ===
    let typingSendTimer = null;      // debounce برای ارسال
    let typingResetTimer = null;     // پاک کردن خودکار بعد 3 ثانیه
    let typingHideTimer = null;      // پنهان کردن UI طرف مقابل
    let isTypingShown = false;       // آیا «در حال تایپ» نشون داده می‌شه

    const POLL_VISIBLE = 600;
    const POLL_HIDDEN = 3000;

    // ============================================================
    function scrollBottom() { messagesEl.scrollTop = messagesEl.scrollHeight; }
    scrollBottom();

    function fmtBytes(n) {
        if (n < 1024) return n + ' B';
        if (n < 1024 * 1024) return (n / 1024).toFixed(1) + ' KB';
        return (n / 1024 / 1024).toFixed(1) + ' MB';
    }
    function escapeHtml(s) {
        return (s || '').replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[c]));
    }

    // ============================================================
    //                     REPLY BAR
    // ============================================================
    function setReply(msgEl) {
        const id = msgEl.dataset.id;
        const sender = msgEl.classList.contains('mine') ? 'خودت' : peer;

        // استخراج متن پیام
        let preview = '';
        const textBubble = msgEl.querySelector('.msg-bubble:not(.msg-media)');
        const media = msgEl.querySelector('.msg-media');
        const caption = msgEl.querySelector('.msg-caption');

        if (textBubble) {
            preview = textBubble.textContent.trim().slice(0, 100);
        } else if (media) {
            if (media.querySelector('img')) preview = '🖼️ تصویر';
            else if (media.querySelector('video')) preview = '🎬 ویدیو';
            if (caption) {
                const capText = caption.textContent.trim();
                if (capText) preview += ' • ' + capText.slice(0, 60);
            }
        }

        currentReplyTo = { id, sender, preview };

        replyBarName.textContent = sender;
        replyBarText.textContent = preview || '—';
        replyBar.hidden = false;
        textInput.focus();
    }

    // اکسپورت برای استفاده‌ی swipe to reply
    window.__chatSetReply = setReply;

    function clearReply() {
        currentReplyTo = null;
        replyBar.hidden = true;
        replyBarName.textContent = '—';
        replyBarText.textContent = '—';
    }

    if (replyCancelBtn) {
        replyCancelBtn.addEventListener('click', clearReply);
    }

    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape' && !replyBar.hidden && modal.hidden) {
            clearReply();
        }
    });

    // ============================================================
    //                     MSG MENU (right-click / long-press)
    // ============================================================
    let longPressTimer = null;

    function openMenu(x, y, msgEl) {
        // موقعیت منو
        msgMenu.hidden = false;
        const menuW = 170;
        const menuH = 90;
        const vw = window.innerWidth;
        const vh = window.innerHeight;

        let left = x;
        let top = y;
        if (left + menuW > vw - 8) left = vw - menuW - 8;
        if (top + menuH > vh - 8) top = vh - menuH - 8;

        msgMenu.style.left = left + 'px';
        msgMenu.style.top = top + 'px';
        msgMenu.dataset.targetMsgId = msgEl.dataset.id;
    }

    function closeMenu() {
        msgMenu.hidden = true;
        delete msgMenu.dataset.targetMsgId;
    }

    // Context menu (right-click)
    messagesEl.addEventListener('contextmenu', (e) => {
        const msgEl = e.target.closest('.msg');
        if (!msgEl) return;
        e.preventDefault();
        openMenu(e.clientX, e.clientY, msgEl);
    });

    // Long-press (mobile)
    messagesEl.addEventListener('touchstart', (e) => {
        const msgEl = e.target.closest('.msg');
        if (!msgEl) return;
        const touch = e.touches[0];
        longPressTimer = setTimeout(() => {
            openMenu(touch.clientX, touch.clientY, msgEl);
            // هپتیک اگه پشتیبانی شد
            if (navigator.vibrate) navigator.vibrate(20);
        }, 500);
    }, { passive: true });

    const cancelLongPress = () => {
        if (longPressTimer) {
            clearTimeout(longPressTimer);
            longPressTimer = null;
        }
    };
    messagesEl.addEventListener('touchend', cancelLongPress);
    messagesEl.addEventListener('touchmove', cancelLongPress);
    messagesEl.addEventListener('touchcancel', cancelLongPress);

    // کلیک بیرون → بستن
    document.addEventListener('click', (e) => {
        if (!msgMenu.hidden && !msgMenu.contains(e.target)) {
            closeMenu();
        }
    });

    // اسکرول → بستن
    messagesEl.addEventListener('scroll', () => {
        if (!msgMenu.hidden) closeMenu();
    });

    // ============================================================
    //                     MENU ACTIONS
    // ============================================================
    msgMenu.addEventListener('click', (e) => {
        const item = e.target.closest('.msg-menu-item');
        if (!item) return;

        const action = item.dataset.action;
        const targetId = msgMenu.dataset.targetMsgId;
        const msgEl = messagesEl.querySelector(`.msg[data-id="${targetId}"]`);

        closeMenu();

        if (!msgEl) return;

        if (action === 'reply') {
            setReply(msgEl);
        } else if (action === 'copy') {
            const textBubble = msgEl.querySelector('.msg-bubble:not(.msg-media)');
            const caption = msgEl.querySelector('.msg-caption');
            const text = (textBubble ? textBubble.textContent : '') ||
                         (caption ? caption.textContent : '');
            if (text) {
                navigator.clipboard.writeText(text.trim())
                    .then(() => {
                        item.querySelector('span:last-child').textContent = '✅ کپی شد';
                        setTimeout(() => {
                            item.querySelector('span:last-child').textContent = 'کپی متن';
                        }, 1500);
                    })
                    .catch(() => {});
            }
        }
    });

    // کلیک روی خود حباب ریپلای → اسکرول به پیام اصلی
    messagesEl.addEventListener('click', (e) => {
        const replyQuote = e.target.closest('.msg-reply');
        if (!replyQuote) return;
        const targetId = replyQuote.dataset.replyTo;
        if (!targetId) return;
        const target = messagesEl.querySelector(`.msg[data-id="${targetId}"]`);
        if (!target) return;
        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
        target.classList.add('has-reply-highlight');
        setTimeout(() => target.classList.remove('has-reply-highlight'), 1300);
    });

    // ============================================================
    //                     MODAL (existing)
    // ============================================================
    function openModal(file) {
        modalMedia.innerHTML = '';
        modalCaption.value = '';
        modalHint.textContent = '';

        const isVideo = file.type.startsWith('video/');
        stagedFileType = isVideo ? 'video' : 'image';

        if (stagedFileObjectUrl) URL.revokeObjectURL(stagedFileObjectUrl);
        stagedFileObjectUrl = URL.createObjectURL(file);

        if (isVideo) {
            const v = document.createElement('video');
            v.src = stagedFileObjectUrl;
            v.controls = true; v.autoplay = true; v.playsInline = true;
            modalMedia.appendChild(v);
        } else {
            const img = document.createElement('img');
            img.src = stagedFileObjectUrl;
            img.alt = 'پیش‌نمایش';
            modalMedia.appendChild(img);
        }

        stagedFile = file;
        modalHint.textContent = `${file.name}  •  ${fmtBytes(file.size)}`;

        modal.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => modal.classList.add('open'));
        setTimeout(() => modalCaption.focus(), 220);
    }

    function closeModal() {
        modal.classList.remove('open');
        setTimeout(() => {
            modal.hidden = true;
            modalMedia.innerHTML = '';
            modalCaption.value = '';
            modalHint.textContent = '';
            stagedFile = null;
            stagedFileType = null;
            if (stagedFileObjectUrl) {
                URL.revokeObjectURL(stagedFileObjectUrl);
                stagedFileObjectUrl = null;
            }
            fileInput.value = '';
            document.body.style.overflow = '';
        }, 220);
    }

    modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-close]')) {
            e.preventDefault();
            closeModal();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!modal.hidden && e.key === 'Escape') {
            e.preventDefault();
            closeModal();
        }
    });

    // ============================================================
    //                     FILE PICK
    // ============================================================
    fileInput.addEventListener('change', () => {
        const f = fileInput.files[0];
        if (!f) return;
        if (f.size > 25 * 1024 * 1024) {
            alert('حجم فایل نباید بیشتر از ۲۵ مگابایت باشه');
            fileInput.value = '';
            return;
        }
        openModal(f);
    });

    // ============================================================
    //                     SEND FILE
    // ============================================================
    modalSend.addEventListener('click', () => {
        if (!stagedFile || sending) return;
        const caption = (modalCaption.value || '').trim();
        sendMessage(caption, stagedFile, true);
    });

    modalCaption.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (stagedFile && !sending) {
                const caption = (modalCaption.value || '').trim();
                sendMessage(caption, stagedFile, true);
            }
        }
    });

    // ============================================================
    //                     SEND TEXT
    // ============================================================
    form.addEventListener('submit', (e) => {
        e.preventDefault();
        if (sending) return;
        const text = textInput.value.trim();
        if (!text) return;
        sendMessage(text, null, false);
    });

    textInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            form.dispatchEvent(new Event('submit', { cancelable: true }));
        }
    });

    // ============================================================
    //                     SEND CORE
    // ============================================================
    function sendMessage(text, file, fromModal) {
        sending = true;
        sendBtn.disabled = true;
        if (modalSend) modalSend.disabled = true;

        const fd = new FormData();
        if (text) fd.append('text', text);
        if (file) fd.append('file', file);
        if (currentReplyTo) fd.append('reply_to', currentReplyTo.id);

        fetch(`/welcome/api/send/${encodeURIComponent(peer)}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf },
            body: fd,
        })
        .then(r => r.ok ? r.json() : r.json().then(err => Promise.reject(err)))
        .then(data => {
            if (data.ok && data.message) {
                appendMessage(data.message);
                clearReply();
                stopTypingSignal();   // ← توقف نشانگر تایپ
                if (fromModal) {
                    closeModal();
                } else {
                    textInput.value = '';
                }
                poll();
            }
        })
        .catch(err => {
            alert('خطا: ' + (err && err.error ? err.error : 'ارسال نشد'));
        })
        .finally(() => {
            sending = false;
            sendBtn.disabled = false;
            if (modalSend) modalSend.disabled = false;
            if (!fromModal) textInput.focus();
        });
    }

    // ============================================================
    //                     BUILD & APPEND
    // ============================================================
    function buildReplyHtml(reply) {
        if (!reply) return '';
        const senderLabel = reply.mine ? 'خودت' : reply.sender;
        let preview;
        if (reply.type === 'text') {
            preview = escapeHtml(reply.text || '');
        } else if (reply.type === 'image') {
            preview = '🖼️ تصویر';
        } else if (reply.type === 'video') {
            preview = '🎬 ویدیو';
        } else {
            preview = '';
        }
        const thumb = (reply.type === 'image' && reply.file_url)
            ? `<img class="msg-reply-thumb" src="${reply.file_url}" alt="">`
            : '';
        return `<div class="msg-reply" data-reply-to="${reply.id}">
            <div class="msg-reply-bar"></div>
            ${thumb}
            <div class="msg-reply-body">
                <div class="msg-reply-sender">${escapeHtml(senderLabel)}</div>
                <div class="msg-reply-text">${preview}</div>
            </div>
        </div>`;
    }

    function buildMsgHtml(m) {
        const mine = m.mine ? 'mine' : 'theirs';
        let inner = '';

        const replyHtml = buildReplyHtml(m.reply_to);

        if (m.type === 'text') {
            inner = `<div class="msg-bubble">${escapeHtml(m.text)}</div>`;
        } else if (m.type === 'image') {
            inner = `<div class="msg-bubble msg-media">
                <a href="${m.file_url}">
                    <img src="${m.file_url}" alt="تصویر" loading="lazy">
                </a>
                ${m.text ? `<div class="msg-caption">${escapeHtml(m.text)}</div>` : ''}
            </div>`;
        } else if (m.type === 'video') {
            inner = `<div class="msg-bubble msg-media">
                <video controls preload="metadata" src="${m.file_url}"></video>
                ${m.text ? `<div class="msg-caption">${escapeHtml(m.text)}</div>` : ''}
            </div>`;
        }
        return `<div class="msg ${mine}" data-id="${m.id}">
            <div class="swipe-hint">↩</div>
            ${replyHtml}
            ${inner}
            <div class="msg-meta">
                <span>${m.time}</span>
                ${m.mine ? '<span class="msg-tick">✓✓</span>' : ''}
            </div>
        </div>`;
    }

    function appendMessage(m) {
        if (document.querySelector(`.msg[data-id="${m.id}"]`)) return;
        messagesEl.insertAdjacentHTML('beforeend', buildMsgHtml(m));
        if (m.id > lastId) lastId = m.id;
        scrollBottom();
    }

    // ============================================================
    //                     BEEP
    // ============================================================
    let audioCtx = null;
    function playBeep() {
        try {
            if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
            const osc = audioCtx.createOscillator();
            const gain = audioCtx.createGain();
            osc.connect(gain); gain.connect(audioCtx.destination);
            osc.type = 'sine';
            osc.frequency.setValueAtTime(880, audioCtx.currentTime);
            osc.frequency.exponentialRampToValueAtTime(660, audioCtx.currentTime + 0.12);
            gain.gain.setValueAtTime(0.001, audioCtx.currentTime);
            gain.gain.exponentialRampToValueAtTime(0.15, audioCtx.currentTime + 0.02);
            gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.18);
            osc.start(audioCtx.currentTime);
            osc.stop(audioCtx.currentTime + 0.2);
        } catch (e) {}
    }

    // ============================================================
    //                  TYPING INDICATOR
    // ============================================================
    function sendTypingSignal() {
        fetch(`/welcome/api/typing/${encodeURIComponent(peer)}/`, {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf },
        }).catch(() => {});
    }

    function onUserTyping() {
        // اگه خیلی وقته سیگنال نفرستادیم، فوری بفرست
        if (!typingSendTimer) {
            sendTypingSignal();
            // هر 1.5 ثانیه دوباره بفرست (تا وقتی کاربر داره تایپ می‌کنه)
            typingSendTimer = setInterval(() => {
                sendTypingSignal();
            }, 1500);
        }

        // ریست تایمر توقف
        if (typingResetTimer) clearTimeout(typingResetTimer);
        typingResetTimer = setTimeout(() => {
            stopTypingSignal();
        }, 2500);
    }

    function stopTypingSignal() {
        if (typingSendTimer) {
            clearInterval(typingSendTimer);
            typingSendTimer = null;
        }
        if (typingResetTimer) {
            clearTimeout(typingResetTimer);
            typingResetTimer = null;
        }
    }

    // اتصال به رویداد input
    textInput.addEventListener('input', () => {
        const text = textInput.value.trim();
        if (text.length > 0) {
            onUserTyping();
        } else {
            stopTypingSignal();
        }
    });

    // وقتی پیام فرستادیم → توقف
    // (داخل sendMessage هم صداش می‌زنیم)

    // نمایش «در حال تایپ» از طرف مقابل
    const typingFloat = document.getElementById('typingFloat');
    const typingFloatName = document.getElementById('typingFloatName');

    function showPeerTyping() {
        if (isTypingShown) return;
        isTypingShown = true;

        // ۱. آپدیت هدر (اگه دیده بشه)
        if (peerStatus) {
            if (!peerStatus.dataset.original) {
                peerStatus.dataset.original = peerStatus.textContent;
            }
            peerStatus.innerHTML = '<span class="typing-indicator"><span></span><span></span><span></span></span> در حال تایپ...';
            peerStatus.classList.add('is-typing');
        }

        // ۲. نمایش نشانگر شناور (همیشه دیدنی)
        if (typingFloat) {
            typingFloat.classList.add('show');
            if (typingFloatName) {
                typingFloatName.textContent = peer + ' در حال تایپ...';
            }
        }

        // اگه 3 ثانیه خبری نشد، پنهان کن
        if (typingHideTimer) clearTimeout(typingHideTimer);
        typingHideTimer = setTimeout(() => hidePeerTyping(), 3500);
    }

    function hidePeerTyping() {
        if (!isTypingShown) return;
        isTypingShown = false;

        if (typingHideTimer) {
            clearTimeout(typingHideTimer);
            typingHideTimer = null;
        }

        if (peerStatus) {
            peerStatus.classList.remove('is-typing');
            const original = peerStatus.dataset.original || '';
            if (original) {
                peerStatus.textContent = original;
            }
        }

        if (typingFloat) {
            typingFloat.classList.remove('show');
        }
    }

    // ============================================================
    //                     POLLING
    // ============================================================
    // ============================================================
    //                 POLLING هوشمند (adaptive)
    // ============================================================
    let pollTimer = null;
    let isPolling = false;
    let idleCount = 0;             // تعداد polling‌های پشت‌سرهم بدون پیام جدید
    let lastActivity = Date.now(); // آخرین فعالیت کاربر

    const MAX_INTERVAL = 10000;    // حداکثر ۱۰ ثانیه اگه همه‌چیز ساکت باشه

    function computeInterval() {
        // تب مخفی → کند
        if (document.hidden) return POLL_HIDDEN;

        // اگه کاربر تازگی تایپ/کلیک کرده → سریع
        if (Date.now() - lastActivity < 8000) return 800;

        // هر polling بدون پیام، فاصله رو زیاد کن (exponential backoff)
        const base = 1500;
        const factor = Math.min(2 ** idleCount, 8);
        return Math.min(base * factor, MAX_INTERVAL);
    }

    // ثبت فعالیت کاربر
    ['click', 'keydown', 'touchstart', 'mousemove'].forEach(evt => {
        document.addEventListener(evt, () => {
            lastActivity = Date.now();
            idleCount = 0;   // ریست
        }, { passive: true, once: false });
    });

    async function poll() {
        if (isPolling) return;
        isPolling = true;
        let hadNew = false;
        try {
            const r = await fetch(
                `/welcome/api/fetch/${encodeURIComponent(peer)}/?since=${lastId}`,
                { cache: 'no-store' }
            );
            if (r.ok) {
                const data = await r.json();
                const msgs = data.messages || [];
                if (msgs.length) hadNew = true;
                msgs.forEach(m => {
                    const isNew = !document.querySelector(`.msg[data-id="${m.id}"]`);
                    appendMessage(m);
                    if (isNew && !m.mine) playBeep();
                });
                if (typeof data.peer_online === 'boolean' && peerStatus) {
                    // اگه در حال تایپ نمایش داده میشه، وضعیت آنلاین رو مخفی نکن
                    const statusText = data.peer_online ? '🟢 آنلاین' : '⚪ آفلاین';
                    peerStatus.dataset.original = statusText;
                    if (!isTypingShown) {
                        peerStatus.textContent = statusText;
                    }
                }

                // نشانگر تایپ طرف مقابل
                if (data.peer_typing === true) {
                    showPeerTyping();
                } else if (data.peer_typing === false) {
                    hidePeerTyping();
                }
            }
        } catch (e) {}
        isPolling = false;

        // اگه پیام جدید اومد → idleCount صفر، اگه نه → زیاد
        if (hadNew) idleCount = 0;
        else idleCount = Math.min(idleCount + 1, 5);
    }

    function scheduleNextPoll() {
        if (pollTimer) clearTimeout(pollTimer);
        pollTimer = setTimeout(async () => {
            await poll();
            scheduleNextPoll();
        }, computeInterval());
    }
    scheduleNextPoll();

    document.addEventListener('visibilitychange', () => { if (!document.hidden) poll(); });
    window.addEventListener('focus', () => poll());

    // پاک‌سازی موقع بستن صفحه
    window.addEventListener('beforeunload', () => {
        stopTypingSignal();
    });

    textInput.focus();
})();

/* ============================================================
   SWIPE TO REPLY
   ============================================================ */
(function () {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;

    const THRESHOLD = 70;      // پیکسل لازم برای trigger
    const MAX_TRANSLATE = 100; // حداکثر جابه‌جایی
    const DIRECTION_LOCK = 15; // اگه بیشتر از این افقی حرکت کرد، عمودی رو قفل کن

    let activeMsg = null;
    let startX = 0;
    let startY = 0;
    let currentX = 0;
    let isSwiping = false;
    let isVerticalScroll = false;
    let swipeDirection = 0; // 1 = to-left, -1 = to-right, 0 = none
    let triggered = false;

    function reset() {
        if (activeMsg) {
            activeMsg.classList.remove('swiping', 'swipe-active', 'swipe-release');
            activeMsg.style.transform = '';
        }
        activeMsg = null;
        startX = 0;
        startY = 0;
        currentX = 0;
        isSwiping = false;
        isVerticalScroll = false;
        swipeDirection = 0;
        triggered = false;
    }

    messagesEl.addEventListener('touchstart', (e) => {
        if (e.touches.length !== 1) return;
        if (window.__chatSuppressSwipe) return;  // ← جدید
        const msgEl = e.target.closest('.msg');
        if (!msgEl) return;
        // اگه روی نقل‌قول یا منو کلیک کرد، نادیده بگیر
        if (e.target.closest('.msg-reply')) return;
        // اگه لایت‌باکس بازه یا مدال بازه، اجازه نده
        const lightbox = document.getElementById('chatLightbox');
        const settingsModal = document.getElementById('settingsModal');
        const attachModal = document.getElementById('attachModal');
        if (lightbox && !lightbox.hidden) return;
        if (settingsModal && !settingsModal.hidden) return;
        if (attachModal && !attachModal.hidden) return;

        activeMsg = msgEl;
        startX = e.touches[0].clientX;
        startY = e.touches[0].clientY;
        currentX = startX;
        isSwiping = false;
        isVerticalScroll = false;
        triggered = false;

        // تعیین جهت مورد انتظار
        swipeDirection = msgEl.classList.contains('mine') ? 1 : -1;
    }, { passive: true });

    messagesEl.addEventListener('touchmove', (e) => {
        if (!activeMsg) return;

        const x = e.touches[0].clientX;
        const y = e.touches[0].clientY;
        const dx = x - startX;
        const dy = y - startY;

        // قفل عمودی: اگه هنوز تصمیم نگرفتیم و حرکت عمودی غالبه → کنسل
        if (!isSwiping && !isVerticalScroll) {
            if (Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 10) {
                isVerticalScroll = true;
                reset();
                return;
            }
            if (Math.abs(dx) > DIRECTION_LOCK && Math.abs(dx) > Math.abs(dy)) {
                isSwiping = true;
                activeMsg.classList.add('swiping');
            }
        }

        if (!isSwiping) return;

        // جهت مجاز بر اساس نوع پیام
        // mine → فقط چپ (dx منفی)
        // theirs → فقط راست (dx مثبت)
        let effectiveDx = dx;
        if (activeMsg.classList.contains('mine')) {
            if (dx > 0) effectiveDx = 0;
        } else {
            if (dx < 0) effectiveDx = 0;
        }

        // محدود کردن به MAX_TRANSLATE
        const translate = Math.max(-MAX_TRANSLATE, Math.min(MAX_TRANSLATE, effectiveDx));
        activeMsg.style.transform = `translateX(${translate}px)`;

        // فیدبک بصری
        if (Math.abs(effectiveDx) >= THRESHOLD) {
            activeMsg.classList.add('swipe-active');
            triggered = true;
        } else {
            activeMsg.classList.remove('swipe-active');
            triggered = false;
        }
    }, { passive: true });

    messagesEl.addEventListener('touchend', (e) => {
        if (!activeMsg) return;

        const msgEl = activeMsg;
        const wasTriggered = triggered;

        // انیمیشن برگشت
        msgEl.classList.remove('swiping', 'swipe-active');
        msgEl.classList.add('swipe-release');
        msgEl.style.transform = 'translateX(0)';

        setTimeout(() => {
            msgEl.classList.remove('swipe-release');
        }, 260);

        if (wasTriggered) {
            // ارسال به فانکشن setReply
            if (typeof window.__chatSetReply === 'function') {
                window.__chatSetReply(msgEl);
                // هپتیک
                if (navigator.vibrate) navigator.vibrate(15);
            }
        }

        setTimeout(reset, 50);
    });

    messagesEl.addEventListener('touchcancel', reset);
})();

/* ============================================================
   DOUBLE-TAP TO REPLY (موبایل — مثل اینستاگرام)
   ============================================================ */
(function () {
    const messagesEl = document.getElementById('chatMessages');
    if (!messagesEl) return;

    let lastTap = 0;
    let lastTarget = null;

    messagesEl.addEventListener('touchend', (e) => {
        // اگه swipe در جریان باشه، کاری نکن
        if (e.target.closest('.msg.swiping, .msg.swipe-release')) return;

        const msgEl = e.target.closest('.msg');
        if (!msgEl) return;

        // روی media یا لینک کلیک کرد → نادیده بگیر
        if (e.target.closest('.msg-media') ||
            e.target.closest('.msg-reply') ||
            e.target.closest('a')) return;

        const now = Date.now();
        const delta = now - lastTap;

        if (delta < 300 && lastTarget === msgEl) {
            // 🎯 Double-tap detected!
            e.preventDefault();
            if (typeof window.__chatSetReply === 'function') {
                window.__chatSetReply(msgEl);
                if (navigator.vibrate) navigator.vibrate(20);
                // فیدبک بصری
                msgEl.classList.add('has-reply-highlight');
                setTimeout(() => msgEl.classList.remove('has-reply-highlight'), 500);
            }
            lastTap = 0;
            lastTarget = null;
        } else {
            lastTap = now;
            lastTarget = msgEl;
        }
    }, { passive: false });
})();

/* ============================================================
   BOTTOM SHEET LOGIC
   ============================================================ */
(function () {
    const sheet = document.getElementById('msgSheet');
    const messagesEl = document.getElementById('chatMessages');
    if (!sheet || !messagesEl) return;

    const sheetSender = document.getElementById('sheetPreviewSender');
    const sheetText = document.getElementById('sheetPreviewText');
    const isTouch = window.matchMedia('(hover: none)').matches ||
                    'ontouchstart' in window;

    let currentMsgEl = null;

    function openSheet(msgEl) {
        currentMsgEl = msgEl;

        // پر کردن پیش‌نمایش
        const sender = msgEl.classList.contains('mine') ? 'خودت' : 'طرف مقابل';
        let preview = '';

        const textBubble = msgEl.querySelector('.msg-bubble:not(.msg-media)');
        const media = msgEl.querySelector('.msg-media');
        const caption = msgEl.querySelector('.msg-caption');

        if (textBubble) {
            preview = textBubble.textContent.trim();
        } else if (media) {
            if (media.querySelector('img')) preview = '🖼️ تصویر';
            else if (media.querySelector('video')) preview = '🎬 ویدیو';
            if (caption) {
                const cap = caption.textContent.trim();
                if (cap) preview += (preview ? ' • ' : '') + cap;
            }
        }

        sheetSender.textContent = sender;
        sheetText.textContent = preview || '—';

        sheet.hidden = false;
        requestAnimationFrame(() => sheet.classList.add('open'));
        document.body.style.overflow = 'hidden';

        if (navigator.vibrate) navigator.vibrate(10);
    }

    function closeSheet() {
        sheet.classList.remove('open');
        setTimeout(() => {
            sheet.hidden = true;
            document.body.style.overflow = '';
            currentMsgEl = null;
        }, 250);
    }

    // اکسپورت global
    window.__chatOpenSheet = openSheet;

    // دکمه‌ها
    sheet.addEventListener('click', (e) => {
        const closeTrigger = e.target.closest('[data-sheet-close]');
        if (closeTrigger) {
            e.preventDefault();
            closeSheet();
            return;
        }

        const item = e.target.closest('.msg-sheet-item');
        if (!item) return;

        const action = item.dataset.action;
        const msgEl = currentMsgEl;

        closeSheet();

        if (!msgEl) return;

        if (action === 'reply') {
            setTimeout(() => {
                if (typeof window.__chatSetReply === 'function') {
                    window.__chatSetReply(msgEl);
                }
            }, 200);
        } else if (action === 'copy') {
            const textBubble = msgEl.querySelector('.msg-bubble:not(.msg-media)');
            const caption = msgEl.querySelector('.msg-caption');
            const text = (textBubble ? textBubble.textContent : '') ||
                         (caption ? caption.textContent : '');
            if (text) {
                navigator.clipboard.writeText(text.trim()).then(() => {
                    // toast کوچیک
                    showMiniToast('📋 کپی شد');
                }).catch(() => {});
            }
        }
    });

    // Escape
    document.addEventListener('keydown', (e) => {
        if (!sheet.hidden && e.key === 'Escape') closeSheet();
    });

    // Long-press → sheet (فقط روی موبایل)
    if (isTouch) {
        let longPressTimer = null;

        messagesEl.addEventListener('touchstart', (e) => {
            const msgEl = e.target.closest('.msg');
            if (!msgEl) return;
            // اگه swipe در حال اجراست، کنسل
            if (e.target.closest('.msg.swiping')) return;

            longPressTimer = setTimeout(() => {
                openSheet(msgEl);
                // بعد از باز شدن، اجازه ندیم double-tap یا swipe اجرا بشه
                window.__chatSuppressSwipe = true;
                setTimeout(() => { window.__chatSuppressSwipe = false; }, 400);
            }, 500);
        }, { passive: true });

        const cancel = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        messagesEl.addEventListener('touchmove', cancel);
        messagesEl.addEventListener('touchend', cancel);
        messagesEl.addEventListener('touchcancel', cancel);
    }

    function showMiniToast(msg) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: var(--accent, #22c55e);
            color: #fff;
            padding: 10px 20px;
            border-radius: 999px;
            font-family: inherit;
            font-size: .88rem;
            font-weight: 700;
            box-shadow: 0 8px 24px -8px rgba(0,0,0,0.4);
            z-index: 10070;
            opacity: 0;
            transition: opacity .25s, transform .25s;
            pointer-events: none;
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }
    window.__chatMiniToast = showMiniToast;
})();

/* ============================================================
   BOTTOM SHEET LOGIC
   ============================================================ */
(function () {
    const sheet = document.getElementById('msgSheet');
    const messagesEl = document.getElementById('chatMessages');
    if (!sheet || !messagesEl) return;

    const sheetSender = document.getElementById('sheetPreviewSender');
    const sheetText = document.getElementById('sheetPreviewText');
    const isTouch = window.matchMedia('(hover: none)').matches ||
                    'ontouchstart' in window;

    let currentMsgEl = null;

    function openSheet(msgEl) {
        currentMsgEl = msgEl;

        // پر کردن پیش‌نمایش
        const sender = msgEl.classList.contains('mine') ? 'خودت' : 'طرف مقابل';
        let preview = '';

        const textBubble = msgEl.querySelector('.msg-bubble:not(.msg-media)');
        const media = msgEl.querySelector('.msg-media');
        const caption = msgEl.querySelector('.msg-caption');

        if (textBubble) {
            preview = textBubble.textContent.trim();
        } else if (media) {
            if (media.querySelector('img')) preview = '🖼️ تصویر';
            else if (media.querySelector('video')) preview = '🎬 ویدیو';
            if (caption) {
                const cap = caption.textContent.trim();
                if (cap) preview += (preview ? ' • ' : '') + cap;
            }
        }

        sheetSender.textContent = sender;
        sheetText.textContent = preview || '—';

        sheet.hidden = false;
        requestAnimationFrame(() => sheet.classList.add('open'));
        document.body.style.overflow = 'hidden';

        if (navigator.vibrate) navigator.vibrate(10);
    }

    function closeSheet() {
        sheet.classList.remove('open');
        setTimeout(() => {
            sheet.hidden = true;
            document.body.style.overflow = '';
            currentMsgEl = null;
        }, 250);
    }

    // اکسپورت global
    window.__chatOpenSheet = openSheet;

    // دکمه‌ها
    sheet.addEventListener('click', (e) => {
        const closeTrigger = e.target.closest('[data-sheet-close]');
        if (closeTrigger) {
            e.preventDefault();
            closeSheet();
            return;
        }

        const item = e.target.closest('.msg-sheet-item');
        if (!item) return;

        const action = item.dataset.action;
        const msgEl = currentMsgEl;

        closeSheet();

        if (!msgEl) return;

        if (action === 'reply') {
            setTimeout(() => {
                if (typeof window.__chatSetReply === 'function') {
                    window.__chatSetReply(msgEl);
                }
            }, 200);
        } else if (action === 'copy') {
            const textBubble = msgEl.querySelector('.msg-bubble:not(.msg-media)');
            const caption = msgEl.querySelector('.msg-caption');
            const text = (textBubble ? textBubble.textContent : '') ||
                         (caption ? caption.textContent : '');
            if (text) {
                navigator.clipboard.writeText(text.trim()).then(() => {
                    // toast کوچیک
                    showMiniToast('📋 کپی شد');
                }).catch(() => {});
            }
        }
    });

    // Escape
    document.addEventListener('keydown', (e) => {
        if (!sheet.hidden && e.key === 'Escape') closeSheet();
    });

    // Long-press → sheet (فقط روی موبایل)
    if (isTouch) {
        let longPressTimer = null;

        messagesEl.addEventListener('touchstart', (e) => {
            const msgEl = e.target.closest('.msg');
            if (!msgEl) return;
            // اگه swipe در حال اجراست، کنسل
            if (e.target.closest('.msg.swiping')) return;

            longPressTimer = setTimeout(() => {
                openSheet(msgEl);
                // بعد از باز شدن، اجازه ندیم double-tap یا swipe اجرا بشه
                window.__chatSuppressSwipe = true;
                setTimeout(() => { window.__chatSuppressSwipe = false; }, 400);
            }, 500);
        }, { passive: true });

        const cancel = () => {
            if (longPressTimer) {
                clearTimeout(longPressTimer);
                longPressTimer = null;
            }
        };

        messagesEl.addEventListener('touchmove', cancel);
        messagesEl.addEventListener('touchend', cancel);
        messagesEl.addEventListener('touchcancel', cancel);
    }

    function showMiniToast(msg) {
        const toast = document.createElement('div');
        toast.textContent = msg;
        toast.style.cssText = `
            position: fixed;
            bottom: 90px;
            left: 50%;
            transform: translateX(-50%) translateY(20px);
            background: var(--accent, #22c55e);
            color: #fff;
            padding: 10px 20px;
            border-radius: 999px;
            font-family: inherit;
            font-size: .88rem;
            font-weight: 700;
            box-shadow: 0 8px 24px -8px rgba(0,0,0,0.4);
            z-index: 10070;
            opacity: 0;
            transition: opacity .25s, transform .25s;
            pointer-events: none;
        `;
        document.body.appendChild(toast);
        requestAnimationFrame(() => {
            toast.style.opacity = '1';
            toast.style.transform = 'translateX(-50%) translateY(0)';
        });
        setTimeout(() => {
            toast.style.opacity = '0';
            toast.style.transform = 'translateX(-50%) translateY(20px)';
            setTimeout(() => toast.remove(), 300);
        }, 1500);
    }
    window.__chatMiniToast = showMiniToast;
})();
