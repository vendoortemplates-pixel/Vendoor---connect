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
}

// ===== FILTER TEMPLATES BY CATEGORY =====
function filterTemplates(category) {

    // Update active button
    const buttons = document.querySelectorAll('.filter-btn');
    buttons.forEach(btn => btn.classList.remove('active'));
    event.target.classList.add('active');

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
// ===== PAYSTACK PAYMENT =====
// To scale to more templates, give each buy button its own
// data-amount (in kobo) and data-name attributes, this script
// reads them automatically. No other JS changes needed.
const buyButton = document.getElementById('buyButton');

if (buyButton) {
    buyButton.addEventListener('click', function() {

        const emailInput = document.getElementById('buyerEmail');
        const email = emailInput ? emailInput.value.trim() : '';

        if (!email || !email.includes('@') || !email.includes('.')) {
            if (emailInput) emailInput.focus();
            alert('Please enter a valid email address before checking out.');
            return;
        }

        const amount = parseInt(buyButton.dataset.amount, 10) || 500000;
        const templateName = buyButton.dataset.name || 'Vendoor Connect Template';

        var handler = PaystackPop.setup({
            key: 'pk_test_4d437e9c1cf459fca585716974a5eb5e4247cb1e',
            email: email,
            amount: amount,
            currency: 'NGN',
            ref: 'vendoor_' + Math.floor(Math.random() * 1000000000),
            metadata: {
                custom_fields: [
                    {
                        display_name: "Template Name",
                        variable_name: "template_name",
                        value: templateName
                    }
                ]
            },
            callback: function(response) {
                window.location.href = 'thank-you.html?ref=' + encodeURIComponent(response.reference) + '&template=' + encodeURIComponent(templateName);
            },
            onClose: function() {
                alert('Payment cancelled. Come back when you are ready.');
            }
        });

        handler.openIframe();
    });
}