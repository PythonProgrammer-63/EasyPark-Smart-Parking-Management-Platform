const path = require('path');
require('dotenv').config({ path: path.join(__dirname, '.env') });
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const { initDb } = require('./database/db');
const { expireAllSlotHolds } = require('./services/parkingSlots');

// Import routes
const authRoutes = require('./routes/auth');
const parkingsRoutes = require('./routes/parkings');
const operatorRoutes = require('./routes/operator');
const favouritesRoutes = require('./routes/favourites');
const historyRoutes = require('./routes/history');
const reviewsRoutes = require('./routes/reviews');
const reportsRoutes = require('./routes/reports');
const paymentsRoutes = require('./routes/payments');
const notificationsRoutes = require('./routes/notifications');

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

// Request logger
app.use((req, res, next) => {
  if (!req.url.startsWith('/assets') && !req.url.startsWith('/vite')) {
    console.log(`${new Date().toISOString().slice(11, 19)} [${req.method}] ${req.url}`);
  }
  next();
});

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    service: 'EasyPark API Server',
    time: new Date().toISOString()
  });
});

// Register API routes
app.use('/api/auth', authRoutes);
app.use('/api/parkings', parkingsRoutes);
app.use('/api/operator', operatorRoutes);
app.use('/api/favourites', favouritesRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/reviews', reviewsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/payments', paymentsRoutes);
app.use('/api/notifications', notificationsRoutes);

app.use('/uploads/profile-photos', express.static(path.join(__dirname, 'uploads/profile-photos'), {
  maxAge: '1d',
  immutable: true
}));
app.use('/uploads/payment-qrs', express.static(path.join(__dirname, 'uploads/payment-qrs'), {
  maxAge: '1d',
  immutable: true
}));

// Serve static client build if present
const clientDistPath = path.join(__dirname, '../client/dist');
if (fs.existsSync(clientDistPath)) {
  app.use(express.static(clientDistPath));
  app.get('*', (req, res, next) => {
    if (req.url.startsWith('/api')) return next();
    res.sendFile(path.join(clientDistPath, 'index.html'));
  });
}

// Global Error Handler
app.use((err, req, res, next) => {
  console.error('Unhandled server error:', err);
  res.status(500).json({ error: 'An unexpected internal server error occurred.' });
});

// Start Server after initializing DB
async function startServer() {
  try {
    await initDb();
    const holdExpiryTimer = setInterval(() => {
      expireAllSlotHolds().catch((err) => console.error('Expire parking slot holds error:', err));
    }, 60_000);
    holdExpiryTimer.unref();
    app.listen(PORT, () => {
      console.log(`=============================================`);
      console.log(`🚗 EasyPark Server running on http://localhost:${PORT}`);
      console.log(`📡 API Endpoints live at http://localhost:${PORT}/api`);
      console.log(`=============================================`);
    });
  } catch (err) {
    console.error('Failed to start server:', err);
    process.exit(1);
  }
}

startServer();