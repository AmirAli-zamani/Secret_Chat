(function () {
    const input = document.getElementById('chatSearch');
    const results = document.getElementById('chatSearchResults');
    if (!input || !results) return;

    let timer = null;

    function hide() { results.hidden = true; results.innerHTML = ''; }

    function show() { results.hidden = false; }

    function render(items) {
        if (!items || !items.length) {
            results.innerHTML = '<div class="chat-search-result"><span class="name" style="color:#9ca3af">کاربری پیدا نشد</span></div>';
            show();
            return;
        }
        results.innerHTML = items.map(u => `
            <a class="chat-search-result" href="${u.url}">
                <div class="chat-avatar sm">${u.username[0].toUpperCase()}</div>
                <span class="name">${u.username}</span>
                ${u.online ? '<span class="dot">🟢</span>' : ''}
            </a>
        `).join('');
        show();
    }

    function search(q) {
        fetch('/welcome/api/search/?q=' + encodeURIComponent(q))
            .then(r => r.ok ? r.json() : Promise.reject(r.status))
            .then(data => render(data.results))
            .catch(() => hide());
    }

    input.addEventListener('input', () => {
        clearTimeout(timer);
        const q = input.value.trim();
        timer = setTimeout(() => search(q), 250);
    });

    input.addEventListener('focus', () => {
        if (input.value.trim() === '') search('');
    });

    document.addEventListener('click', (e) => {
        if (!e.target.closest('.chat-search')) hide();
    });

    input.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            const q = input.value.trim();
            if (q) window.location.href = '/welcome/chat/' + encodeURIComponent(q) + '/';
        }
    });
})();
