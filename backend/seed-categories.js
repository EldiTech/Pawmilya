const db = require('./config/database');

(async () => {
  try {
    // Delete existing categories and re-insert with correct IDs
    await db.query('DELETE FROM pet_categories');
    await db.query(`
      INSERT INTO pet_categories (id, name, description, icon) VALUES 
      (1, 'Dog', 'Canine companions', 'paw'),
      (2, 'Cat', 'Feline friends', 'paw'),
      (3, 'Bird', 'Feathered pets', 'paw'),
      (4, 'Rabbit', 'Small mammals', 'paw'),
      (5, 'Other', 'Other animals', 'paw')
    `);

    // Reset the serial sequence
    await db.query("SELECT setval('pet_categories_id_seq', 5)");

    const r = await db.query('SELECT * FROM pet_categories ORDER BY id');
    console.log('Pet categories seeded:', r.rows);
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
