const bcrypt = require('bcryptjs');
const { initDb, run, query } = require('./db');

async function seed() {
  console.log('🌱 Seeding MySQL EasyPark database...');
  await initDb();

  const salt = bcrypt.genSaltSync(10);
  const passwordHash = bcrypt.hashSync('password123', salt);
  // Local/demo-only credential; its plaintext is never shipped to the browser.
  const adminDemoPasswordHash = bcrypt.hashSync('Demo123', salt);

  // Clear existing data safely
  await run('SET FOREIGN_KEY_CHECKS = 0');
  await run('TRUNCATE TABLE payments');
  await run('TRUNCATE TABLE notifications');
  await run('TRUNCATE TABLE reports');
  await run('TRUNCATE TABLE reviews');
  await run('TRUNCATE TABLE parking_history');
  await run('TRUNCATE TABLE favourites');
  await run('TRUNCATE TABLE parking_photos');
  await run('TRUNCATE TABLE parkings');
  await run('TRUNCATE TABLE users');
  await run('SET FOREIGN_KEY_CHECKS = 1');

  // 1. Insert Users
  await run(`
    INSERT INTO users (id, name, username, email, password_hash, phone, role, avatar_url) VALUES 
    (1, 'Rahul Sharma', NULL, 'driver@easypark.com', ?, '+91 98765 43210', 'driver', 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'),
    (2, 'EasyPark Administrator', 'demoacc', 'demoacc@easypark.local', ?, '+91 98230 12345', 'admin', 'https://images.unsplash.com/photo-1560250097-0b93528c311a?auto=format&fit=crop&w=200&q=80'),
    (3, 'SmartCity Park Operators', NULL, 'operator2@easypark.com', ?, '+91 98111 22334', 'operator', 'https://images.unsplash.com/photo-1573496359142-b8d87734a5a2?auto=format&fit=crop&w=200&q=80'),
    (4, 'Priya Desai', NULL, 'driver2@easypark.com', ?, '+91 97654 32109', 'driver', 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=80')
  `, [passwordHash, adminDemoPasswordHash, passwordHash, passwordHash]);

  // 2. Insert Parkings
  const parkings = [
    {
      id: 1,
      operator_id: 2,
      name: 'Phoenix Mega Mall Multilevel Parking',
      address: 'Viman Nagar, Nagar Road, Near Symbiosis Campus',
      city: 'Pune',
      area: 'Viman Nagar',
      landmark: 'Opposite Hyatt Regency',
      latitude: 18.5621,
      longitude: 73.9168,
      entrance_location: 'Gate 2, North Wing Ramp',
      parking_type: 'Mall',
      contact_number: '+91 98230 12345',
      opening_time: '09:00 AM',
      closing_time: '11:30 PM',
      total_spaces: 180,
      available_spaces: 48,
      hourly_price: 30,
      two_hour_price: 50,
      five_hour_price: 110,
      daily_price: 250,
      is_free: 0,
      is_covered: 1,
      is_open: 0,
      has_cctv: 1,
      has_security: 1,
      has_ev_charging: 1
    },
    {
      id: 2,
      operator_id: 2,
      name: 'City Center Plaza Underground Parking',
      address: 'FC Road, Deccan Gymkhana, Shivaji Nagar',
      city: 'Pune',
      area: 'FC Road',
      landmark: 'Near Ferguson College Gate',
      latitude: 18.5236,
      longitude: 73.8415,
      entrance_location: 'Basement Entry via Lane 4',
      parking_type: 'Private',
      contact_number: '+91 98230 12346',
      opening_time: '07:00 AM',
      closing_time: '11:00 PM',
      total_spaces: 90,
      available_spaces: 16,
      hourly_price: 25,
      two_hour_price: 45,
      five_hour_price: 90,
      daily_price: 220,
      is_free: 0,
      is_covered: 1,
      is_open: 0,
      has_cctv: 1,
      has_security: 1,
      has_ev_charging: 1
    },
    {
      id: 3,
      operator_id: 2,
      name: 'Apollo Lifeline Hospital Visitor Parking',
      address: 'Off Senapati Bapat Road, Behind Marriott',
      city: 'Pune',
      area: 'SB Road',
      landmark: 'Emergency Care Entrance Area',
      latitude: 18.5362,
      longitude: 73.8298,
      entrance_location: 'Ramp A - Direct Hospital Access',
      parking_type: 'Hospital',
      contact_number: '+91 98230 12347',
      opening_time: '24 Hours',
      closing_time: '24 Hours',
      total_spaces: 60,
      available_spaces: 4,
      hourly_price: 20,
      two_hour_price: 35,
      five_hour_price: 75,
      daily_price: 180,
      is_free: 0,
      is_covered: 1,
      is_open: 0,
      has_cctv: 1,
      has_security: 1,
      has_ev_charging: 0
    },
    {
      id: 4,
      operator_id: 3,
      name: 'Central Railway Station East Gate Parking',
      address: 'Station Road, Agarkar Nagar',
      city: 'Pune',
      area: 'Camp',
      landmark: 'Adjacent to Platform 1 East Overbridge',
      latitude: 18.5289,
      longitude: 73.8744,
      entrance_location: 'Station Porch Road Entry',
      parking_type: 'Railway Station',
      contact_number: '+91 98111 22334',
      opening_time: '24 Hours',
      closing_time: '24 Hours',
      total_spaces: 140,
      available_spaces: 0,
      hourly_price: 15,
      two_hour_price: 25,
      five_hour_price: 60,
      daily_price: 150,
      is_free: 0,
      is_covered: 0,
      is_open: 1,
      has_cctv: 1,
      has_security: 1,
      has_ev_charging: 0
    },
    {
      id: 5,
      operator_id: 3,
      name: 'Cyber Heights Tech Park Smart Parking',
      address: 'Hinjawadi Phase 1, Highmont Road',
      city: 'Pune',
      area: 'Hinjawadi',
      landmark: 'Behind Infosys Circle',
      latitude: 18.5912,
      longitude: 73.7389,
      entrance_location: 'Tower B Ground Gate',
      parking_type: 'Public',
      contact_number: '+91 98111 22335',
      opening_time: '06:00 AM',
      closing_time: '11:00 PM',
      total_spaces: 220,
      available_spaces: 92,
      hourly_price: 20,
      two_hour_price: 35,
      five_hour_price: 70,
      daily_price: 180,
      is_free: 0,
      is_covered: 1,
      is_open: 0,
      has_cctv: 1,
      has_security: 1,
      has_ev_charging: 1
    }
  ];

  for (const p of parkings) {
    await run(`
      INSERT INTO parkings (
        id, operator_id, name, address, city, area, landmark, latitude, longitude, entrance_location,
        parking_type, contact_number, opening_time, closing_time, total_spaces, available_spaces,
        hourly_price, two_hour_price, five_hour_price, daily_price, is_free, is_covered, is_open,
        has_cctv, has_security, has_ev_charging
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `, [
      p.id, p.operator_id, p.name, p.address, p.city, p.area, p.landmark, p.latitude, p.longitude, p.entrance_location,
      p.parking_type, p.contact_number, p.opening_time, p.closing_time, p.total_spaces, p.available_spaces,
      p.hourly_price, p.two_hour_price, p.five_hour_price, p.daily_price, p.is_free, p.is_covered, p.is_open,
      p.has_cctv, p.has_security, p.has_ev_charging
    ]);
  }

  // 3. Insert Photos
  const photos = [
    { parking_id: 1, photo_url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80', photo_type: 'entrance', caption: 'Main North Gate Ramp Entry' },
    { parking_id: 1, photo_url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80', photo_type: 'area', caption: 'Level 2 Covered Parking Bay' },
    { parking_id: 1, photo_url: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=1200&q=80', photo_type: 'space', caption: 'Dedicated EV Charging Station' },
    { parking_id: 2, photo_url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80', photo_type: 'entrance', caption: 'FC Road Basement Access' },
    { parking_id: 2, photo_url: 'https://images.unsplash.com/photo-1621929747188-0b4dc28498d2?auto=format&fit=crop&w=1200&q=80', photo_type: 'area', caption: 'Underground Well-lit Parking Grid' },
    { parking_id: 3, photo_url: 'https://images.unsplash.com/photo-1545179605-1296651e9d43?auto=format&fit=crop&w=1200&q=80', photo_type: 'entrance', caption: 'Emergency & Visitor Ingress Ramp' },
    { parking_id: 4, photo_url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80', photo_type: 'entrance', caption: 'East Gate Main Entrance' },
    { parking_id: 5, photo_url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80', photo_type: 'entrance', caption: 'Corporate Campus Security Gate' }
  ];

  for (const ph of photos) {
    await run(`
      INSERT INTO parking_photos (parking_id, photo_url, photo_type, caption)
      VALUES (?, ?, ?, ?)
    `, [ph.parking_id, ph.photo_url, ph.photo_type, ph.caption]);
  }

  // 4. Insert Favourites
  await run(`INSERT INTO favourites (user_id, parking_id) VALUES (1, 1), (1, 2);`);

  // 5. Insert History
  await run(`
    INSERT INTO parking_history (user_id, parking_id, action_type, price_paid) VALUES 
    (1, 1, 'visited', 50.00),
    (1, 2, 'viewed', 0.00),
    (1, 5, 'visited', 35.00)
  `);

  // 6. Insert Reviews
  await run(`
    INSERT INTO reviews (parking_id, user_id, rating, comment) VALUES 
    (1, 1, 5, 'Super spacious multilevel parking with crystal clear signboards and working EV chargers!'),
    (1, 4, 5, 'Clean, secure, and very easy to navigate with the app directions.'),
    (2, 4, 4, 'Great location on FC road. A bit busy on weekends, but safe and guarded.'),
    (3, 1, 4, 'Very close to hospital entrance. Good security staff helped guide.'),
    (5, 1, 5, 'Fast EV charger worked flawlessly. Highly recommended for EV owners.')
  `);

  // 7. Insert Reports
  await run(`
    INSERT INTO reports (parking_id, user_id, reason, description, status) VALUES 
    (4, 4, 'Incorrect Availability', 'East Gate was temporarily undergoing maintenance today.', 'pending'),
    (2, 1, 'Wrong Price', 'Night parking charges had a small 5 rupee variation after 11 PM.', 'reviewed')
  `);

  // 8. Insert Notifications
  await run(`
    INSERT INTO notifications (user_id, title, message, type, is_read) VALUES 
    (1, 'Welcome to EasyPark! 🚗', 'Discover parking spaces nearby with real-time availability and smart navigation.', 'welcome', 1),
    (1, 'Price Drop Alert', 'Phoenix Mega Mall updated 2-hour parking rate to ₹50.', 'price', 0),
    (2, 'New Review Received ⭐', 'Rahul Sharma left a 5-star review for Phoenix Mega Mall Parking.', 'review', 0)
  `);

  // 9. Insert Payments
  await run(`
    INSERT INTO payments (user_id, parking_id, amount, payment_method, transaction_id, status, duration_hours) VALUES
    (1, 1, 50.00, 'UPI', 'EP-UPI-894218', 'Success', 2.00),
    (1, 5, 35.00, 'Card', 'EP-CARD-331092', 'Success', 2.00)
  `);

  console.log('🎉 MySQL database seeded successfully with test records!');
  process.exit(0);
}

seed().catch(err => {
  console.error('❌ Seeding error:', err);
  process.exit(1);
});
