/**
 * Cleanup Script: Remove orphaned rescuer applications
 * 
 * This script removes rescuer applications that reference user_ids
 * that no longer exist in the users table. This can happen if users
 * are deleted but their applications weren't cleaned up properly.
 * 
 * Run this script with: node backend/database/cleanup_orphaned_applications.js
 */

const db = require('../config/database');

const cleanupOrphanedApplications = async () => {
  console.log('🧹 Starting cleanup of orphaned rescuer applications...\n');
  
  try {
    // Find orphaned applications (applications where user no longer exists)
    const orphanedResult = await db.query(`
      SELECT ra.id, ra.user_id, ra.full_name, ra.email, ra.status, ra.created_at
      FROM rescuer_applications ra
      LEFT JOIN users u ON ra.user_id = u.id
      WHERE u.id IS NULL
    `);
    
    console.log(`Found ${orphanedResult.rows.length} orphaned application(s):\n`);
    
    if (orphanedResult.rows.length > 0) {
      orphanedResult.rows.forEach((app, index) => {
        console.log(`  ${index + 1}. ID: ${app.id}, User ID: ${app.user_id}, Name: ${app.full_name}, Status: ${app.status}`);
      });
      
      console.log('\n🗑️  Deleting orphaned applications...');
      
      // Delete orphaned applications
      const deleteResult = await db.query(`
        DELETE FROM rescuer_applications
        WHERE user_id NOT IN (SELECT id FROM users)
        RETURNING id
      `);
      
      console.log(`✅ Deleted ${deleteResult.rows.length} orphaned application(s)\n`);
    } else {
      console.log('✅ No orphaned applications found. Database is clean!\n');
    }
    
    // Also check for applications with mismatched emails
    console.log('🔍 Checking for applications with mismatched emails...\n');
    
    const mismatchedResult = await db.query(`
      SELECT ra.id, ra.user_id, ra.email as app_email, u.email as user_email, ra.status
      FROM rescuer_applications ra
      JOIN users u ON ra.user_id = u.id
      WHERE ra.email IS NOT NULL AND ra.email != u.email
    `);
    
    console.log(`Found ${mismatchedResult.rows.length} application(s) with mismatched emails:\n`);
    
    if (mismatchedResult.rows.length > 0) {
      mismatchedResult.rows.forEach((app, index) => {
        console.log(`  ${index + 1}. ID: ${app.id}, App Email: ${app.app_email}, User Email: ${app.user_email}, Status: ${app.status}`);
      });
      console.log('\n⚠️  These applications may belong to a different person who had this user_id before.');
      console.log('   Consider manually reviewing and deleting them if needed.\n');
    } else {
      console.log('✅ No mismatched emails found!\n');
    }
    
  } catch (error) {
    console.error('❌ Error during cleanup:', error);
  } finally {
    // Close database connection
    await db.end();
    console.log('Done!');
  }
};

cleanupOrphanedApplications();
