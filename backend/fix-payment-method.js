const db = require('./config/database');

(async () => {
  try {
    const r = await db.query(
      `UPDATE adoption_applications 
       SET payment_method = 'paymongo' 
       WHERE paymongo_checkout_id IS NOT NULL 
         AND (payment_method IS NULL OR payment_method != 'paymongo')
       RETURNING id, payment_method, paymongo_checkout_id`
    );
    console.log('Fixed', r.rowCount, 'records:', JSON.stringify(r.rows, null, 2));
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
