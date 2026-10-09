(function () {
    'use strict';

    const lightbox = document.getElementById('chatLightbox');
    if (!lightbox) {
        console.warn('lightbox element not found');
        return;
    }

    const content = document.getElementById('lightboxContent');
    const downloadLink = document.getElementById('lightboxDownload');
    const closeBtn = lightbox.querySelector('.lightbox-close');

    let currentItems = [];
    let currentIndex = 0;

    function open(items, index) {
        currentItems = items;
        currentIndex = index;
        renderCurrent();
        lightbox.hidden = false;
        document.body.style.overflow = 'hidden';
        requestAnimationFrame(() => lightbox.classList.add('open'));
    }

    function close() {
        lightbox.classList.remove('open');
        setTimeout(() => {
            lightbox.hidden = true;
            content.innerHTML = '';
            document.body.style.overflow = '';
        }, 220);
    }

    function renderCurrent() {
        const item = currentItems[currentIndex];
        if (!item) return;
        if (item.type === 'video') {
            content.innerHTML = `<video src="${item.src}" controls autoplay
                style="max-width:92vw;max-height:88vh;border-radius:12px"></video>`;
        } else {
            content.innerHTML = `<img src="${item.src}" alt=""
                style="max-width:92vw;max-height:88vh;border-radius:12px;object-fit:contain">`;
        }
        downloadLink.href = item.src;
        const counter = document.getElementById('lightboxCounter');
        if (currentItems.length > 1) {
            counter.textContent = `${currentIndex + 1} / ${currentItems.length}`;
            counter.style.display = 'block';
        } else {
            counter.style.display = 'none';
        }
    }

    function next() { if (currentIndex < currentItems.length - 1) { currentIndex++; renderCurrent(); } }
    function prev() { if (currentIndex > 0) { currentIndex--; renderCurrent(); } }

    closeBtn.addEventListener('click', (e) => { e.stopPropagation(); close(); });

    lightbox.addEventListener('click', (e) => {
        if (e.target === lightbox || e.target.id === 'lightboxContent') close();
    });
    content.addEventListener('click', (e) => e.stopPropagation());

    document.addEventListener('keydown', (e) => {
        if (lightbox.hidden) return;
        if (e.key === 'Escape') close();
        else if (e.key === 'ArrowRight') next();
        else if (e.key === 'ArrowLeft') prev();
    });

    // ============================================================
    // کلیک روی هر عکس یا لینک عکس توی صفحه → لایت‌باکس
    // ============================================================
    document.addEventListener('click', function (e) {
        const t = e.target;

        // اگه روی خود عکس کلیک شد
        if (t.tagName === 'IMG' && t.closest('.msg-media')) {
            e.preventDefault();
            e.stopPropagation();
            const all = Array.from(document.querySelectorAll('.msg-media img'));
            const items = all.map(el => ({ type: 'image', src: el.src }));
            open(items, all.indexOf(t));
            return;
        }

        // اگه روی لینک دور عکس کلیک شد
        const link = t.closest('a');
        if (link && link.href && link.closest('.msg-media')) {
            e.preventDefault();
            e.stopPropagation();
            const img = link.querySelector('img');
            if (img) {
                const all = Array.from(document.querySelectorAll('.msg-media img'));
                const items = all.map(el => ({ type: 'image', src: el.src }));
                open(items, all.indexOf(img));
            } else {
                // لینک ویدیو یا فایل دیگه
                open([{ type: 'image', src: link.href }], 0);
            }
        }
    }, true);  // ← useCapture: true که قبل از هندلرهای دیگه اجرا شه
})();
