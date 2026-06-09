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
const buyButton = document.getElementById('buyButton');

if (buyButton) {
    buyButton.addEventListener('click', function() {

        var handler = PaystackPop.setup({
            key: 'pk_test_4d437e9c1cf459fca585716974a5eb5e4247cb1e',
            email: prompt('Please enter your email address:'),
            amount: 500000,
            currency: 'NGN',
            ref: 'vendooor_' + Math.floor(Math.random() * 1000000000),
            metadata: {
                custom_fields: [
                    {
                        display_name: "Template Name",
                        variable_name: "template_name",
                        value: "Business Pro Template"
                    }
                ]
            },
            callback: function(response) {
                alert('Payment successful! 🎉 Your download will begin shortly. Reference: ' + response.reference);
            },
            onClose: function() {
                alert('Payment cancelled. Come back when you are ready!');
            }
        });

        handler.openIframe();
    });
}