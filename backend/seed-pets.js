const db = require('./config/database');

(async () => {
  try {
    console.log('Seeding 10 adoption pets and 10 rescue reports with images...\n');

    // Ensure categories exist so category_id foreign keys are valid.
    await db.query(`
      INSERT INTO pet_categories (id, name, description, icon) VALUES
      (1, 'Dog', 'Canine companions', 'paw'),
      (2, 'Cat', 'Feline friends', 'paw'),
      (3, 'Bird', 'Feathered pets', 'paw'),
      (4, 'Rabbit', 'Small mammals', 'paw'),
      (5, 'Other', 'Other animals', 'paw')
      ON CONFLICT (id) DO NOTHING
    `);

    const adoptablePets = [
      {
        name: 'Brownie',
        category_id: 1,
        breed_name: 'Aspin (Asong Pinoy)',
        age_years: 2, age_months: 4,
        gender: 'Male', size: 'medium', weight_kg: 12.5,
        color: 'Brown',
        description: 'Playful and loyal Aspin who loves walks and cuddles.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: true, is_good_with_other_pets: true,
        temperament: ['friendly', 'playful', 'loyal'],
        status: 'available', is_featured: true,
        adoption_fee: 500,
        location: 'Cebu City',
        images: [
          'https://images.unsplash.com/photo-1517849845537-4d257902454a?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1518717758536-85ae29035b6d?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Mingming',
        category_id: 2,
        breed_name: 'Puspin (Pusang Pinoy)',
        age_years: 1, age_months: 6,
        gender: 'Female', size: 'small', weight_kg: 3.2,
        color: 'Orange Tabby',
        description: 'Sweet and curious tabby cat that enjoys lap naps.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: true, is_good_with_other_pets: true,
        temperament: ['calm', 'affectionate', 'curious'],
        status: 'available', is_featured: true,
        adoption_fee: 350,
        location: 'Mandaue City',
        images: [
          'https://images.unsplash.com/photo-1519052537078-e6302a4968d4?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1533738363-b7f9aef128ce?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Choco',
        category_id: 1,
        breed_name: 'Labrador Retriever Mix',
        age_years: 3, age_months: 0,
        gender: 'Male', size: 'large', weight_kg: 25.0,
        color: 'Chocolate Brown',
        description: 'Gentle giant that loves fetch and family time.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: true, is_good_with_other_pets: true,
        temperament: ['gentle', 'loyal', 'energetic'],
        status: 'available', is_featured: false,
        adoption_fee: 800,
        location: 'Lapu-Lapu City',
        images: [
          'https://images.unsplash.com/photo-1552053831-71594a27632d?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1568572933382-74d440642117?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Snow',
        category_id: 2,
        breed_name: 'Persian Mix',
        age_years: 4, age_months: 2,
        gender: 'Female', size: 'medium', weight_kg: 4.5,
        color: 'White',
        description: 'Calm and elegant cat suited for quiet homes.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: false, is_good_with_other_pets: true,
        temperament: ['calm', 'independent', 'gentle'],
        status: 'available', is_featured: true,
        adoption_fee: 1200,
        location: 'Talisay City',
        images: [
          'https://images.unsplash.com/photo-1573865526739-10659fec78a5?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Tweety',
        category_id: 3,
        breed_name: 'Budgerigar (Parakeet)',
        age_years: 1, age_months: 0,
        gender: 'Male', size: 'small', weight_kg: 0.03,
        color: 'Green and Yellow',
        description: 'Cheerful budgie that whistles and mimics simple sounds.',
        vaccination_status: 'not_vaccinated',
        is_neutered: false, is_house_trained: false,
        is_good_with_kids: true, is_good_with_other_pets: false,
        temperament: ['energetic', 'playful', 'vocal'],
        status: 'available', is_featured: false,
        adoption_fee: 250,
        location: 'Cebu City',
        images: [
          'https://images.unsplash.com/photo-1452570053594-1b985d6ea890?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1444464666168-49d633b86797?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Cotton',
        category_id: 4,
        breed_name: 'Holland Lop',
        age_years: 0, age_months: 8,
        gender: 'Female', size: 'small', weight_kg: 1.8,
        color: 'White and Grey',
        description: 'Fluffy bunny with a gentle personality.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: true, is_good_with_other_pets: true,
        temperament: ['calm', 'gentle', 'friendly'],
        status: 'available', is_featured: true,
        adoption_fee: 600,
        location: 'Minglanilla',
        images: [
          'https://images.unsplash.com/photo-1585110396000-c9ffd4e4b308?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1535241749838-299277b6305f?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Olive',
        category_id: 2,
        breed_name: 'Domestic Shorthair',
        age_years: 2, age_months: 7,
        gender: 'Female', size: 'small', weight_kg: 3.9,
        color: 'Gray',
        description: 'Quiet indoor cat that likes sunny windows and soft toys.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: true, is_good_with_other_pets: false,
        temperament: ['calm', 'observant', 'gentle'],
        status: 'available', is_featured: false,
        adoption_fee: 400,
        location: 'Liloan',
        images: [
          'https://images.unsplash.com/photo-1495360010541-f48722b34f7d?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1511044568932-338cba0ad803?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Bubbles',
        category_id: 3,
        breed_name: 'Cockatiel',
        age_years: 1, age_months: 3,
        gender: 'Female', size: 'small', weight_kg: 0.09,
        color: 'Yellow and Grey',
        description: 'Gentle cockatiel that likes perching and soft whistles.',
        vaccination_status: 'not_vaccinated',
        is_neutered: false, is_house_trained: false,
        is_good_with_kids: true, is_good_with_other_pets: false,
        temperament: ['gentle', 'social', 'alert'],
        status: 'available', is_featured: false,
        adoption_fee: 300,
        location: 'Cebu City',
        images: [
          'https://images.unsplash.com/photo-1585699324551-f6c309eedeca?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1522926193341-e9ffd686c60f?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Hazel',
        category_id: 4,
        breed_name: 'Mini Rex',
        age_years: 1, age_months: 2,
        gender: 'Female', size: 'small', weight_kg: 1.6,
        color: 'Brown',
        description: 'Curious rabbit that enjoys hay tunnels and veggies.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: true, is_good_with_other_pets: true,
        temperament: ['curious', 'friendly', 'gentle'],
        status: 'available', is_featured: false,
        adoption_fee: 550,
        location: 'Talisay City',
        images: [
          'https://images.unsplash.com/photo-1452857297128-d9c29adba80b?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1548767797-d8c844163c4c?auto=format&fit=crop&w=1200&q=80'
        ]
      },
      {
        name: 'Milo',
        category_id: 1,
        breed_name: 'Shih Tzu Mix',
        age_years: 4, age_months: 5,
        gender: 'Male', size: 'small', weight_kg: 7.1,
        color: 'White and Brown',
        description: 'Relaxed companion dog that enjoys short walks and lap time.',
        vaccination_status: 'fully_vaccinated',
        is_neutered: true, is_house_trained: true,
        is_good_with_kids: true, is_good_with_other_pets: true,
        temperament: ['calm', 'friendly', 'loyal'],
        status: 'available', is_featured: true,
        adoption_fee: 650,
        location: 'Mandaue City',
        images: [
          'https://images.unsplash.com/photo-1591768575198-88dac53fbd0a?auto=format&fit=crop&w=1200&q=80',
          'https://images.unsplash.com/photo-1525253086316-d0c936c814f8?auto=format&fit=crop&w=1200&q=80'
        ]
      }
    ];

    console.log('Inserting 10 adoptable pets and pet images...');
    for (const pet of adoptablePets) {
      const insertPetResult = await db.query(
        `INSERT INTO pets (
          name, category_id, breed_name, age_years, age_months, gender, size,
          weight_kg, color, description, vaccination_status, is_neutered,
          is_house_trained, is_good_with_kids, is_good_with_other_pets,
          temperament, status, is_featured, adoption_fee, location, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,$20,NOW()
        ) RETURNING id`,
        [
          pet.name, pet.category_id, pet.breed_name, pet.age_years, pet.age_months,
          pet.gender, pet.size, pet.weight_kg, pet.color, pet.description,
          pet.vaccination_status, pet.is_neutered, pet.is_house_trained,
          pet.is_good_with_kids, pet.is_good_with_other_pets, pet.temperament,
          pet.status, pet.is_featured, pet.adoption_fee, pet.location
        ]
      );

      const petId = insertPetResult.rows[0].id;
      for (let i = 0; i < pet.images.length; i++) {
        await db.query(
          `INSERT INTO pet_images (pet_id, image_url, is_primary, display_order, created_at)
           VALUES ($1, $2, $3, $4, NOW())`,
          [petId, pet.images[i], i === 0, i]
        );
      }

      console.log(`  Added pet: ${pet.name}`);
    }

    const rescueReports = [
      {
        title: 'Injured Puppy Near Carbon Market',
        description: 'Small puppy with a leg injury and signs of dehydration.',
        animal_type: 'Dog', estimated_count: 1, condition: 'injured', urgency: 'critical',
        location_description: 'Near the entrance of Carbon Market, beside the fish section',
        address: 'Carbon Market', city: 'Cebu City', latitude: 10.2934, longitude: 123.9019,
        status: 'new',
        reporter_name: 'Maria Santos', reporter_phone: '09171234567', reporter_email: 'maria.santos@email.com',
        images: ['https://images.unsplash.com/photo-1583511655857-d19b40a7a54e?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Stray Cat Colony Under Bridge',
        description: 'Several cats with possible eye infection needing treatment.',
        animal_type: 'Cat', estimated_count: 5, condition: 'sick', urgency: 'high',
        location_description: 'Under the old Mactan bridge, near the fisherman area',
        address: 'Old Mactan Bridge', city: 'Lapu-Lapu City', latitude: 10.3115, longitude: 123.9498,
        status: 'new',
        reporter_name: 'Juan Dela Cruz', reporter_phone: '09189876543', reporter_email: 'juan.dc@email.com',
        images: ['https://images.unsplash.com/photo-1478098711619-5ab0b478d6e6?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Abandoned Dog Tied to Post',
        description: 'Dog has been left tied without food or water for days.',
        animal_type: 'Dog', estimated_count: 1, condition: 'sick', urgency: 'high',
        location_description: 'Abandoned building along V. Rama Avenue, near the gas station',
        address: 'V. Rama Avenue', city: 'Cebu City', latitude: 10.3069, longitude: 123.8854,
        status: 'new',
        reporter_name: 'Ana Reyes', reporter_phone: '09201112233', reporter_email: 'ana.reyes@email.com',
        images: ['https://images.unsplash.com/photo-1537151625747-768eb6cf92b2?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Kitten Stuck on Rooftop',
        description: 'Young kitten trapped on rooftop and unable to climb down.',
        animal_type: 'Cat', estimated_count: 1, condition: 'unknown', urgency: 'normal',
        location_description: 'Residential area in Basak, San Nicolas, near barangay hall',
        address: 'Basak San Nicolas', city: 'Cebu City', latitude: 10.2922, longitude: 123.8750,
        status: 'new',
        reporter_name: 'Pedro Garcia', reporter_phone: '09331234567', reporter_email: 'pedro.g@email.com',
        images: ['https://images.unsplash.com/photo-1548247416-ec66f4900b2e?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Dog Hit by Motorcycle',
        description: 'Street dog limping after being hit by a motorcycle.',
        animal_type: 'Dog', estimated_count: 1, condition: 'injured', urgency: 'critical',
        location_description: 'Near SRP side road, close to food stalls',
        address: 'South Road Properties', city: 'Cebu City', latitude: 10.2842, longitude: 123.8826,
        status: 'new',
        reporter_name: 'Rico Manalo', reporter_phone: '09175557777', reporter_email: 'rico.manalo@email.com',
        images: ['https://images.unsplash.com/photo-1601758228041-f3b2795255f1?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Puppies Found in Box',
        description: 'Four puppies were left in a cardboard box in the rain.',
        animal_type: 'Dog', estimated_count: 4, condition: 'unknown', urgency: 'high',
        location_description: 'Outside public market terminal',
        address: 'Mandaue Public Market', city: 'Mandaue City', latitude: 10.3236, longitude: 123.9311,
        status: 'new',
        reporter_name: 'Liza Torres', reporter_phone: '09176668888', reporter_email: 'liza.torres@email.com',
        images: ['https://images.unsplash.com/photo-1548199973-03cce0bbc87b?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Cat with Wound Near School',
        description: 'Friendly cat with visible neck wound near school gate.',
        animal_type: 'Cat', estimated_count: 1, condition: 'injured', urgency: 'high',
        location_description: 'Near school gate beside sari-sari store',
        address: 'Talamban', city: 'Cebu City', latitude: 10.3568, longitude: 123.9162,
        status: 'new',
        reporter_name: 'Ella Lim', reporter_phone: '09174449999', reporter_email: 'ella.lim@email.com',
        images: ['https://images.unsplash.com/photo-1513360371669-4adf3dd7dff8?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Bird with Broken Wing',
        description: 'Small bird unable to fly after possible wing fracture.',
        animal_type: 'Bird', estimated_count: 1, condition: 'injured', urgency: 'normal',
        location_description: 'Under acacia tree in subdivision park',
        address: 'Banilad Park', city: 'Cebu City', latitude: 10.3380, longitude: 123.9096,
        status: 'new',
        reporter_name: 'Ken Uy', reporter_phone: '09173331111', reporter_email: 'ken.uy@email.com',
        images: ['https://images.unsplash.com/photo-1501706362039-c6e08e08d2e7?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Rabbit Left in Cage',
        description: 'Domestic rabbit abandoned in a small cage by roadside.',
        animal_type: 'Rabbit', estimated_count: 1, condition: 'healthy', urgency: 'normal',
        location_description: 'Near bus stop with abandoned cage',
        address: 'Minglanilla Highway', city: 'Minglanilla', latitude: 10.2573, longitude: 123.7964,
        status: 'new',
        reporter_name: 'Nina Velasco', reporter_phone: '09172224444', reporter_email: 'nina.velasco@email.com',
        images: ['https://images.unsplash.com/photo-1466721591366-2d5fba72006d?auto=format&fit=crop&w=1200&q=80']
      },
      {
        title: 'Senior Dog Wandering at Night',
        description: 'Older dog appears disoriented and weak, roaming busy road.',
        animal_type: 'Dog', estimated_count: 1, condition: 'sick', urgency: 'high',
        location_description: 'Near convenience store crossing at highway',
        address: 'Consolacion Highway', city: 'Consolacion', latitude: 10.3794, longitude: 123.9486,
        status: 'new',
        reporter_name: 'Mark Ramos', reporter_phone: '09179990000', reporter_email: 'mark.ramos@email.com',
        images: ['https://images.unsplash.com/photo-1560807707-8cc77767d783?auto=format&fit=crop&w=1200&q=80']
      }
    ];

    console.log('\nInserting 10 rescue reports with images...');
    for (const report of rescueReports) {
      await db.query(
        `INSERT INTO rescue_reports (
          title, description, animal_type, estimated_count, condition, urgency,
          location_description, address, city, latitude, longitude, status,
          reporter_name, reporter_phone, reporter_email, images, created_at
        ) VALUES (
          $1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,NOW()
        )`,
        [
          report.title, report.description, report.animal_type, report.estimated_count,
          report.condition, report.urgency, report.location_description, report.address,
          report.city, report.latitude, report.longitude, report.status,
          report.reporter_name, report.reporter_phone, report.reporter_email, report.images
        ]
      );
      console.log(`  Added rescue report: ${report.title}`);
    }

    console.log('\nDone: 10 adoptable pets + 10 rescue reports inserted with images.');
    process.exit(0);
  } catch (e) {
    console.error('Error:', e.message);
    process.exit(1);
  }
})();
