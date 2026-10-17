// ===== VENDOOR CONNECT — TEMPLATE CATALOG (single source of truth) =====
// Used by the browser (home, templates, single-template pages) AND by the
// payment-verification function on the server, so a price can only ever be
// changed in this one place. Prices are in Naira.
//
// GOING LIVE WITH PAYSTACK: replace PAYSTACK_PUBLIC_KEY below with your
// pk_live_... key, and set PAYSTACK_SECRET_KEY in Netlify to your sk_live_... key.
(function (root) {
  var VENDOOR = {
    PAYSTACK_PUBLIC_KEY: 'pk_test_4d437e9c1cf459fca585716974a5eb5e4247cb1e',
    CATALOG: {
      'yoruba-wedding': {
        badge: 'Yoruba Wedding',
        name: 'Yoruba Wedding Planner',
        price: 5000,
        short: 'Plan your Yoruba traditional wedding, from aso-ebi and gele to the owambe',
        description: 'A self-guided planner for your Yoruba traditional wedding (igbeyawo): family introductions, the engagement list, aso-ebi and gele coordination, the alaga, vendors, budget and the day-of programme, all in one place. No event planner required.'
      },
      'igbo-wedding': {
        badge: 'Igbo Wedding',
        name: 'Igbo Wedding Planner',
        price: 5000,
        short: 'Plan your Igbo traditional wedding, from the list to igba nkwu',
        description: 'A self-guided planner for your Igbo traditional wedding (igba nkwu): knocking and family visits, the bride price list, wine carrying, attire and coral beads, vendors, budget and the day-of programme, all in one place. No event planner required.'
      },
      'welcome-party': {
        badge: 'Welcome Party',
        name: 'Welcome Party Planner',
        price: 5000,
        short: 'Plan the welcome party that kicks off your wedding weekend',
        description: 'A self-guided planner for your pre-wedding welcome party: guest list and invitations, venue and decor, food and drinks, music, the couple\'s entrance and the evening\'s run of show, all in one beautiful place.'
      }
    }
  };
  Object.keys(VENDOOR.CATALOG).forEach(function (slug) {
    VENDOOR.CATALOG[slug].slug = slug;
    VENDOOR.CATALOG[slug].image = 'images/covers/' + slug + '.svg';
  });
  if (typeof module !== 'undefined' && module.exports) module.exports = VENDOOR;
  else root.VENDOOR = VENDOOR;
})(this);
