/**
 * Shelter Images Migration Script
 * 
 * This script runs the enhanced shelter images migration to add
 * new columns and create the shelter_images table.
 * 
 * Usage:
 *   node run-shelter-migration.js
 * 
 * Prerequisites:
 *   - PostgreSQL database connection configured in .env
 *   - Database should be running
 */

const fs = require('fs');
const path = require('path');
const db = require('./config/database');

async function runMigration() {
  console.log('🚀 Starting Enhanced Shelter Images Migration...\n');
  
  try {
    // Read the migration SQL file
    const migrationPath = path.join(__dirname, 'database', 'migrations', 'enhanced_shelter_images.sql');
    const migrationSQL = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Migration file loaded successfully');
    console.log('📦 Running migration...\n');
    
    // Execute the migration
    await db.query(migrationSQL);
    
    console.log('✅ Migration completed successfully!\n');
    
    // Verify the changes
    console.log('🔍 Verifying migration...\n');
    
    // Check shelter_images table
    const tableCheck = await db.query(`
      SELECT EXISTS (
        SELECT FROM information_schema.tables 
        WHERE table_name = 'shelter_images'
      );
    `);
    
    if (tableCheck.rows[0].exists) {
      console.log('✅ shelter_images table created');
    } else {
      console.log('❌ shelter_images table NOT created');
    }
    
    // Check for new columns in shelters table
    const columnsCheck = await db.query(`
      SELECT column_name 
      FROM information_schema.columns 
      WHERE table_name = 'shelters' 
        AND column_name IN ('logo_image', 'cover_image', 'proof_document_image', 'verification_status')
    `);
    
    console.log(`✅ Added ${columnsCheck.rows.length} new columns to shelters table:`);
    columnsCheck.rows.forEach(row => {
      console.log(`   - ${row.column_name}`);
    });
    
    console.log('\n🎉 Enhanced Shelter Management System is ready!');
    console.log('\n📝 Summary of changes:');
    console.log('   1. Created shelter_images table for storing multiple images');
    console.log('   2. Added logo_image column for base64 logos');
    console.log('   3. Added cover_image column for base64 cover photos');
    console.log('   4. Added proof_document_image for verification documents');
    console.log('   5. Added shelter_type, verification_status, and other fields');
    console.log('\n💡 Images are now stored as base64 directly in the database');
    console.log('   for reliable storage and retrieval.\n');
    
  } catch (error) {
    console.error('❌ Migration failed:', error.message);
    console.error('\nFull error:', error);
    process.exit(1);
  } finally {
    // Close database connection if pool.end exists
    if (db.pool && typeof db.pool.end === 'function') {
      await db.pool.end();
    }
    process.exit(0);
  }
}

runMigration();
