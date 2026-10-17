// ===== MOBILE NAV DRAWER =====
const menuToggle = document.getElementById('menuToggle');
const mobileDrawer = document.getElementById('mobileDrawer');
const drawerOverlay = document.getElementById('drawerOverlay');
const drawerClose = document.getElementById('drawerClose');

function openDrawer() {
    if (mobileDrawer) mobileDrawer.classList.add('open');
    if (drawerOverlay) drawerOverlay.classList.add('open');
}

function closeDrawer() {
    if (mobileDrawer) mobileDrawer.classList.remove('open');
    if (drawerOverlay) drawerOverlay.classList.remove('open');
}

if (menuToggle) {
    menuToggle.addEventListener('click', openDrawer);
}

if (drawerClose) {
    drawerClose.addEventListener('click', closeDrawer);
}

if (drawerOverlay) {
    drawerOverlay.addEventListener('click', closeDrawer);
}

if (mobileDrawer) {
    mobileDrawer.querySelectorAll('a').forEach(function (link) {
        link.addEventListener('click', closeDrawer);
    });

    mobileDrawer.querySelectorAll('.drawer-submenu-toggle').forEach(function (toggleBtn) {
        toggleBtn.addEventListener('click', function () {
            const parent = toggleBtn.closest('.drawer-has-submenu');
            if (parent) parent.classList.toggle('open');
        });
    });
}

// ===== FILTER TEMPLATES BY CATEGORY =====
function filterTemplates(category, btnEl) {

    // Update active button
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    const active = btnEl || (window.event && window.event.target) ||
        document.querySelector('.filter-btn[data-cat="' + category + '"]');
    if (active) active.classList.add('active');

    // Show or hide cards
    const cards = document.querySelectorAll('.template-card');
    cards.forEach(card => {
        if (category === 'all') {
            card.style.display = 'block';
        } else if (card.dataset.category === category) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}

// ===== SEARCH TEMPLATES =====
const searchInput = document.getElementById('searchInput');

if (searchInput) {
    searchInput.addEventListener('input', function () {
        const searchTerm = this.value.toLowerCase();
        const cards = document.querySelectorAll('.template-card');

        cards.forEach(card => {
            const title = card.querySelector('h3').textContent.toLowerCase();
            const description = card.querySelector('p').textContent.toLowerCase();

            if (title.includes(searchTerm) || description.includes(searchTerm)) {
                card.style.display = 'block';
            } else {
                card.style.display = 'none';
            }
        });
    });
}
// ===== DEEP LINK: templates.html?cat=traditional =====
(function () {
    if (!document.getElementById('templateGrid')) return;
    var cat = new URLSearchParams(window.location.search).get('cat');
    if (!cat) return;
    var btn = document.querySelector('.filter-btn[data-cat="' + cat + '"]');
    if (btn) filterTemplates(cat, btn);
})();
