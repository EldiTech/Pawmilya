const db = require('./config/database');

(async () => {
  try {
    await db.query(`
      CREATE TABLE IF NOT EXISTS payment_transactions (
        id SERIAL PRIMARY KEY,
        adoption_application_id INTEGER NOT NULL UNIQUE REFERENCES adoption_applications(id) ON DELETE CASCADE,
        pet_id INTEGER REFERENCES pets(id) ON DELETE SET NULL,
        customer_user_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
        shelter_id INTEGER REFERENCES shelters(id) ON DELETE SET NULL,
        amount DECIMAL(10, 2) NOT NULL,
        currency VARCHAR(10) NOT NULL DEFAULT 'PHP',
        payment_provider VARCHAR(50) NOT NULL DEFAULT 'internal',
        provider_reference VARCHAR(255),
        payment_method VARCHAR(50),
        status VARCHAR(30) NOT NULL DEFAULT 'paid',
        notes TEXT,
        metadata JSONB DEFAULT '{}'::jsonb,
        paid_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
        updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    await db.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_shelter_id ON payment_transactions(shelter_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_customer_user_id ON payment_transactions(customer_user_id)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_status ON payment_transactions(status)');
    await db.query('CREATE INDEX IF NOT EXISTS idx_payment_transactions_paid_at ON payment_transactions(paid_at DESC)');

    console.log('payment_transactions ensured successfully.');
    process.exit(0);
  } catch (error) {
    console.error('Failed to ensure payment_transactions:', error.message);
    process.exit(1);
  }
})();
