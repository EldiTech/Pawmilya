const db = require('./config/database');

async function runMigration() {
  try {
    console.log('Running PayMongo migration...');
    
    await db.query(`
      ALTER TABLE adoption_applications 
      ADD COLUMN IF NOT EXISTS paymongo_checkout_id VARCHAR(255),
      ADD COLUMN IF NOT EXISTS payment_method VARCHAR(50) DEFAULT 'cod'
    `);
    
    await db.query(`
      CREATE INDEX IF NOT EXISTS idx_adoption_paymongo_checkout 
      ON adoption_applications(paymongo_checkout_id) 
      WHERE paymongo_checkout_id IS NOT NULL
    `);
    
    console.log('PayMongo migration completed successfully!');
  } catch (error) {
    console.error('Migration error:', error.message);
  } finally {
    process.exit(0);
  }
}

runMigration();
