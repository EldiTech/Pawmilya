const { logger } = require('./logger');

// PayMongo API Configuration
// Sign up at https://dashboard.paymongo.com to get your keys
// Use test keys (pk_test_*, sk_test_*) for sandbox/development
const PAYMONGO_CONFIG = {
  SECRET_KEY: process.env.PAYMONGO_SECRET_KEY || '',
  PUBLIC_KEY: process.env.PAYMONGO_PUBLIC_KEY || '',
  BASE_URL: 'https://api.paymongo.com/v1',
  WEBHOOK_SECRET: process.env.PAYMONGO_WEBHOOK_SECRET || '',
  CURRENCY: 'PHP',
};

const getAuthHeader = () => {
  if (!PAYMONGO_CONFIG.SECRET_KEY) {
    throw new Error('PayMongo secret key is not configured. Set PAYMONGO_SECRET_KEY in .env');
  }
  return 'Basic ' + Buffer.from(PAYMONGO_CONFIG.SECRET_KEY + ':').toString('base64');
};

// Create a PayMongo checkout session
const createCheckoutSession = async ({ amount, description, remarks, metadata, successUrl, cancelUrl }) => {
  const response = await fetch(`${PAYMONGO_CONFIG.BASE_URL}/checkout_sessions`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': getAuthHeader(),
    },
    body: JSON.stringify({
      data: {
        attributes: {
          send_email_receipt: true,
          show_description: true,
          show_line_items: true,
          description,
          line_items: [
            {
              currency: PAYMONGO_CONFIG.CURRENCY,
              amount: Math.round(amount * 100), // PayMongo expects amount in cents
              name: description,
              quantity: 1,
            },
          ],
          payment_method_types: ['gcash', 'grab_pay', 'paymaya'],
          success_url: successUrl,
          cancel_url: cancelUrl,
          metadata: metadata || {},
          remarks: remarks || '',
        },
      },
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('PayMongo checkout session creation failed:', data);
    throw new Error(data.errors?.[0]?.detail || 'Failed to create checkout session');
  }

  return data.data;
};

// Retrieve a checkout session by ID
const retrieveCheckoutSession = async (checkoutSessionId) => {
  const response = await fetch(`${PAYMONGO_CONFIG.BASE_URL}/checkout_sessions/${checkoutSessionId}`, {
    method: 'GET',
    headers: {
      'Authorization': getAuthHeader(),
    },
  });

  const data = await response.json();

  if (!response.ok) {
    logger.error('PayMongo retrieve session failed:', data);
    throw new Error(data.errors?.[0]?.detail || 'Failed to retrieve checkout session');
  }

  return data.data;
};

module.exports = {
  PAYMONGO_CONFIG,
  createCheckoutSession,
  retrieveCheckoutSession,
};
