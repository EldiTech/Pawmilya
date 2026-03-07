const db = require('./config/database');
const bcrypt = require('bcrypt');

async function testAdmin() {
  try {
    const result = await db.query('SELECT * FROM admins WHERE email = $1', ['admin@pawmilya.com']);
    
    if (result.rows.length === 0) {
      console.log('❌ Admin not found');
      return;
    }

    const admin = result.rows[0];
    console.log('✅ Admin found:', {
      id: admin.id,
      email: admin.email,
      full_name: admin.full_name,
      role: admin.role,
      is_active: admin.is_active
    });
    
    console.log('\n📝 Password hash:', admin.password_hash);
    
    // Test password
    const testPassword = 'moymoy2004'; // Change this to your password
    const isValid = await bcrypt.compare(testPassword, admin.password_hash);
    console.log(`\n🔐 Testing password "${testPassword}":`, isValid ? '✅ VALID' : '❌ INVALID');
    
    process.exit(0);
  } catch (error) {
    console.error('❌ Error:', error.message);
    process.exit(1);
  }
}

testAdmin();
