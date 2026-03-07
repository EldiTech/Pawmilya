// Quick script to check shelter data in the database
const db = require('./config/database');

async function checkShelter() {
  try {
    console.log('Checking shelter data...\n');
    
    // Get shelter 3 with all fields
    const result = await db.query(`
      SELECT id, name, description, 
             animals_accepted, services_offered, 
             shelter_capacity, current_count, 
             contact_person_name, operating_hours,
             shelter_type, phone, email, address, city
      FROM shelters 
      WHERE id = 3
    `);
    
    if (result.rows.length === 0) {
      console.log('Shelter with ID 3 not found');
      
      // Try to list all shelters
      const allShelters = await db.query('SELECT id, name FROM shelters LIMIT 5');
      console.log('\nAvailable shelters:');
      allShelters.rows.forEach(s => console.log(`  - ID ${s.id}: ${s.name}`));
    } else {
      const shelter = result.rows[0];
      console.log('Shelter ID 3 data:');
      console.log('================');
      console.log('Name:', shelter.name);
      console.log('Description:', shelter.description || '(empty)');
      console.log('Animals Accepted:', shelter.animals_accepted || '(empty)');
      console.log('Services Offered:', shelter.services_offered || '(empty)');
      console.log('Shelter Capacity:', shelter.shelter_capacity || '(empty)');
      console.log('Current Count:', shelter.current_count || '(empty)');
      console.log('Contact Person:', shelter.contact_person_name || '(empty)');
      console.log('Operating Hours:', shelter.operating_hours || '(empty)');
      console.log('Shelter Type:', shelter.shelter_type || '(empty)');
      console.log('Phone:', shelter.phone || '(empty)');
      console.log('Email:', shelter.email || '(empty)');
      console.log('Address:', shelter.address || '(empty)');
      console.log('City:', shelter.city || '(empty)');
    }
    
    process.exit(0);
  } catch (error) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

checkShelter();
