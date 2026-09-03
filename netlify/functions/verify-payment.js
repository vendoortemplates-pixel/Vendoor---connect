// Confirms a Paystack transaction actually succeeded before the site ever
// reveals a download link, so a shopper can't get a template just by
// editing the thank-you.html URL (with a fake or someone else's reference)
// or by cancelling a payment. Paystack is the source of truth here, not
// anything passed in the URL from the client-side checkout callback.
//
// Requires the PAYSTACK_SECRET_KEY environment variable (the "Secret Key"
// from Paystack's dashboard under Settings > API Keys & Webhooks — NOT the
// publishable key already used in main.js). Add it as an Environment
// Variable in Netlify the same way NETLIFY_DB_URL was added.
const PAYSTACK_SECRET = process.env.PAYSTACK_SECRET_KEY;

exports.handler = async (event) => {
  const reference = event.queryStringParameters && event.queryStringParameters.reference;

  if (!reference) {
    return {
      statusCode: 400,
      body: JSON.stringify({ ok: false, error: 'Missing payment reference.' })
    };
  }

  if (!PAYSTACK_SECRET) {
    console.error('verify-payment: PAYSTACK_SECRET_KEY is not set.');
    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: false,
        error: 'Payment verification is not fully set up yet on our end.'
      })
    };
  }

  try {
    const res = await fetch(
      'https://api.paystack.co/transaction/verify/' + encodeURIComponent(reference),
      { headers: { Authorization: 'Bearer ' + PAYSTACK_SECRET } }
    );
    const data = await res.json();

    if (!res.ok || !data || !data.status || !data.data || data.data.status !== 'success') {
      return {
        statusCode: 200,
        body: JSON.stringify({ ok: false, error: 'We could not verify this payment as successful.' })
      };
    }

    const customFields = (data.data.metadata && data.data.metadata.custom_fields) || [];
    const slugField = customFields.filter(function (f) { return f.variable_name === 'product_slug'; })[0];
    const nameField = customFields.filter(function (f) { return f.variable_name === 'template_name'; })[0];

    return {
      statusCode: 200,
      body: JSON.stringify({
        ok: true,
        reference: data.data.reference,
        amount: data.data.amount,
        productSlug: slugField ? slugField.value : null,
        templateName: nameField ? nameField.value : null
      })
    };
  } catch (err) {
    console.error('verify-payment error:', err);
    return {
      statusCode: 200,
      body: JSON.stringify({ ok: false, error: 'Something went wrong verifying your payment.' })
    };
  }
};
