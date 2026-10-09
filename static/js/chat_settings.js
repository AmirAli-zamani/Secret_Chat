(function () {
    'use strict';

    const modal = document.getElementById('settingsModal');
    if (!modal) return;

    const openBtn = document.getElementById('openSettings');
    const themeGrid = document.getElementById('themeGrid');
    const status = document.getElementById('settingsStatus');
    const bgPreview = document.getElementById('bgPreview');
    const bgFileInput = document.getElementById('bgFileInput');
    const bgRemoveBtn = document.getElementById('bgRemoveBtn');
    const opacityInput = document.getElementById('bgOpacity');
    const opacityVal = document.getElementById('bgOpacityVal');

    const csrf = document.querySelector('meta[name="csrf-token"]').content;

    const THEMES = [
        { id: 'forest',   name: '🌿 جنگل' },
        { id: 'midnight', name: '🌌 نیمه‌شب' },
        { id: 'sakura',   name: '🌸 ساکورا' },
        { id: 'twilight', name: '🌙 شفق' },
        { id: 'sunset',   name: '🌅 غروب' },
        { id: 'coffee',   name: '☕ قهوه' },
        { id: 'arctic',   name: '🧊 یخچال' },
        { id: 'night',    name: '🖤 شبانه' },
    ];

    let currentTheme = document.documentElement.getAttribute('data-theme') || 'forest';
    let currentBgUrl = '';

    // ============================================================
    //                     RENDER THEMES
    // ============================================================
    function renderThemes() {
        themeGrid.innerHTML = THEMES.map(t => `
            <button type="button" class="theme-card ${t.id === currentTheme ? 'active' : ''}"
                    data-theme-id="${t.id}" title="${t.name}">
                <div class="theme-preview"></div>
                <div class="theme-name">${t.name}</div>
            </button>
        `).join('');

        themeGrid.querySelectorAll('.theme-card').forEach(btn => {
            btn.addEventListener('click', () => {
                currentTheme = btn.dataset.themeId;
                applyTheme(currentTheme);
                renderThemes();
                saveSettings();
            });
        });
    }

    function applyTheme(themeId) {
        document.documentElement.setAttribute('data-theme', themeId);
        // تغییر تم روی تمپلیت‌های رنگی
        const colorMap = {
            forest:   { status: '#22c55e', meta: '#14532d' },
            midnight: { status: '#3b82f6', meta: '#0f172a' },
            sakura:   { status: '#ec4899', meta: '#831843' },
            twilight: { status: '#a855f7', meta: '#1a1625' },
            sunset:   { status: '#f97316', meta: '#7c2d12' },
            coffee:   { status: '#a16207', meta: '#451a03' },
            arctic:   { status: '#06b6d4', meta: '#164e63' },
            night:    { status: '#a3a3a3', meta: '#0a0a0a' },
        };
        const theme = document.querySelector('meta[name="theme-color"]');
        if (theme) theme.content = colorMap[themeId]?.status || '#14532d';
    }

    // ============================================================
    //                     BACKGROUND
    // ============================================================
    function applyBackground(url, opacity) {
        const app = document.querySelector('.chat-app');
        if (!app) return;

        if (url) {
            app.classList.add('has-custom-bg');
            app.style.setProperty('--custom-bg-image', `url("${url}")`);
            app.style.setProperty('--bg-overlay', (opacity / 100).toString());
        } else {
            app.classList.remove('has-custom-bg');
            app.style.removeProperty('--custom-bg-image');
        }
        bgPreview.style.backgroundImage = url ? `url("${url}")` : '';
        bgPreview.classList.toggle('has-bg', !!url);
        bgPreview.textContent = url ? '' : '🖼️';
        currentBgUrl = url;
    }

    opacityInput.addEventListener('input', () => {
        opacityVal.textContent = opacityInput.value + '%';
        localStorage.setItem('chat_bg_opacity', opacityInput.value);
        const app = document.querySelector('.chat-app');
        app.style.setProperty('--bg-overlay', (opacityInput.value / 100).toString());
    });

    bgFileInput.addEventListener('change', () => {
        const f = bgFileInput.files[0];
        if (!f) return;

        if (f.size > 8 * 1024 * 1024) {
            showStatus('❌ حجم فایل نباید بیشتر از ۸ مگابایت باشد', true);
            bgFileInput.value = '';
            return;
        }
        if (!f.type.startsWith('image/')) {
            showStatus('❌ فایل باید عکس باشد', true);
            bgFileInput.value = '';
            return;
        }

        // پیش‌نمایش فوری
        const reader = new FileReader();
        reader.onload = (e) => {
            bgPreview.style.backgroundImage = `url("${e.target.result}")`;
            bgPreview.classList.add('has-bg');
            bgPreview.textContent = '';
        };
        reader.readAsDataURL(f);

        // آپلود
        uploadBackground(f);
    });

    bgRemoveBtn.addEventListener('click', () => {
        if (!confirm('بکگراند حذف شود؟')) return;
        applyBackground('', 25);
        saveSettings(null, true);
    });

    async function uploadBackground(file) {
        const fd = new FormData();
        fd.append('custom_bg', file);
        fd.append('theme', currentTheme);

        showStatus('⏳ در حال آپلود...');

        try {
            const r = await fetch('/welcome/api/settings/', {
                method: 'POST',
                headers: { 'X-CSRFToken': csrf },
                body: fd,
            });
            const data = await r.json();
            if (data.ok) {
                applyBackground(data.custom_bg_url, parseInt(opacityInput.value, 10));
                showStatus('✅ بکگراند ذخیره شد');
            } else {
                showStatus('❌ ' + (data.error || 'خطا'), true);
            }
        } catch (e) {
            showStatus('❌ خطای شبکه', true);
        }
    }

    function saveSettings(themeOverride, removeBg = false) {
        const fd = new FormData();
        fd.append('theme', themeOverride || currentTheme);
        if (removeBg) fd.append('remove_bg', '1');

        fetch('/welcome/api/settings/', {
            method: 'POST',
            headers: { 'X-CSRFToken': csrf },
            body: fd,
        })
        .then(r => r.ok ? r.json() : Promise.reject())
        .then(data => {
            if (data.ok && !removeBg) {
                showStatus('✅ تم ذخیره شد');
            }
        })
        .catch(() => {});
    }

    function showStatus(msg, isError = false) {
        status.textContent = msg;
        status.classList.add('show');
        if (isError) status.style.background = '#fee2e2', status.style.color = '#7f1d1d';
        else status.style.background = '', status.style.color = '';
        clearTimeout(showStatus._t);
        showStatus._t = setTimeout(() => {
            status.classList.remove('show');
        }, 2500);
    }

    // ============================================================
    //                     OPEN / CLOSE
    // ============================================================
    function openModal() {
        modal.hidden = false;
        requestAnimationFrame(() => modal.classList.add('open'));
        renderThemes();
        loadSettings();
    }

    function closeModal() {
        modal.classList.remove('open');
        setTimeout(() => { modal.hidden = true; }, 220);
    }

    openBtn.addEventListener('click', openModal);
    modal.addEventListener('click', (e) => {
        if (e.target.closest('[data-close-settings]')) {
            e.preventDefault();
            closeModal();
        }
    });
    document.addEventListener('keydown', (e) => {
        if (!modal.hidden && e.key === 'Escape') closeModal();
    });

    // ============================================================
    //                     LOAD FROM SERVER
    // ============================================================
    async function loadSettings() {
        try {
            const r = await fetch('/welcome/api/settings/', { cache: 'no-store' });
            if (!r.ok) return;
            const data = await r.json();
            if (data.theme) {
                currentTheme = data.theme;
                applyTheme(currentTheme);
            }
            const savedOpacity = parseInt(localStorage.getItem('chat_bg_opacity') || '25', 10);
            opacityInput.value = savedOpacity;
            opacityVal.textContent = savedOpacity + '%';
            applyBackground(data.custom_bg_url || '', savedOpacity);
            renderThemes();
        } catch (e) { /* ignore */ }
    }

    // مقدار opacity رو از localStorage بخون و زودتر اعمال کن
    const savedOpacity = parseInt(localStorage.getItem('chat_bg_opacity') || '25', 10);
    const app = document.querySelector('.chat-app');
    if (app) app.style.setProperty('--bg-overlay', (savedOpacity / 100).toString());

    // لود تنظیمات در اولین بار
    loadSettings();
})();

/* ============================================================
   ACCOUNT SETTINGS — تغییر پسورد و کلید امنیتی
   ============================================================ */
(function () {
    const chgBtn = document.getElementById('chgPasswordBtn');
    const setKeyBtn = document.getElementById('setKeyBtn');
    if (!chgBtn && !setKeyBtn) return;

    const status = document.getElementById('settingsStatus');
    const usernameEl = document.getElementById('settingsUsername');
    const keyStatus = document.getElementById('securityKeyStatus');
    const csrf = document.querySelector('meta[name="csrf-token"]').content;

    function showStatus(msg, isError = false) {
        if (!status) return;
        status.textContent = msg;
        status.classList.add('show');
        if (isError) {
            status.style.background = '#fee2e2';
            status.style.color = '#7f1d1d';
        } else {
            status.style.background = '';
            status.style.color = '';
        }
        clearTimeout(showStatus._t);
        showStatus._t = setTimeout(() => status.classList.remove('show'), 3000);
    }

    // لود اطلاعات حساب
    async function loadAccountInfo() {
        try {
            const r = await fetch('/welcome/account/info/', { cache: 'no-store' });
            if (!r.ok) return;
            const data = await r.json();
            if (usernameEl) usernameEl.textContent = data.username || '—';
            if (keyStatus) {
                if (data.has_security_key) {
                    keyStatus.textContent = '✅ کلید امنیتی تنظیم شده. می‌تونی عوضش کنی.';
                    keyStatus.classList.add('ok');
                } else {
                    keyStatus.textContent = '⚠️ هنوز کلید امنیتی نداری. یه کلید تنظیم کن تا اگه پسوردت رو فراموش کردی بتونی بازیابی کنی.';
                    keyStatus.classList.remove('ok');
                }
            }
        } catch (e) {}
    }

    // تغییر پسورد
    if (chgBtn) {
        chgBtn.addEventListener('click', async () => {
            const oldPwd = document.getElementById('chgOldPassword').value;
            const newPwd = document.getElementById('chgNewPassword').value;
            const newPwd2 = document.getElementById('chgNewPassword2').value;

            if (!oldPwd || !newPwd || !newPwd2) {
                showStatus('همه‌ی فیلدها را پر کن', true);
                return;
            }
            if (newPwd !== newPwd2) {
                showStatus('پسورد جدید و تکرارش یکسان نیستن', true);
                return;
            }

            chgBtn.disabled = true;
            const fd = new FormData();
            fd.append('old_password', oldPwd);
            fd.append('new_password', newPwd);
            fd.append('new_password2', newPwd2);

            try {
                const r = await fetch('/welcome/account/change-password/', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrf },
                    body: fd,
                });
                const data = await r.json();
                if (data.ok) {
                    showStatus(data.message || '✅ پسورد تغییر کرد');
                    document.getElementById('chgOldPassword').value = '';
                    document.getElementById('chgNewPassword').value = '';
                    document.getElementById('chgNewPassword2').value = '';
                } else {
                    showStatus('❌ ' + (data.error || 'خطا'), true);
                }
            } catch (e) {
                showStatus('❌ خطای شبکه', true);
            }
            chgBtn.disabled = false;
        });
    }

    // تنظیم کلید امنیتی
    if (setKeyBtn) {
        setKeyBtn.addEventListener('click', async () => {
            const pwd = document.getElementById('setKeyPassword').value;
            const key = document.getElementById('setNewKey').value.trim();

            if (!pwd || !key) {
                showStatus('پسورد و کلید جدید را وارد کن', true);
                return;
            }
            if (key.length < 3) {
                showStatus('کلید باید حداقل ۳ کاراکتر باشه', true);
                return;
            }

            setKeyBtn.disabled = true;
            const fd = new FormData();
            fd.append('current_password', pwd);
            fd.append('security_key', key);

            try {
                const r = await fetch('/welcome/account/set-security-key/', {
                    method: 'POST',
                    headers: { 'X-CSRFToken': csrf },
                    body: fd,
                });
                const data = await r.json();
                if (data.ok) {
                    showStatus(data.message || '✅ کلید امنیتی ذخیره شد');
                    document.getElementById('setKeyPassword').value = '';
                    document.getElementById('setNewKey').value = '';
                    loadAccountInfo();
                } else {
                    showStatus('❌ ' + (data.error || 'خطا'), true);
                }
            } catch (e) {
                showStatus('❌ خطای شبکه', true);
            }
            setKeyBtn.disabled = false;
        });
    }

    // لود در اولین بار
    loadAccountInfo();

    // لود مجدد وقتی modal باز می‌شه
    const openBtn = document.getElementById('openSettings');
    if (openBtn) {
        openBtn.addEventListener('click', () => setTimeout(loadAccountInfo, 100));
    }
})();
