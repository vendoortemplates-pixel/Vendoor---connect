// Netlify runs this automatically when a vendor confirms their new account (an Identity event).
// It sends the branded welcome email from orders@vendoorconnect.com, once per
// vendor. This is the main trigger.
// Returning no body leaves the vendor's account untouched.
const { sendVendorWelcome } = require('../lib/email');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const email = body.user && body.user.email;
    if (email) await sendVendorWelcome(email);
  } catch (err) {
    console.error('identity-signup welcome error:', err && err.message);
  }
  return { statusCode: 204 };
};
