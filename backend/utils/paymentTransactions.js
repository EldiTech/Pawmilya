const db = require('../config/database');
const { logger } = require('../config/logger');

const toAmount = (value) => {
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0) return 0;
  return parsed;
};

const safeJson = (value) => {
  if (!value || typeof value !== 'object') return {};
  return value;
};

async function createPaymentTransaction({
  adoptionId,
  petId,
  customerUserId,
  shelterId,
  amount,
  currency = 'PHP',
  paymentProvider = 'internal',
  providerReference = null,
  paymentMethod = null,
  status = 'paid',
  notes = null,
  metadata = {},
}) {
  if (!adoptionId) {
    throw new Error('adoptionId is required when creating payment transaction');
  }

  const normalizedAmount = toAmount(amount);

  try {
    const result = await db.query(
      `INSERT INTO payment_transactions (
        adoption_application_id,
        pet_id,
        customer_user_id,
        shelter_id,
        amount,
        currency,
        payment_provider,
        provider_reference,
        payment_method,
        status,
        notes,
        metadata,
        paid_at,
        updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::jsonb, NOW(), NOW())
      ON CONFLICT (adoption_application_id)
      DO UPDATE SET
        pet_id = EXCLUDED.pet_id,
        customer_user_id = EXCLUDED.customer_user_id,
        shelter_id = EXCLUDED.shelter_id,
        amount = EXCLUDED.amount,
        currency = EXCLUDED.currency,
        payment_provider = EXCLUDED.payment_provider,
        provider_reference = EXCLUDED.provider_reference,
        payment_method = EXCLUDED.payment_method,
        status = EXCLUDED.status,
        notes = EXCLUDED.notes,
        metadata = EXCLUDED.metadata,
        paid_at = COALESCE(payment_transactions.paid_at, EXCLUDED.paid_at),
        updated_at = NOW()
      RETURNING id, adoption_application_id, status, amount, payment_provider, payment_method, paid_at`,
      [
        adoptionId,
        petId || null,
        customerUserId || null,
        shelterId || null,
        normalizedAmount,
        currency,
        paymentProvider,
        providerReference,
        paymentMethod,
        status,
        notes,
        JSON.stringify(safeJson(metadata)),
      ]
    );

    return result.rows[0] || null;
  } catch (error) {
    logger.error('Failed to create payment transaction record', {
      error: error.message,
      adoptionId,
      shelterId,
      customerUserId,
    });
    throw error;
  }
}

module.exports = {
  createPaymentTransaction,
};
