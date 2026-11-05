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

// ===== TEMPLATE CART =====
// Kept in this browser only (localStorage). Each planner can be in the cart
// once. Prices are always re-checked on the server after payment.
window.VCCart = (function () {
    var KEY = 'vc_cart';
    function get() {
        try { var v = JSON.parse(localStorage.getItem(KEY) || '[]'); return Array.isArray(v) ? v : []; } catch (e) { return []; }
    }
    function save(list) {
        try { localStorage.setItem(KEY, JSON.stringify(list)); } catch (e) {}
        renderNav();
    }
    function add(slug) { var l = get(); if (l.indexOf(slug) === -1) l.push(slug); save(l); }
    function remove(slug) { save(get().filter(function (s) { return s !== slug; })); }
    function clear() { save([]); }
    function has(slug) { return get().indexOf(slug) !== -1; }
    function renderNav() {
        var n = get().length;
        var nav = document.querySelector('header nav');
        if (!nav) return;
        var pill = document.getElementById('navCart');
        if (!n) { if (pill) pill.remove(); return; }
        if (!pill) {
            pill = document.createElement('a');
            pill.id = 'navCart';
            pill.className = 'nav-cart';
            pill.href = 'cart.html';
            nav.appendChild(pill);
        }
        pill.innerHTML = 'Cart <span>' + n + '</span>';
        pill.setAttribute('aria-label', 'Your cart, ' + n + (n === 1 ? ' item' : ' items'));
    }
    renderNav();
    window.addEventListener('storage', function (e) { if (e.key === KEY) renderNav(); });
    return { get: get, add: add, remove: remove, clear: clear, has: has };
})();

// ===== "MESSAGE US" ON WHATSAPP =====
(function () {
    var NUMBER = '2348139189496'; // 0813 918 9496
    if (/admin\.html$/.test(location.pathname)) return;
    var a = document.createElement('a');
    a.className = 'wa-float';
    a.href = 'https://wa.me/' + NUMBER + '?text=' + encodeURIComponent('Hello Vendoor Connect, ');
    a.target = '_blank';
    a.rel = 'noopener';
    a.setAttribute('aria-label', 'Message us on WhatsApp');
    a.innerHTML = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 11.5a8.4 8.4 0 0 1-12.4 7.4L3 21l2.1-5.4A8.4 8.4 0 1 1 21 11.5z"/></svg><span>Message us</span>';
    document.body.appendChild(a);
})();

// ===== SITE FORMS (contact, custom planner, vendor requests) =====
// <form data-vc-form="contact|custom|vendor-request" data-success="...">
// Sends to /.netlify/functions/send-message and thanks the person on the page.
(function () {
    document.querySelectorAll('form[data-vc-form]').forEach(function (form) {
        var btn = form.querySelector('button[type="submit"]');
        var label = btn ? btn.textContent : '';
        var status = document.createElement('p');
        status.className = 'form-status';
        status.setAttribute('role', 'status');
        form.appendChild(status);
        form.addEventListener('submit', function (e) {
            e.preventDefault();
            var data = { kind: form.getAttribute('data-vc-form') };
            new FormData(form).forEach(function (v, k) { data[k] = typeof v === 'string' ? v.trim() : v; });
            var missing = Array.prototype.filter.call(form.querySelectorAll('[required]'), function (el) { return !el.value.trim(); })[0];
            if (missing) { status.className = 'form-status form-status-error'; status.textContent = 'Please fill in ' + (missing.getAttribute('data-label') || 'the highlighted field') + '.'; missing.focus(); return; }
            if (data.email && !/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(data.email)) { status.className = 'form-status form-status-error'; status.textContent = 'Please check your email address.'; return; }
            if (btn) { btn.disabled = true; btn.textContent = 'Sending...'; }
            status.textContent = '';
            fetch('/.netlify/functions/send-message', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) })
                .then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { if (!r.ok) throw new Error(j.error || 'Something went wrong. Please try again.'); return j; }); })
                .then(function () {
                    var first = (data.name || '').split(' ')[0];
                    var done = document.createElement('div');
                    done.className = 'form-done';
                    done.setAttribute('tabindex', '-1');
                    done.innerHTML = '<h3>Thank you' + (first ? ', ' + first.replace(/[<>&"]/g, '') : '') + '.</h3><p>' + (form.getAttribute('data-success') || 'Your message is with us. We\'ll reply by email soon.') + '</p>';
                    form.replaceWith(done);
                    done.focus();
                })
                .catch(function (err) {
                    status.className = 'form-status form-status-error';
                    status.textContent = err.message;
                    if (btn) { btn.disabled = false; btn.textContent = label; }
                });
        });
    });
})();
