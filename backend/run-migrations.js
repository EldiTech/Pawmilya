const { Pool } = require('pg');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// ===========================================
// DATABASE MIGRATION SYSTEM
// ===========================================
// Tracks and runs database migrations in order
// Usage: node run-migrations.js [up|down|status|create name]

const pool = new Pool({
  host: process.env.DB_HOST || 'localhost',
  port: process.env.DB_PORT || 5432,
  database: process.env.DB_NAME || 'pawmilya',
  user: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD,
});

const MIGRATIONS_DIR = path.join(__dirname, 'database', 'migrations');

// Create migrations tracking table
async function initMigrationTable() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS migrations (
      id SERIAL PRIMARY KEY,
      name VARCHAR(255) NOT NULL UNIQUE,
      applied_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
}

// Get list of applied migrations
async function getAppliedMigrations() {
  const result = await pool.query('SELECT name FROM migrations ORDER BY id');
  return result.rows.map(row => row.name);
}

// Get all migration files
function getMigrationFiles() {
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return [];
  }
  
  return fs.readdirSync(MIGRATIONS_DIR)
    .filter(file => file.endsWith('.sql'))
    .sort();
}

// Run a single migration
async function runMigration(filename, direction = 'up') {
  const filepath = path.join(MIGRATIONS_DIR, filename);
  const content = fs.readFileSync(filepath, 'utf-8');
  
  // Parse up and down sections
  const upMatch = content.match(/-- UP\n([\s\S]*?)(?=-- DOWN|$)/i);
  const downMatch = content.match(/-- DOWN\n([\s\S]*?)$/i);
  
  let sql;
  if (direction === 'up') {
    sql = upMatch ? upMatch[1].trim() : content.trim();
  } else {
    sql = downMatch ? downMatch[1].trim() : null;
    if (!sql) {
      console.log(`⚠️  No DOWN migration found for ${filename}`);
      return false;
    }
  }
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    await client.query(sql);
    
    if (direction === 'up') {
      await client.query('INSERT INTO migrations (name) VALUES ($1)', [filename]);
    } else {
      await client.query('DELETE FROM migrations WHERE name = $1', [filename]);
    }
    
    await client.query('COMMIT');
    return true;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// Run all pending migrations
async function migrateUp() {
  await initMigrationTable();
  
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();
  const pending = files.filter(f => !applied.includes(f));
  
  if (pending.length === 0) {
    console.log('✅ Database is up to date. No migrations to run.');
    return;
  }
  
  console.log(`📦 Running ${pending.length} migration(s)...\n`);
  
  for (const file of pending) {
    try {
      console.log(`⏳ Applying: ${file}`);
      await runMigration(file, 'up');
      console.log(`✅ Applied: ${file}\n`);
    } catch (error) {
      console.error(`❌ Failed: ${file}`);
      console.error(`   Error: ${error.message}\n`);
      throw error;
    }
  }
  
  console.log('🎉 All migrations applied successfully!');
}

// Rollback last migration
async function migrateDown(count = 1) {
  await initMigrationTable();
  
  const applied = await getAppliedMigrations();
  
  if (applied.length === 0) {
    console.log('⚠️  No migrations to rollback.');
    return;
  }
  
  const toRollback = applied.slice(-count).reverse();
  
  console.log(`🔄 Rolling back ${toRollback.length} migration(s)...\n`);
  
  for (const file of toRollback) {
    try {
      console.log(`⏳ Rolling back: ${file}`);
      await runMigration(file, 'down');
      console.log(`✅ Rolled back: ${file}\n`);
    } catch (error) {
      console.error(`❌ Rollback failed: ${file}`);
      console.error(`   Error: ${error.message}\n`);
      throw error;
    }
  }
  
  console.log('🎉 Rollback completed!');
}

// Show migration status
async function showStatus() {
  await initMigrationTable();
  
  const applied = await getAppliedMigrations();
  const files = getMigrationFiles();
  
  console.log('\n📋 Migration Status\n');
  console.log('━'.repeat(60));
  
  for (const file of files) {
    const status = applied.includes(file) ? '✅' : '⏳';
    console.log(`${status} ${file}`);
  }
  
  console.log('━'.repeat(60));
  console.log(`\n📊 Applied: ${applied.length}/${files.length}`);
  
  const pending = files.filter(f => !applied.includes(f));
  if (pending.length > 0) {
    console.log(`⏳ Pending: ${pending.length}`);
  }
}

// Create a new migration file
function createMigration(name) {
  if (!name) {
    console.error('❌ Please provide a migration name');
    console.log('   Usage: node run-migrations.js create <name>');
    process.exit(1);
  }
  
  // Sanitize name
  const safeName = name.toLowerCase().replace(/[^a-z0-9]+/g, '_');
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const filename = `${timestamp}_${safeName}.sql`;
  const filepath = path.join(MIGRATIONS_DIR, filename);
  
  const template = `-- Migration: ${name}
-- Created: ${new Date().toISOString()}

-- UP
-- Write your migration SQL here



-- DOWN
-- Write the rollback SQL here

`;
  
  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
  }
  
  fs.writeFileSync(filepath, template);
  console.log(`✅ Created migration: ${filename}`);
  console.log(`   Location: ${filepath}`);
}

// CLI handler
async function main() {
  const command = process.argv[2] || 'up';
  const arg = process.argv[3];
  
  try {
    switch (command) {
      case 'up':
        await migrateUp();
        break;
      case 'down':
        await migrateDown(parseInt(arg) || 1);
        break;
      case 'status':
        await showStatus();
        break;
      case 'create':
        createMigration(arg);
        break;
      default:
        console.log(`
Database Migration Tool

Usage: node run-migrations.js [command]

Commands:
  up              Run all pending migrations (default)
  down [count]    Rollback last N migrations (default: 1)
  status          Show migration status
  create <name>   Create a new migration file

Examples:
  node run-migrations.js up
  node run-migrations.js down 2
  node run-migrations.js create add_user_avatar
        `);
    }
  } catch (error) {
    console.error('\n💥 Migration failed:', error.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

main();
