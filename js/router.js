function loadPage(pageName, callback) {
    const app = document.getElementById('app');
    if (!app) return;
    app.innerHTML = '<div class="loader">Загрузка...</div>';
    fetch(`pages/${pageName}.html`)
        .then(response => {
            if (!response.ok) throw new Error(`Страница ${pageName} не найдена`);
            return response.text();
        })
        .then(html => {
            app.innerHTML = html;
            // Вызываем колбэк, если передан, или глобальную функцию onPageLoaded
            if (callback) callback();
            else if (window.onPageLoaded) window.onPageLoaded();
        })
        .catch(error => {
            app.innerHTML = `<p style="color:red;">Ошибка: ${error.message}</p>`;
        });

    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) link.classList.add('active');
    });
}

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            window.location.hash = page;
            loadPage(page);
        });
    });

    const hash = window.location.hash.replace('#', '') || 'panel';
    loadPage(hash);

    window.addEventListener('hashchange', function() {
        const page = window.location.hash.replace('#', '') || 'panel';
        loadPage(page);
    });
});
