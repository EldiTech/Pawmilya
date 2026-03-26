const express = require('express');
const db = require('../config/database');
const { authenticateToken } = require('../middleware/auth');
const { createCheckoutSession, retrieveCheckoutSession } = require('../config/paymongo');
const { logger } = require('../config/logger');
const { createPaymentTransaction } = require('../utils/paymentTransactions');

const router = express.Router();

const isPayMongoSessionPaid = (session) => {
  const status = String(session?.attributes?.status || '').toLowerCase();
  if (status === 'paid' || status === 'succeeded') {
    return true;
  }

  const payments = Array.isArray(session?.attributes?.payments) ? session.attributes.payments : [];
  return payments.some((payment) => {
    const paymentStatus = String(payment?.attributes?.status || payment?.status || '').toLowerCase();
    return paymentStatus === 'paid' || paymentStatus === 'succeeded';
  });
};

// Create a PayMongo checkout session for an approved adoption
router.post('/create-checkout', authenticateToken, async (req, res) => {
  try {
    const { adoptionId, deliveryDetails } = req.body;

    if (!adoptionId || !deliveryDetails) {
      return res.status(400).json({ error: 'Adoption ID and delivery details are required' });
    }

    const { fullName, phone, address, city } = deliveryDetails;
    if (!fullName || !phone || !address || !city) {
      return res.status(400).json({ error: 'Full name, phone, address, and city are required' });
    }

    // Verify the application belongs to the user and is approved
    const appCheck = await db.query(
      `SELECT a.id, a.status, a.payment_completed, a.pet_id, p.name as pet_name, p.adoption_fee
       FROM adoption_applications a
       JOIN pets p ON a.pet_id = p.id
       WHERE a.id = $1 AND a.user_id = $2`,
      [adoptionId, req.user.id]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appCheck.rows[0];

    if (application.status !== 'approved') {
      return res.status(400).json({ error: 'Application must be approved before payment' });
    }

    if (application.payment_completed) {
      return res.status(400).json({ error: 'Payment has already been completed for this adoption' });
    }

    const adoptionFee = application.adoption_fee || 500;

    // Store delivery details temporarily so we can save them after payment succeeds
    await db.query(
      `UPDATE adoption_applications 
       SET delivery_full_name = $1,
           delivery_phone = $2,
           delivery_address = $3,
           delivery_city = $4,
           delivery_postal_code = $5,
           delivery_notes = $6,
           updated_at = NOW()
       WHERE id = $7`,
      [
        deliveryDetails.fullName,
        deliveryDetails.phone,
        deliveryDetails.address,
        deliveryDetails.city,
        deliveryDetails.postalCode || '',
        deliveryDetails.notes || '',
        adoptionId,
      ]
    );

    // Create PayMongo checkout session
    // Use the actual request host so the redirect works on physical devices
    // (BASE_URL defaults to localhost which is unreachable from phones)
    const baseUrl = `${req.protocol}://${req.get('host')}`;
    const session = await createCheckoutSession({
      amount: adoptionFee,
      description: `Adoption Fee - ${application.pet_name}`,
      remarks: `Adoption Application #${adoptionId}`,
      metadata: {
        adoption_id: String(adoptionId),
        user_id: String(req.user.id),
        pet_name: application.pet_name,
      },
      successUrl: `${baseUrl}/api/payments/success?adoption_id=${adoptionId}`,
      cancelUrl: `${baseUrl}/api/payments/cancel?adoption_id=${adoptionId}`,
    });

    // Store the checkout session ID for later verification
    await db.query(
      `UPDATE adoption_applications SET paymongo_checkout_id = $1, updated_at = NOW() WHERE id = $2`,
      [session.id, adoptionId]
    );

    res.json({
      success: true,
      checkoutUrl: session.attributes.checkout_url,
      checkoutId: session.id,
    });
  } catch (error) {
    logger.error('Create checkout error:', error);
    res.status(500).json({ error: error.message || 'Failed to create payment session' });
  }
});

// Verify payment status for an adoption
router.get('/verify/:adoptionId', authenticateToken, async (req, res) => {
  try {
    const { adoptionId } = req.params;

    const appCheck = await db.query(
      `SELECT a.id, a.status, a.payment_completed, a.paymongo_checkout_id, a.pet_id,
              p.shelter_id, p.adoption_fee
       FROM adoption_applications a
       JOIN pets p ON p.id = a.pet_id
       WHERE a.id = $1 AND a.user_id = $2`,
      [adoptionId, req.user.id]
    );

    if (appCheck.rows.length === 0) {
      return res.status(404).json({ error: 'Application not found' });
    }

    const application = appCheck.rows[0];

    // Already completed
    if (application.payment_completed) {
      return res.json({ success: true, status: 'paid', message: 'Payment already completed' });
    }

    if (!application.paymongo_checkout_id) {
      return res.json({ success: false, status: 'no_session', message: 'No payment session found' });
    }

    // Check with PayMongo
    const session = await retrieveCheckoutSession(application.paymongo_checkout_id);
    const paymentStatus = String(session?.attributes?.status || '').toLowerCase() || 'unknown';

    if (paymentStatus === 'active' || paymentStatus === 'expired') {
      return res.json({ success: false, status: paymentStatus, message: `Payment session is ${paymentStatus}` });
    }

    // Payment successful — update the adoption only for final paid states.
    if (isPayMongoSessionPaid(session)) {
      const paymentAmount = session.attributes.line_items?.[0]?.amount
        ? session.attributes.line_items[0].amount / 100
        : application.adoption_fee || 500;

      await db.query(
        `UPDATE adoption_applications 
         SET payment_completed = true,
             payment_amount = $1,
             payment_date = NOW(),
             payment_method = 'paymongo',
             delivery_status = 'processing',
             delivery_updated_at = NOW(),
             updated_at = NOW()
         WHERE id = $2`,
        [paymentAmount, adoptionId]
      );

      // Update pet status to adopted
      await db.query('UPDATE pets SET status = $1 WHERE id = $2', ['adopted', application.pet_id]);

      await createPaymentTransaction({
        adoptionId: parseInt(adoptionId, 10),
        petId: application.pet_id,
        customerUserId: req.user.id,
        shelterId: application.shelter_id,
        amount: paymentAmount,
        paymentProvider: 'paymongo',
        providerReference: application.paymongo_checkout_id,
        paymentMethod: 'paymongo',
        status: 'paid',
        notes: 'Payment verified from PayMongo checkout session',
        metadata: {
          checkout_session_status: paymentStatus,
          source: 'verify_payment_endpoint',
        },
      });

      return res.json({
        success: true,
        status: 'paid',
        message: 'Payment verified and adoption confirmed',
      });
    }

    res.json({ success: false, status: paymentStatus, message: 'Payment not yet completed' });
  } catch (error) {
    logger.error('Payment verification error:', error);
    res.status(500).json({ error: 'Failed to verify payment' });
  }
});

// Success redirect page (shown in WebView after payment)
router.get('/success', async (req, res) => {
  const { adoption_id } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #D1FAE5 0%, #ECFDF5 100%); }
        .container { text-align: center; padding: 40px 20px; }
        .icon { font-size: 72px; margin-bottom: 16px; }
        h1 { color: #059669; font-size: 24px; margin-bottom: 8px; }
        p { color: #64748B; font-size: 16px; margin-bottom: 24px; }
        .note { color: #94A3B8; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">🎉</div>
        <h1>Payment Submitted</h1>
        <p>Your payment is being verified. You can return to the app to check the latest status.</p>
        <p class="note">You can close this window now.</p>
      </div>
      <script>
        // Notify the React Native WebView
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_SUCCESS',
            adoptionId: '${adoption_id ? String(parseInt(adoption_id, 10)) : ''}'
          }));
        }
      </script>
    </body>
    </html>
  `);
});

// Cancel redirect page
router.get('/cancel', async (req, res) => {
  const { adoption_id } = req.query;
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <style>
        body { font-family: -apple-system, BlinkMacSystemFont, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: linear-gradient(135deg, #FEE2E2 0%, #FEF2F2 100%); }
        .container { text-align: center; padding: 40px 20px; }
        .icon { font-size: 72px; margin-bottom: 16px; }
        h1 { color: #DC2626; font-size: 24px; margin-bottom: 8px; }
        p { color: #64748B; font-size: 16px; margin-bottom: 24px; }
        .note { color: #94A3B8; font-size: 14px; }
      </style>
    </head>
    <body>
      <div class="container">
        <div class="icon">😔</div>
        <h1>Payment Cancelled</h1>
        <p>Your payment was not completed. You can try again anytime.</p>
        <p class="note">You can close this window now.</p>
      </div>
      <script>
        if (window.ReactNativeWebView) {
          window.ReactNativeWebView.postMessage(JSON.stringify({
            type: 'PAYMENT_CANCELLED',
            adoptionId: '${adoption_id ? String(parseInt(adoption_id, 10)) : ''}'
          }));
        }
      </script>
    </body>
    </html>
  `);
});

module.exports = router;
