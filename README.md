# 🚗 EasyPark — Smart Parking Information & Management Platform

**EasyPark** is a complete, modern, responsive smart parking web application designed to help drivers discover parking availability in real-time and provide parking operators with tools to directly manage their parking facilities with zero admin approval roadblocks.

---

## 🌟 Key Features

### 👤 Driver / User Experience
- **Smart Search & Suggestions:** Instant search across Parking Name, Area, City, Address, and Landmarks.
- **Near Me (Haversine Distance):** Real-time GPS distance calculation (`0.5 km away`, `1.2 km away`) with automatic sorting.
- **Interactive OpenStreetMap (Leaflet):** Color-coded live availability pins (🟢 Available, 🟠 Limited, 🔴 Full) with rich popup previews and navigation triggers.
- **Multi-Criteria Filter Engine:**
  - **Price:** Free, Paid, Low to High, High to Low
  - **Distance:** Within 500m, 1km, 2km, 5km
  - **Parking Type:** Public, Private, Mall, Hospital, Railway Station, Street Parking
  - **Facilities:** Covered Roof, Open Lot, 24/7 CCTV, Security Guard, EV Fast Charging
- **Parking Details Page:**
  - Categorized Photo Gallery (Entrance, Parking Area, Space/EV, Exit, Signboard) with lightbox fullscreen preview
  - Exact Entrance Location Guide & GPS navigation
  - Tiered Tariff Table (1 hr, 2 hrs, 5 hrs, Daily)
  - Direct Phone Call button (`tel:` link)
  - Ratings & Reviews breakdown
- **Payments:** Operators upload a business QR for direct UPI payments; card payments use Razorpay Checkout; cash-at-booth is also supported. UPI submissions require the payer name and a screenshot of the completed payment. QR/UPI and cash payments remain processing until an operator confirms receipt.
- **Slot Booking:** Choose an individually identified slot, hold it during checkout, and confirm the booking after successful payment. Cash bookings remain in processing until the operator confirms receipt; operators can review payment status and release confirmed slots. Unpaid online holds expire after 10 minutes.
- **Parking Hours:** Operators can set opening and closing hours per facility. Availability and booking cutoffs follow those hours in India Standard Time; set both times equal for 24-hour access. Closed facilities display a red status dot.
- **Google Maps Directions:** Operators can optionally add a Google Maps share link for the exact parking pin. Drivers use it from the parking card, details, or map; saved coordinates remain the fallback.
- **Payment Receipts:** Only successful payments can be printed, and each print action produces a receipt for that one selected transaction.
- **Profile Photos:** Upload a JPEG, PNG, or WebP photo from a computer or mobile device (up to 10 MB); the server stores uploaded photos.
- **Favourites & History:** Save favourite spots and review timestamped parking view/paid logs with clear-all capability.
- **Community Reviews & Inaccuracy Reporting:** Submit 1-5 star reviews or report wrong info to operators.
- **Notifications Hub:** Price drop alerts, facility additions, and report notifications.

---

### 🏢 Parking Operator Experience
- **Instant Direct Publishing:** Operator additions become **immediately available** to drivers (NO admin verification or approval gate).
- **Live Availability Controller:** Rapid inline stepper (`+` / `-`) to adjust live available spaces and hourly tariffs in real-time.
- **Full Facility Management:** Create, edit, and delete parking locations with photo galleries.
- **Issue Reports Center:** Inspect driver-reported inaccuracies and mark them as reviewed/resolved.
- **Customer Feedback Stream:** View all received ratings and user reviews.

---

## 🔒 Features Explicitly Excluded
- ❌ No Admin Verification or Approval Gate
- ❌ No IoT Hardware Sensors / Bloatware

---

## 📂 Project Architecture

```text
easypark/
├── client/                      # React 18 + Vite Frontend
│   ├── src/
│   │   ├── components/          # AvailabilityBadge, Navbar, ParkingCard, ParkingMap,
│   │   │                        # FilterModal, PhotoGallery, PaymentModal, ReviewModal,
│   │   │                        # ReportModal, NotificationDropdown
│   │   ├── context/             # AuthContext, LocationContext
│   │   ├── pages/               # Login, Register, DriverDashboard, MapViewPage,
│   │   │                        # ParkingDetails, FavouritesPage, HistoryPage,
│   │   │                        # PaymentsHistoryPage, OperatorDashboard,
│   │   │                        # OperatorAddParking, OperatorEditParking,
│   │   │                        # OperatorReports, OperatorReviews, ProfilePage
│   │   ├── services/            # Centralized API service layer
│   │   ├── App.jsx              # Main App router and state hub
│   │   ├── main.jsx             # React DOM entrypoint
│   │   └── index.css            # Tailwind CSS and Leaflet styles
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
│
├── server/                      # Node.js + Express Backend
│   ├── database/
│   │   ├── db.js                # SQLite (sql.js) connection & auto-save engine
│   │   ├── schema.sql           # Complete relational database schema
│   │   ├── seed.js              # Realistic seed data generator
│   │   └── easypark.sqlite      # SQLite database file
│   ├── middleware/
│   │   └── auth.js              # JWT authentication & role-based guards
│   ├── routes/
│   │   ├── auth.js              # Registration, Login, Profile, Password
│   │   ├── parkings.js          # Search, Near Me, Details, Operator CRUD
│   │   ├── operator.js          # Operator statistics & management endpoints
│   │   ├── favourites.js        # Add / Remove / List favourites
│   │   ├── history.js           # Activity & visit logs
│   │   ├── reviews.js           # Ratings & reviews
│   │   ├── reports.js           # Issue reporting
│   │   ├── payments.js          # Mock payments & receipts
│   │   └── notifications.js     # User alerts & notifications
│   ├── server.js                # Server entrypoint with static client serving
│   ├── .env.example
│   └── package.json
│
├── package.json                 # Root script runner
└── README.md
```

---

## 🚀 Quick Start & Installation

### Prerequisites
- **Node.js**: v18 or higher (tested with Node v24)
- **npm**

### Step 1: Install Server & Client Dependencies

```bash
# In the root easypark directory:
cd server
npm install

cd ../client
npm install
```

### Step 2: Seed the Database (Optional - Preseeded)

```bash
cd server
npm run seed
```

### Configure Razorpay (test mode)

Add the test keys from your Razorpay Dashboard to `server/.env`. Keep the secret key on the server and never add it to client-side code.

```env
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_test_key_secret
```

The authenticated `POST /api/payments/razorpay/order` endpoint creates an order from the selected parking tariff (minimum ₹1) and holds the selected slot for 10 minutes. The client opens Razorpay Standard Checkout; `POST /api/payments/razorpay/verify` validates the HMAC signature before confirming the booking. Cancelled/failed/expired holds release the slot; the checkout renews the hold while it remains open. Free locations confirm a selected slot without payment. Operators can release confirmed slots from their dashboard. The key ID is returned for Checkout, but the key secret stays on the server. Use Razorpay test keys and test payment methods until your account is approved for live payments.

To accept direct UPI payments, an operator opens **Your Managed Parking Facilities** and uploads the facility's business QR. Drivers choose **UPI / QR**, scan and pay the displayed business QR outside EasyPark, then submit the payer name and a screenshot of the completed transfer. The booking is reserved with payment status **Processing** until the operator reviews the screenshot and chooses **Confirm UPI Received**. If the proof is rejected, the booking is cancelled and the slot becomes available again. Screenshot files are stored privately and can only be viewed by the associated parking operator or an admin. Cash bookings use **Cash at Booth** and stay processing until the operator chooses **Mark Cash Received**. Card payments continue through Razorpay Checkout.

UPI screenshot metadata is recorded in the `payment_proofs` table, linked one-to-one with its payment record.

Razorpay is used only for card checkout. Direct QR/UPI payments are transferred to the business QR and are manually verified by the operator; EasyPark does not receive payment confirmation automatically.

If order creation reports `RAZORPAY_AUTH_FAILED`, generate an active Key ID/Key Secret pair from the same Test or Live mode in the Razorpay Dashboard, update `server/.env`, and restart the backend. Never use a Live key ID with a Test secret (or vice versa).

### Configure password reset email

Password reset links are sent to the registered email address using SMTP. Set these values in `server/.env` using credentials from your email provider:

```env
APP_BASE_URL=http://localhost:5000
SMTP_HOST=smtp.your-provider.com
SMTP_PORT=587
SMTP_SECURE=false
SMTP_USER=your_smtp_username
SMTP_PASS=your_smtp_password
SMTP_FROM=EasyPark <no-reply@your-domain.com>
```

Use the HTTPS URL of your deployed app for `APP_BASE_URL` in production. Keep SMTP credentials server-side; do not add them to client configuration. Reset links expire after one hour and can only be used once.

### Step 3: Run the Application

#### Option A: Unified Full-Stack Mode (Single Port 5000)
```bash
# Build the client:
cd client
npm run build

# Start the server:
cd ../server
npm start
```
Open **[http://localhost:5000](http://localhost:5000)** in your web browser.

#### Option B: Development Mode with Vite HMR
- Terminal 1 (Backend Server):
  ```bash
  cd server
  npm run dev
  ```
  *(Server runs at http://localhost:5000)*

- Terminal 2 (Vite Frontend):
  ```bash
  cd client
  npm run dev
  ```
  *(Frontend runs at http://localhost:5173)*

---

## 🧪 Demo Test Accounts

| Role | Email | Password | Access / Features |
| :--- | :--- | :--- | :--- |
| **Driver** | `driver@easypark.com` | `password123` | Search, Near Me, Map View, Details, Favourites, History, Payments, Reviews, Reports |
| **Operator** | `operator@easypark.com` | `password123` | Dashboard, Instant Add Parking, Live Space Stepper, Edit, Pricing, Reviews, Reports |
| **Admin demo** | `demoacc` | `Demo123` | Admin access for local/demo use; not exposed through one-click login |

*(You can also use the **1-Click Instant Demo Login** buttons on the login screen or register a new Driver or Operator account anytime).*
