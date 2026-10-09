CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    username VARCHAR(50) UNIQUE,
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    phone VARCHAR(50),
    phone_normalized VARCHAR(50) GENERATED ALWAYS AS (NULLIF(REGEXP_REPLACE(phone, '[^0-9]', ''), '')) STORED,
    role ENUM('driver', 'operator', 'admin') NOT NULL,
    avatar_url TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY uq_users_phone_normalized (phone_normalized)
);

CREATE TABLE IF NOT EXISTS password_reset_tokens (
    token_hash CHAR(64) PRIMARY KEY,
    user_id INT NOT NULL,
    expires_at DATETIME NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_password_reset_tokens_user_id (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parkings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    operator_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    address TEXT NOT NULL,
    city VARCHAR(100) NOT NULL,
    area VARCHAR(100) NOT NULL,
    landmark VARCHAR(255),
    latitude DOUBLE NOT NULL,
    longitude DOUBLE NOT NULL,
    google_maps_url TEXT NULL,
    entrance_location VARCHAR(255),
    parking_type ENUM('Public', 'Private', 'Mall', 'Hospital', 'Railway Station', 'Street Parking') NOT NULL,
    contact_number VARCHAR(50) NOT NULL,
    opening_time VARCHAR(50) DEFAULT '07:00',
    closing_time VARCHAR(50) DEFAULT '23:00',
    total_spaces INT NOT NULL,
    available_spaces INT NOT NULL,
    hourly_price DECIMAL(10,2) DEFAULT 20.00,
    two_hour_price DECIMAL(10,2) DEFAULT 35.00,
    five_hour_price DECIMAL(10,2) DEFAULT 70.00,
    daily_price DECIMAL(10,2) DEFAULT 200.00,
    payment_qr_url TEXT,
    is_free TINYINT(1) DEFAULT 0,
    is_covered TINYINT(1) DEFAULT 1,
    is_open TINYINT(1) DEFAULT 0,
    has_cctv TINYINT(1) DEFAULT 1,
    has_security TINYINT(1) DEFAULT 1,
    has_ev_charging TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (operator_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parking_photos (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parking_id INT NOT NULL,
    photo_url TEXT NOT NULL,
    photo_type ENUM('entrance', 'area', 'space', 'exit', 'signboard', 'general') DEFAULT 'general',
    caption VARCHAR(255),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS favourites (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    parking_id INT NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_fav (user_id, parking_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parking_history (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    parking_id INT NOT NULL,
    action_type VARCHAR(50) DEFAULT 'viewed',
    price_paid DECIMAL(10,2) DEFAULT 0.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reviews (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parking_id INT NOT NULL,
    user_id INT NOT NULL,
    rating INT NOT NULL CHECK (rating BETWEEN 1 AND 5),
    comment TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS reports (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parking_id INT NOT NULL,
    user_id INT NOT NULL,
    reason ENUM('Wrong Location', 'Wrong Price', 'Parking Closed', 'Wrong Contact Number', 'Incorrect Photos', 'Incorrect Availability', 'Other') NOT NULL,
    description TEXT,
    status ENUM('pending', 'reviewed', 'resolved') DEFAULT 'pending',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR(50) DEFAULT 'info',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

CREATE TABLE IF NOT EXISTS parking_slots (
    id INT AUTO_INCREMENT PRIMARY KEY,
    parking_id INT NOT NULL,
    slot_code VARCHAR(32) NOT NULL,
    status ENUM('available', 'unavailable', 'held', 'booked') NOT NULL DEFAULT 'unavailable',
    held_by_user_id INT,
    hold_token CHAR(36),
    hold_order_id VARCHAR(64),
    hold_expires_at DATETIME,
    booked_by_user_id INT,
    vehicle_number VARCHAR(50),
    duration_hours DECIMAL(5,2),
    booked_at DATETIME,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY unique_parking_slot_code (parking_id, slot_code),
    INDEX idx_parking_slots_available (parking_id, status),
    INDEX idx_parking_slots_expiry (status, hold_expires_at),
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE,
    FOREIGN KEY (held_by_user_id) REFERENCES users(id) ON DELETE SET NULL,
    FOREIGN KEY (booked_by_user_id) REFERENCES users(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    parking_id INT NOT NULL,
    amount DECIMAL(10,2) NOT NULL,
    payment_method ENUM('UPI', 'Card', 'Cash', 'Paytm Wallet') NOT NULL,
    transaction_id VARCHAR(100) NOT NULL,
    parking_slot_id INT,
    status ENUM('Success', 'Pending', 'Failed') DEFAULT 'Success',
    duration_hours DECIMAL(5,2) DEFAULT 1.00,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parking_id) REFERENCES parkings(id) ON DELETE CASCADE,
    FOREIGN KEY (parking_slot_id) REFERENCES parking_slots(id) ON DELETE SET NULL
);

CREATE TABLE IF NOT EXISTS payment_proofs (
    id INT AUTO_INCREMENT PRIMARY KEY,
    payment_id INT NOT NULL UNIQUE,
    payer_name VARCHAR(120) NOT NULL,
    screenshot_filename VARCHAR(255) NOT NULL,
    verification_status ENUM('Pending', 'Verified', 'Rejected') NOT NULL DEFAULT 'Pending',
    reviewed_by INT NULL,
    reviewed_at DATETIME NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (payment_id) REFERENCES payments(id) ON DELETE CASCADE,
    FOREIGN KEY (reviewed_by) REFERENCES users(id) ON DELETE SET NULL
);
