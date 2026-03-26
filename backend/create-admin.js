const db = require('./config/database');
const bcrypt = require('bcryptjs');

const getArgValue = (flagName) => {
    const prefixed = process.argv.find(arg => arg.startsWith(`--${flagName}=`));
    if (prefixed) {
        return prefixed.split('=').slice(1).join('=').trim();
    }

    const flagIndex = process.argv.indexOf(`--${flagName}`);
    if (flagIndex !== -1 && process.argv[flagIndex + 1]) {
        return process.argv[flagIndex + 1].trim();
    }

    return '';
};

async function createAdmin() {
    const email = (getArgValue('email') || process.env.ADMIN_EMAIL || 'admin@pawmilya.com').toLowerCase();
    const password = getArgValue('password') || process.env.ADMIN_PASSWORD || 'admin123';
    const fullName = getArgValue('name') || process.env.ADMIN_NAME || 'Pawmilya Admin';
    const role = getArgValue('role') || process.env.ADMIN_ROLE || 'super_admin';

    if (!email || !password || !fullName) {
        throw new Error('Email, password, and name are required');
    }
    
    const hashedPassword = await bcrypt.hash(password, 10);

    const existingAdmin = await db.query(
        'SELECT id FROM admins WHERE email = $1',
        [email]
    );

    let result;

    if (existingAdmin.rows.length > 0) {
        result = await db.query(
            `UPDATE admins
             SET password_hash = $1,
                 full_name = $2,
                 role = $3,
                 is_active = true,
                 updated_at = CURRENT_TIMESTAMP
             WHERE email = $4
             RETURNING id, email, full_name, role`,
            [hashedPassword, fullName, role, email]
        );
        console.log('✅ Admin updated successfully!');
    } else {
        result = await db.query(
            'INSERT INTO admins (email, password_hash, full_name, role, is_active) VALUES ($1, $2, $3, $4, $5) RETURNING id, email, full_name, role',
            [email, hashedPassword, fullName, role, true]
        );
        console.log('✅ Admin created successfully!');
    }
    
    console.log('   Email:', result.rows[0].email);
    console.log('   Name:', result.rows[0].full_name);
    console.log('   Role:', result.rows[0].role);
    console.log('   Password:', password);
    console.log('');
    console.log('Usage examples:');
    console.log('   node create-admin.js --email manager@pawmilya.com --password StrongPass123 --name "Manager Admin" --role admin');
    console.log('   ADMIN_EMAIL=manager@pawmilya.com ADMIN_PASSWORD=StrongPass123 node create-admin.js');
    process.exit(0);
}

createAdmin().catch(e => {
    console.error('❌ Error:', e.message);
    process.exit(1);
});
