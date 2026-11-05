// Netlify runs this automatically when a vendor logs in (an Identity event).
// It sends the branded welcome email from orders@vendoorconnect.com, once per
// vendor. This is the backup, in case the sign-up event was ever missed.
// Returning no body leaves the vendor's account untouched.
const { sendVendorWelcome } = require('../lib/email');

exports.handler = async (event) => {
  try {
    const body = JSON.parse(event.body || '{}');
    const email = body.user && body.user.email;
    if (email) await sendVendorWelcome(email);
  } catch (err) {
    console.error('identity-login welcome error:', err && err.message);
  }
  return { statusCode: 204 };
};
