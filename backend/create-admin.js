const db = require('./config/database');
const bcrypt = require('bcryptjs');

async function createAdmin() {
    const email = 'admin@pawmilya.com';
    const password = 'admin123';
    const fullName = 'Pawmilya Admin';
    
    const hashedPassword = await bcrypt.hash(password, 10);
    
    const result = await db.query(
        'INSERT INTO admins (email, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name',
        [email, hashedPassword, fullName, 'super_admin', true]
    );
    
    console.log('✅ Admin created successfully!');
    console.log('   Email:', email);
    console.log('   Password:', password);
    process.exit(0);
}

createAdmin().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
