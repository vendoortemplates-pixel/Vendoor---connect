// ===== VENDOOR CONNECT — shared helpers for every page =====
(function () {
  var CATEGORY_LABELS = {
    photography: 'Photographers & Videographers', catering: 'Caterers', decor: 'Decorators & Florists',
    mc: 'MCs & Entertainers', makeup: 'Makeup Artists & Hair', venue: 'Venues & Event Centers',
    fashion: 'Aso-ebi & Fashion', cakes: 'Cakes & Confectionery', planning: 'Event Planners', other: 'Other'
  };
  function esc(str) {
    return String(str == null ? '' : str).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }
  function naira(n) {
    var v = parseFloat(n);
    return isNaN(v) ? '' : '₦' + v.toLocaleString('en-NG');
  }
  // Read-only star row. Rating may be fractional (e.g. 4.5).
  function stars(rating, size) {
    var r = Math.max(0, Math.min(5, Number(rating) || 0));
    var pct = (r / 5) * 100;
    return '<span class="stars' + (size ? ' stars-' + size : '') + '" role="img" aria-label="' + r + ' out of 5 stars">' +
      '<span class="stars-base">★★★★★</span><span class="stars-fill" style="width:' + pct + '%">★★★★★</span></span>';
  }
  function date(d) {
    if (!d) return '';
    var dt = new Date(d);
    if (isNaN(dt)) return '';
    return dt.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  }
  function getJSON(url, options) {
    return fetch(url, options).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (json) {
        if (!res.ok) { var e = new Error(json.error || 'Something went wrong. Please try again.'); e.status = res.status; throw e; }
        return json;
      });
    });
  }
  function whatsappLink(digits, text) {
    return 'https://wa.me/' + encodeURIComponent(digits) + (text ? '?text=' + encodeURIComponent(text) : '');
  }
  window.VC = { CATEGORY_LABELS: CATEGORY_LABELS, esc: esc, naira: naira, stars: stars, date: date, getJSON: getJSON, whatsappLink: whatsappLink };
})();
