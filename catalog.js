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
      'traditional': {
        badge: 'Traditional Wedding',
        name: 'Traditional Wedding Planner',
        price: 5000,
        short: 'Plan every detail of your traditional ceremony, from aso-ebi to vendor bookings',
        description: 'A self-guided planning template for your traditional wedding ceremony, built around real Nigerian wedding traditions, from aso-ebi coordination to vendor bookings. No event planner required.'
      },
      'white-wedding': {
        badge: 'White Wedding',
        name: 'White Wedding Planner',
        price: 7500,
        short: 'A complete self-guided planning template for your church or court wedding',
        description: 'A complete self-guided planning template for your church or court wedding, covering the ceremony program, reception logistics, and every vendor in between.'
      },
      'bridal-shower': {
        badge: 'Bridal Shower',
        name: 'Bridal Shower Planner',
        price: 3500,
        short: 'Everything you need to plan a beautiful bridal shower',
        description: 'Everything you need to plan a beautiful bridal shower, from the guest list and games to décor and gifting, without the last-minute scramble.'
      },
      'bachelorette': {
        badge: 'Bachelorette',
        name: 'Bachelorette Planner',
        price: 5500,
        short: 'Organize the perfect bachelorette weekend',
        description: 'Organize the perfect bachelorette weekend for the bride-to-be, from the guest list and itinerary to the budget and the surprises.'
      },
      'engagement': {
        badge: 'Engagement',
        name: 'Engagement & Introduction Planner',
        price: 4500,
        short: 'Plan your introduction or knocking ceremony with ease',
        description: 'Plan your introduction or knocking ceremony with ease, covering family coordination, traditional requirements, and the day-of run of show.'
      },
      'honeymoon': {
        badge: 'Honeymoon',
        name: 'Honeymoon Planner',
        price: 4000,
        short: 'Plan your dream honeymoon, from budget to itinerary',
        description: 'Plan your dream honeymoon, from a budget and destination shortlist to a full day-by-day itinerary.'
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
