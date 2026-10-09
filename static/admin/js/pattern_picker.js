(function () {
    function initPicker(picker) {
        const hidden = picker.querySelector('.gp-hidden');
        const buttons = picker.querySelectorAll('.gp-btn');
        const countEl = picker.querySelector('.gp-count b');
        if (!hidden || !buttons.length) return;

        const selected = new Set();

        // مقدار اولیه از input مخفی
        if (hidden.value) {
            hidden.value.split(',').forEach(x => {
                const n = parseInt(x.trim(), 10);
                if (n >= 1 && n <= 9) selected.add(n);
            });
        }

        function sync() {
            buttons.forEach(btn => {
                const n = parseInt(btn.dataset.index, 10);
                if (selected.has(n)) btn.classList.add('selected');
                else btn.classList.remove('selected');
            });
            if (countEl) countEl.textContent = selected.size;
            hidden.value = Array.from(selected).sort((a, b) => a - b).join(',');
        }

        buttons.forEach(btn => {
            btn.addEventListener('click', e => {
                e.preventDefault();
                const n = parseInt(btn.dataset.index, 10);
                if (selected.has(n)) selected.delete(n);
                else selected.add(n);
                sync();
            });
        });

        sync();
    }

    function boot() {
        document.querySelectorAll('.gp-picker').forEach(initPicker);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', boot);
    } else {
        boot();
    }
})();
