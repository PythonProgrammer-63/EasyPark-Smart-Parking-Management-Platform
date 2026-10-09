const API_BASE = '/api';

function getAuthHeaders() {
  const token = localStorage.getItem('easypark_token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

async function request(endpoint, options = {}) {
  const url = `${API_BASE}${endpoint}`;
  const config = {
    ...options,
    headers: {
      ...getAuthHeaders(),
      ...options.headers
    }
  };

  if (options.body && typeof options.body === 'object' && !(options.body instanceof FormData)) {
    config.body = JSON.stringify(options.body);
  }

  const res = await fetch(url, config);
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    const errorMsg = data.error || data.message || `Request failed with status ${res.status}`;
    const error = new Error(errorMsg);
    error.status = res.status;
    throw error;
  }

  return data;
}

async function getAuthenticatedImage(endpoint) {
  const token = localStorage.getItem('easypark_token');
  const response = await fetch(`${API_BASE}${endpoint}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {}
  });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || `Unable to load image (HTTP ${response.status}).`);
  }
  return response.blob();
}

export const api = {
  // Auth
  login: (credentials) => request('/auth/login', { method: 'POST', body: credentials }),
  register: (userData) => request('/auth/register', { method: 'POST', body: userData }),
  getProfile: () => request('/auth/profile'),
  updateProfile: (profileData) => request('/auth/profile', { method: 'PUT', body: profileData }),
  uploadProfilePhoto: (image) => request('/auth/profile/photo', { method: 'POST', body: { image } }),
  changePassword: (passwords) => request('/auth/change-password', { method: 'POST', body: passwords }),
  forgotPassword: (email) => request('/auth/forgot-password', { method: 'POST', body: { email } }),
  resetPassword: (token, newPassword) => request('/auth/reset-password', { method: 'POST', body: { token, newPassword } }),

  // Parkings (Driver & Public)
  getParkings: (params = {}) => {
    const query = new URLSearchParams();
    Object.entries(params).forEach(([key, val]) => {
      if (val !== undefined && val !== null && val !== '') {
        query.append(key, val);
      }
    });
    const qs = query.toString();
    return request(`/parkings${qs ? `?${qs}` : ''}`);
  },
  getParkingDetails: (id, params = {}) => {
    const query = new URLSearchParams();
    if (params.lat) query.append('lat', params.lat);
    if (params.lng) query.append('lng', params.lng);
    const qs = query.toString();
    return request(`/parkings/${id}${qs ? `?${qs}` : ''}`);
  },

  // Operator Parkings CRUD
  addParking: (parkingData) => request('/parkings', { method: 'POST', body: parkingData }),
  updateParking: (id, parkingData) => request(`/parkings/${id}`, { method: 'PUT', body: parkingData }),
  uploadParkingPaymentQr: (id, image) => request(`/parkings/${id}/payment-qr`, { method: 'POST', body: { image } }),
  removeParkingPaymentQr: (id) => request(`/parkings/${id}/payment-qr`, { method: 'DELETE' }),
  quickUpdateParking: (id, quickData) => request(`/parkings/${id}/quick-update`, { method: 'PATCH', body: quickData }),
  deleteParking: (id) => request(`/parkings/${id}`, { method: 'DELETE' }),

  // Operator Dashboard
  getOperatorStats: () => request('/operator/stats'),
  getOperatorParkings: () => request('/operator/parkings'),
  getOperatorReviews: () => request('/operator/reviews'),
  getOperatorReports: () => request('/operator/reports'),
  updateReportStatus: (reportId, status) => request(`/operator/reports/${reportId}/status`, { method: 'PATCH', body: { status } }),

  // Favourites
  getFavourites: () => request('/favourites'),
  toggleFavourite: (parkingId) => request(`/favourites/${parkingId}`, { method: 'POST' }),
  removeFavourite: (parkingId) => request(`/favourites/${parkingId}`, { method: 'DELETE' }),

  // Parking History
  getHistory: () => request('/history'),
  recordHistory: (data) => request('/history', { method: 'POST', body: data }),
  deleteHistoryItem: (id) => request(`/history/${id}`, { method: 'DELETE' }),
  clearHistory: () => request('/history', { method: 'DELETE' }),

  // Reviews
  getParkingReviews: (parkingId) => request(`/reviews/${parkingId}`),
  submitReview: (parkingId, reviewData) => request(`/reviews/${parkingId}`, { method: 'POST', body: reviewData }),

  // Reports
  submitReport: (parkingId, reportData) => request(`/reports/${parkingId}`, { method: 'POST', body: reportData }),
  getMyReports: () => request('/reports/my-reports'),

  // Payments
  payParkingCharge: (paymentData) => request('/payments/pay', { method: 'POST', body: paymentData }),
  createRazorpayOrder: (paymentData) => request('/payments/razorpay/order', { method: 'POST', body: paymentData }),
  verifyRazorpayPayment: (paymentData) => request('/payments/razorpay/verify', { method: 'POST', body: paymentData }),
  getParkingSlots: (parkingId) => request(`/payments/parkings/${parkingId}/slots`),
  bookFreeParkingSlot: (booking) => request('/payments/free-booking', { method: 'POST', body: booking }),
  renewSlotHold: (slotId, holdToken) => request(`/payments/slots/${slotId}/hold/renew`, { method: 'POST', body: { hold_token: holdToken } }),
  releaseSlotHold: (slotId, holdToken) => request(`/payments/slots/${slotId}/hold/release`, { method: 'POST', body: { hold_token: holdToken } }),
  getOperatorBookings: () => request('/payments/operator/bookings'),
  confirmManualPayment: (paymentId) => request(`/payments/operator/payments/${paymentId}/confirm-manual`, { method: 'POST' }),
  rejectUpiPayment: (paymentId) => request(`/payments/operator/payments/${paymentId}/reject-upi`, { method: 'POST' }),
  getPaymentProofImage: (paymentId) => getAuthenticatedImage(`/payments/operator/payment-proofs/${paymentId}/image`),
  releaseOperatorBooking: (slotId) => request(`/payments/operator/bookings/${slotId}/release`, { method: 'POST' }),
  getPaymentHistory: () => request('/payments/history'),

  // Notifications
  getNotifications: () => request('/notifications'),
  markNotificationRead: (id) => request(`/notifications/${id}/read`, { method: 'PATCH' }),
  markAllNotificationsRead: () => request('/notifications/mark-all-read', { method: 'POST' }),
  deleteNotification: (id) => request(`/notifications/${id}`, { method: 'DELETE' })
};
