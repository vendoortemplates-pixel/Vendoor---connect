// Validates the listing form a vendor submits from vendor-portal.html.
const { clean, safeUrl, normalizePhone, CATEGORIES, validPhoto } = require('./common');

module.exports = function readListing(data) {
  const out = {
    businessName: clean(data.businessName, 120),
    category: clean(data.category, 40),
    city: clean(data.city, 120),
    price: Number(String(data.price || '').replace(/[^\d.]/g, '')),
    description: clean(data.description, 1500),
    portfolio: safeUrl(data.portfolio),
    whatsapp: normalizePhone(data.whatsapp) || null,
    instagram: clean(data.instagram, 60).replace(/^@/, '').replace(/[^A-Za-z0-9._]/g, '') || null,
    photo: validPhoto(data.photoDataUrl)
  };
  if (!out.businessName || !out.city || !out.description) return { error: 'Please fill in your business name, city and description.' };
  if (CATEGORIES.indexOf(out.category) === -1) return { error: 'Please choose a category.' };
  if (!(out.price >= 0) || out.price > 1e10) return { error: 'Please enter a valid starting price.' };
  if (!out.portfolio) return { error: 'Please add a valid portfolio or Instagram link (e.g. https://instagram.com/yourbusiness).' };
  if (out.photo === undefined) return { error: 'That photo could not be used. Please try a smaller JPG or PNG.' };
  return { value: out };
};
