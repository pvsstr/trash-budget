// ====== РОУТЕР ======
// Загружает HTML-фрагмент из папки pages/ и вызывает колбэк после вставки

function loadPage(pageName, callback) {
    const app = document.getElementById('app');
    if (!app) return;

    // Показываем индикатор загрузки
    app.innerHTML = '<div class="loader">Загрузка...</div>';

    fetch(`pages/${pageName}.html`)
        .then(response => {
            if (!response.ok) throw new Error(`Страница ${pageName} не найдена`);
            return response.text();
        })
        .then(html => {
            app.innerHTML = html;
            // Если передан колбэк — вызываем его
            if (typeof callback === 'function') callback();
            // Если есть глобальная функция onPageLoaded (для обратной совместимости)
            else if (typeof window.onPageLoaded === 'function') window.onPageLoaded();
        })
        .catch(error => {
            app.innerHTML = `<p style="color:var(--red); padding:20px;">❌ Ошибка: ${error.message}</p>`;
            console.error('Router error:', error);
        });

    // Обновляем активные пункты меню
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
        if (link.dataset.page === pageName) link.classList.add('active');
    });
}

// ====== Обработка кликов и хешей ======
document.addEventListener('DOMContentLoaded', function() {
    // Клики по ссылкам навигации (используются в боковом и нижнем меню)
    document.querySelectorAll('.nav-link').forEach(link => {
        link.addEventListener('click', function(e) {
            e.preventDefault();
            const page = this.dataset.page;
            if (!page) return;
            window.location.hash = page;
            // Передаём колбэк для вызова render после загрузки
            loadPage(page, () => {
                if (typeof render === 'function') render();
            });
        });
    });

    // Загружаем страницу по хешу или по умолчанию 'panel'
    const hash = window.location.hash.replace('#', '') || 'panel';
    loadPage(hash, () => {
        if (typeof render === 'function') render();
    });

    // Следим за изменением хеша (кнопки "назад"/"вперёд")
    window.addEventListener('hashchange', function() {
        const page = window.location.hash.replace('#', '') || 'panel';
        loadPage(page, () => {
            if (typeof render === 'function') render();
        });
    });
});
