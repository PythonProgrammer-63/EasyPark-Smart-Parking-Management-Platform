import React, { useState, useEffect } from 'react';
import {
  Building2,
  Car,
  PlusCircle,
  TrendingUp,
  Star,
  AlertTriangle,
  CreditCard,
  Edit,
  Trash2,
  Plus,
  Minus,
  Save,
  CheckCircle2,
  ExternalLink,
  ChevronRight,
  QrCode,
  Upload
} from 'lucide-react';
import { api } from '../services/api';
import AvailabilityBadge from '../components/AvailabilityBadge';

function PaymentProofPreview({ paymentId, payerName }) {
  const [imageUrl, setImageUrl] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    let active = true;
    let objectUrl;
    api.getPaymentProofImage(paymentId)
      .then((image) => {
        objectUrl = URL.createObjectURL(image);
        if (active) setImageUrl(objectUrl);
        else URL.revokeObjectURL(objectUrl);
      })
      .catch((err) => {
        if (active) setError(err.message || 'Unable to load payment proof.');
      });
    return () => {
      active = false;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [paymentId]);

  return (
    <div className="mt-3 rounded-xl border border-slate-200 bg-white p-3">
      <p className="text-xs font-semibold text-slate-700">Payer name: {payerName}</p>
      {imageUrl ? (
        <a href={imageUrl} target="_blank" rel="noreferrer" className="mt-2 inline-block">
          <img
            src={imageUrl}
            alt={`UPI payment screenshot submitted by ${payerName}`}
            className="max-h-56 max-w-full rounded-lg border border-slate-200 object-contain"
          />
          <span className="mt-1 block text-[11px] font-semibold text-brand-700">Open full-size screenshot</span>
        </a>
      ) : (
        <p className={`mt-2 text-[11px] ${error ? 'text-red-600' : 'text-slate-500'}`}>
          {error || 'Loading payment screenshot...'}
        </p>
      )}
    </div>
  );
}

export default function OperatorDashboard({ onNavigateTab, onEditParking, onSelectParking }) {
  const [stats, setStats] = useState(null);
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [recentReports, setRecentReports] = useState([]);
  const [recentReviews, setRecentReviews] = useState([]);
  const [quickEdits, setQuickEdits] = useState({});
  const [saveSuccessId, setSaveSuccessId] = useState(null);
  const [bookings, setBookings] = useState([]);
  const [confirmingPaymentId, setConfirmingPaymentId] = useState(null);
  const [savingQrId, setSavingQrId] = useState(null);
  const [qrError, setQrError] = useState(null);

  const fetchDashboardData = async () => {
    try {
      setLoading(true);
      const [statsRes, parkingsRes, bookingsRes] = await Promise.all([
        api.getOperatorStats(),
        api.getOperatorParkings(),
        api.getOperatorBookings()
      ]);

      setStats(statsRes.stats);
      setRecentReports(statsRes.recentReports || []);
      setRecentReviews(statsRes.recentReviews || []);
      setParkings(parkingsRes.parkings || []);
      setBookings(bookingsRes.bookings || []);

      // Initialize quick edit state
      const initialQuick = {};
      (parkingsRes.parkings || []).forEach(p => {
        initialQuick[p.id] = {
          available_spaces: p.available_spaces,
          total_spaces: p.total_spaces,
          hourly_price: p.hourly_price,
          daily_price: p.daily_price
        };
      });
      setQuickEdits(initialQuick);
    } catch (err) {
      console.error('Operator dashboard error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchDashboardData();
  }, []);

  useEffect(() => {
    const refreshBookings = async () => {
      try {
        const response = await api.getOperatorBookings();
        setBookings(response.bookings || []);
      } catch (err) {
        console.error('Refresh operator booking statuses error:', err);
      }
    };
    const interval = window.setInterval(refreshBookings, 30_000);
    return () => window.clearInterval(interval);
  }, []);

  const handleConfirmManualPayment = async (booking) => {
    setConfirmingPaymentId(booking.payment_id);
    try {
      await api.confirmManualPayment(booking.payment_id);
      const response = await api.getOperatorBookings();
      setBookings(response.bookings || []);
    } catch (err) {
      window.alert(err.message || 'Unable to confirm this payment.');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handleRejectUpiPayment = async (booking) => {
    if (!window.confirm(`Reject the UPI proof for ${booking.slot_code}? This will cancel the slot booking and make the slot available again.`)) return;
    setConfirmingPaymentId(booking.payment_id);
    try {
      await api.rejectUpiPayment(booking.payment_id);
      const response = await api.getOperatorBookings();
      setBookings(response.bookings || []);
    } catch (err) {
      window.alert(err.message || 'Unable to reject this UPI payment proof.');
    } finally {
      setConfirmingPaymentId(null);
    }
  };

  const handlePaymentQrUpload = async (parkingId, event) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      setQrError('Choose a JPEG, PNG, or WebP QR image.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setQrError('Payment QR images must be 5 MB or smaller.');
      return;
    }
    setSavingQrId(parkingId);
    setQrError(null);
    try {
      const image = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error('Unable to read the selected QR image.'));
        reader.readAsDataURL(file);
      });
      const result = await api.uploadParkingPaymentQr(parkingId, image);
      setParkings((items) => items.map((parking) => (
        parking.id === parkingId ? { ...parking, payment_qr_url: result.payment_qr_url } : parking
      )));
    } catch (err) {
      setQrError(err.message || 'Unable to save this payment QR.');
    } finally {
      setSavingQrId(null);
    }
  };

  const handleRemovePaymentQr = async (parkingId) => {
    setSavingQrId(parkingId);
    setQrError(null);
    try {
      await api.removeParkingPaymentQr(parkingId);
      setParkings((items) => items.map((parking) => (
        parking.id === parkingId ? { ...parking, payment_qr_url: null } : parking
      )));
    } catch (err) {
      setQrError(err.message || 'Unable to remove this payment QR.');
    } finally {
      setSavingQrId(null);
    }
  };

  const handleQuickSave = async (parkingId) => {
    try {
      const editData = quickEdits[parkingId];
      if (!editData) return;

      await api.quickUpdateParking(parkingId, editData);
      setSaveSuccessId(parkingId);
      setTimeout(() => setSaveSuccessId(null), 2500);
      
      // Update local parkings list
      setParkings(prev => prev.map(p => {
        if (p.id === parkingId) {
          return {
            ...p,
            available_spaces: editData.available_spaces,
            total_spaces: editData.total_spaces,
            hourly_price: editData.hourly_price,
            daily_price: editData.daily_price
          };
        }
        return p;
      }));
    } catch (err) {
      console.error('Quick save error:', err);
      alert('Failed to save quick updates.');
    }
  };

  const handleDelete = async (parkingId, parkingName) => {
    if (!window.confirm(`Are you sure you want to permanently delete "${parkingName}"?`)) return;
    try {
      await api.deleteParking(parkingId);
      setParkings(prev => prev.filter(p => p.id !== parkingId));
      fetchDashboardData();
    } catch (err) {
      console.error('Delete error:', err);
      alert('Failed to delete parking.');
    }
  };

  const handleReleaseBooking = async (booking) => {
    if (!window.confirm(`Release slot ${booking.slot_code} at ${booking.parking_name}?`)) return;
    try {
      await api.releaseOperatorBooking(booking.slot_id);
      setBookings((current) => current.filter((item) => item.slot_id !== booking.slot_id));
      await fetchDashboardData();
    } catch (err) {
      console.error('Release slot booking error:', err);
      alert(err.message || 'Unable to release this booked slot.');
    }
  };

  const handleSpaceChange = (parkingId, delta) => {
    setQuickEdits(prev => {
      const current = prev[parkingId] || {};
      const currentVal = parseInt(current.available_spaces || 0, 10);
      const totalVal = parseInt(current.total_spaces || 100, 10);
      const newVal = Math.max(0, Math.min(totalVal, currentVal + delta));
      return {
        ...prev,
        [parkingId]: {
          ...current,
          available_spaces: newVal
        }
      };
    });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-20 text-center text-xs text-slate-400">
        <div className="w-12 h-12 border-4 border-amber-200 border-t-amber-600 rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-bold text-slate-800">Loading Operator Management Center...</h3>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
      {/* Top Banner & Quick Add */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-brand-950 rounded-3xl p-6 sm:p-8 text-white shadow-xl flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
        <div>
          <span className="text-xs uppercase font-bold tracking-wider text-amber-400 block mb-1">
            Operator Command Center
          </span>
          <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
            Manage Parking & Live Availability
          </h1>
          <p className="text-xs text-slate-300 mt-1 max-w-xl">
            Directly update open spots, adjust rates in real-time, inspect customer reviews, and resolve driver reports.
          </p>
        </div>

        <button
          onClick={() => onNavigateTab('operator-add')}
          className="px-6 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-brand-500/30 transition flex items-center gap-2 shrink-0 transform active:scale-95"
        >
          <PlusCircle className="w-5 h-5" />
          <span>+ Add New Parking</span>
        </button>
      </div>

      {/* KPI Metric Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Total Locations */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Locations</span>
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <Building2 className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-slate-900">{stats?.totalParkings || 0}</span>
          <p className="text-[11px] text-slate-500 mt-1">Active parking properties</p>
        </div>

        {/* Card 2: Spaces & Live Occupancy */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Live Slots</span>
            <div className="p-2 bg-emerald-50 text-emerald-600 rounded-xl">
              <Car className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-emerald-600">{stats?.totalAvailable || 0}</span>
            <span className="text-xs text-slate-400">/ {stats?.totalSpaces || 0} Open</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">
            {stats?.occupancyRate || 0}% Occupancy Rate
          </p>
        </div>

        {/* Card 3: Avg Rating */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Avg Rating</span>
            <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
              <Star className="w-4 h-4" />
            </div>
          </div>
          <div className="flex items-baseline gap-1.5">
            <span className="text-2xl font-extrabold text-amber-500">⭐ {stats?.avgRating || '4.5'}</span>
            <span className="text-xs text-slate-400">({stats?.totalReviews || 0} reviews)</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">Community satisfaction</p>
        </div>

        {/* Card 4: Open Reports */}
        <div className="bg-white p-5 rounded-3xl border border-slate-200/90 shadow-xs">
          <div className="flex items-center justify-between mb-3">
            <span className="text-xs font-bold text-slate-400 uppercase tracking-wider">Issue Reports</span>
            <div className={`p-2 rounded-xl ${
              (stats?.pendingReportsCount || 0) > 0 ? 'bg-red-50 text-red-600 animate-pulse' : 'bg-slate-100 text-slate-600'
            }`}>
              <AlertTriangle className="w-4 h-4" />
            </div>
          </div>
          <span className="text-2xl font-extrabold text-slate-900">{stats?.pendingReportsCount || 0}</span>
          <p className="text-[11px] text-slate-500 mt-1">
            {(stats?.pendingReportsCount || 0) > 0 ? 'Requires your attention' : 'All clear!'}
          </p>
        </div>
      </div>

      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
        <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Confirmed Slot Bookings</h2>
            <p className="text-xs text-slate-500">Review UPI payer names and screenshots, confirm payments, or release a slot.</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              try {
                const response = await api.getOperatorBookings();
                setBookings(response.bookings || []);
              } catch (err) {
                window.alert(err.message || 'Unable to refresh booking statuses.');
              }
            }}
            className="shrink-0 px-3 py-2 rounded-xl border border-slate-200 text-xs font-bold text-slate-700 hover:bg-slate-50"
          >
            Refresh
          </button>
        </div>
        {bookings.length === 0 ? (
          <p className="py-6 text-xs text-slate-500">There are no confirmed slot bookings.</p>
        ) : (
          <div className="divide-y divide-slate-100">
            {bookings.map((booking) => (
              <div key={booking.slot_id} className="py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                <div>
                  <p className="text-sm font-bold text-slate-900">
                    {booking.slot_code} · {booking.parking_name}
                  </p>
                  <p className="text-xs text-slate-600 mt-1">
                    {booking.customer_name} · {booking.vehicle_number} · {booking.duration_hours} hour(s)
                  </p>
                  <p className="text-[11px] text-slate-400">{booking.customer_email}</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-semibold text-slate-700">
                      {booking.payment_method || 'Free booking'}{booking.payment_amount != null ? ` · ₹${booking.payment_amount}` : ''}
                    </span>
                    <span className={`rounded-md border px-2 py-0.5 font-bold ${
                      booking.payment_status === 'Pending'
                        ? 'border-amber-200 bg-amber-50 text-amber-800'
                        : booking.payment_status === 'Failed'
                          ? 'border-red-200 bg-red-50 text-red-700'
                          : 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    }`}>
                      {booking.payment_status === 'Pending'
                        ? 'Processing'
                        : booking.payment_status === 'Failed'
                          ? 'Failed'
                          : booking.payment_status === 'Success'
                            ? 'Paid'
                            : 'No payment due'}
                    </span>
                  </div>
                  {booking.payment_method === 'UPI' && booking.payment_id && (
                    booking.payer_name
                      ? <PaymentProofPreview paymentId={booking.payment_id} payerName={booking.payer_name} />
                      : <p className="mt-2 text-xs font-semibold text-amber-700">Payment screenshot is missing for this UPI record.</p>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {booking.payment_method === 'Cash' && booking.payment_status === 'Pending' && (
                    <button
                      type="button"
                      disabled={confirmingPaymentId === booking.payment_id}
                      onClick={() => handleConfirmManualPayment(booking)}
                      className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold disabled:opacity-50"
                    >
                      {confirmingPaymentId === booking.payment_id ? 'Updating...' : 'Mark Cash Received'}
                    </button>
                  )}
                  {booking.payment_method === 'UPI' && booking.payment_status === 'Pending' && booking.proof_status === 'Pending' && (
                    <button
                      type="button"
                      disabled={confirmingPaymentId === booking.payment_id}
                      onClick={() => handleConfirmManualPayment(booking)}
                      className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-200 text-xs font-bold disabled:opacity-50"
                    >
                      {confirmingPaymentId === booking.payment_id ? 'Verifying...' : 'Verify & Mark Paid'}
                    </button>
                  )}
                  {booking.payment_method === 'UPI' && booking.payment_status === 'Pending' && booking.proof_status === 'Pending' && (
                    <>
                    <button
                      type="button"
                      disabled={confirmingPaymentId === booking.payment_id}
                      onClick={() => handleRejectUpiPayment(booking)}
                      className="px-4 py-2 rounded-xl border border-red-200 bg-red-50 text-xs font-bold text-red-700 hover:bg-red-100 disabled:opacity-50"
                    >
                      Reject Proof & Release Slot
                    </button>
                    </>
                  )}
                  <button
                    type="button"
                    onClick={() => handleReleaseBooking(booking)}
                    className="px-4 py-2 rounded-xl bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-bold"
                  >
                    Release Slot
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Main Managed Parkings with Real-Time Quick Controls */}
      <section className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 pb-4 border-b border-slate-100">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Your Managed Parking Facilities</h2>
            <p className="text-xs text-slate-500">
              Quickly adjust live availability spaces & hourly pricing without navigating away
            </p>
          </div>

          <button
            onClick={() => onNavigateTab('operator-add')}
            className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 hover:bg-brand-100 px-3.5 py-2 rounded-xl transition"
          >
            + Add Another Facility
          </button>
        </div>

        {parkings.length === 0 ? (
          <div className="py-12 text-center">
            <p className="text-xs text-slate-500 mb-4">You haven't listed any parking locations yet.</p>
            <button
              onClick={() => onNavigateTab('operator-add')}
              className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold"
            >
              Add Your First Parking
            </button>
          </div>
        ) : (
          <div className="space-y-4">
            {qrError && (
              <p role="alert" className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-700">
                {qrError}
              </p>
            )}
            {parkings.map((p) => {
              const edit = quickEdits[p.id] || {
                available_spaces: p.available_spaces,
                total_spaces: p.total_spaces,
                hourly_price: p.hourly_price,
                daily_price: p.daily_price
              };
              const isSaved = saveSuccessId === p.id;

              return (
                <div
                  key={p.id}
                  className="p-5 rounded-3xl border border-slate-200 hover:border-slate-300 transition bg-slate-50/50 flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6"
                >
                  {/* Left: Thumbnail & Info */}
                  <div className="flex items-start gap-4 flex-1">
                    <img
                      src={p.primary_photo || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=300&q=80'}
                      alt={p.name}
                      className="w-24 h-24 rounded-2xl object-cover shrink-0 border border-slate-200"
                    />
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-md bg-white border border-slate-200 text-slate-700">
                          {p.parking_type}
                        </span>
                        <AvailabilityBadge
                          availableSpaces={edit.available_spaces}
                          openingTime={p.opening_time}
                          closingTime={p.closing_time}
                          size="small"
                        />
                        {p.pending_reports > 0 && (
                          <span className="text-[10px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded-md">
                            ⚠️ {p.pending_reports} Report(s)
                          </span>
                        )}
                      </div>
                      <h3 className="font-bold text-slate-900 text-base">{p.name}</h3>
                      <p className="text-xs text-slate-500 mt-0.5">
                        📍 {p.address}, {p.area}, {p.city}
                      </p>
                      <p className="text-[11px] text-slate-400 mt-1">
                        Entrance: {p.entrance_location || 'Main gate'} • Hours: {p.opening_time} - {p.closing_time}
                      </p>
                      <div className="mt-3 flex flex-wrap items-center gap-3">
                        {p.payment_qr_url && (
                          <img
                            src={p.payment_qr_url}
                            alt={`${p.name} business payment QR`}
                            className="h-16 w-16 rounded-lg border border-slate-200 bg-white object-contain p-1"
                          />
                        )}
                        <div className="flex flex-wrap items-center gap-2">
                          <label className={`inline-flex cursor-pointer items-center gap-2 rounded-xl border px-3 py-2 text-xs font-bold ${
                            p.payment_qr_url
                              ? 'border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
                              : 'border-brand-200 bg-brand-50 text-brand-700 hover:bg-brand-100'
                          } ${savingQrId === p.id ? 'pointer-events-none opacity-50' : ''}`}>
                            {p.payment_qr_url ? <QrCode className="h-4 w-4" /> : <Upload className="h-4 w-4" />}
                            {savingQrId === p.id ? 'Saving QR...' : p.payment_qr_url ? 'Replace Business QR' : 'Add Business QR'}
                            <input
                              type="file"
                              accept="image/jpeg,image/png,image/webp"
                              onChange={(event) => handlePaymentQrUpload(p.id, event)}
                              className="sr-only"
                              disabled={savingQrId === p.id}
                            />
                          </label>
                          {p.payment_qr_url && (
                            <button
                              type="button"
                              onClick={() => handleRemovePaymentQr(p.id)}
                              disabled={savingQrId === p.id}
                              className="rounded-xl border border-red-200 bg-white px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-50 disabled:opacity-50"
                            >
                              Remove QR
                            </button>
                          )}
                        </div>
                        <span className="text-[11px] text-slate-500">
                          UPI customers pay directly to this QR. JPEG, PNG, WebP · max 5 MB.
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Middle: Live Availability Stepper & Price Input */}
                  <div className="flex flex-wrap items-center gap-4 bg-white p-3 rounded-2xl border border-slate-200 shrink-0">
                    {/* Stepper */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Available Spots
                      </span>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleSpaceChange(p.id, -1)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition active:scale-95"
                          title="Decrease available space by 1"
                        >
                          <Minus className="w-3.5 h-3.5" />
                        </button>
                        <input
                          type="number"
                          value={edit.available_spaces}
                          onChange={(e) => {
                            const val = parseInt(e.target.value, 10);
                            setQuickEdits(prev => ({
                              ...prev,
                              [p.id]: {
                                ...prev[p.id],
                                available_spaces: isNaN(val) ? 0 : val
                              }
                            }));
                          }}
                          className="w-14 text-center py-1 rounded-lg border border-slate-200 font-extrabold text-sm text-slate-900 bg-slate-50"
                        />
                        <button
                          type="button"
                          onClick={() => handleSpaceChange(p.id, 1)}
                          className="w-8 h-8 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center justify-center font-bold transition active:scale-95"
                          title="Increase available space by 1"
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                        <span className="text-xs text-slate-400 font-medium">/ {edit.total_spaces}</span>
                      </div>
                    </div>

                    {/* Price */}
                    <div>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider block mb-1">
                        Rate (₹/hr)
                      </span>
                      <input
                        type="number"
                        value={edit.hourly_price}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value);
                          setQuickEdits(prev => ({
                            ...prev,
                            [p.id]: {
                              ...prev[p.id],
                              hourly_price: isNaN(val) ? 0 : val
                            }
                          }));
                        }}
                        className="w-16 text-center py-1.5 rounded-lg border border-slate-200 font-extrabold text-sm text-slate-900 bg-slate-50"
                      />
                    </div>

                    {/* Quick Save Button */}
                    <button
                      type="button"
                      onClick={() => handleQuickSave(p.id)}
                      className={`px-3.5 py-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition ${
                        isSaved
                          ? 'bg-emerald-600 text-white'
                          : 'bg-slate-900 hover:bg-brand-600 text-white'
                      }`}
                    >
                      {isSaved ? (
                        <>
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Saved!</span>
                        </>
                      ) : (
                        <>
                          <Save className="w-3.5 h-3.5" />
                          <span>Update</span>
                        </>
                      )}
                    </button>
                  </div>

                  {/* Right: Action Buttons */}
                  <div className="flex items-center gap-2 self-end lg:self-center">
                    <button
                      onClick={() => onSelectParking(p.id)}
                      className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition text-xs font-semibold"
                      title="Preview public view"
                    >
                      <ExternalLink className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => onEditParking(p.id)}
                      className="p-2.5 rounded-xl bg-brand-50 hover:bg-brand-100 text-brand-700 transition text-xs font-semibold flex items-center gap-1"
                      title="Edit full parking information"
                    >
                      <Edit className="w-4 h-4" />
                      <span>Edit</span>
                    </button>
                    <button
                      onClick={() => handleDelete(p.id, p.name)}
                      className="p-2.5 rounded-xl bg-red-50 hover:bg-red-100 text-red-600 transition"
                      title="Delete parking"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </section>

      {/* Two Column Grid: Recent Reports & Recent Reviews */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent Issue Reports */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-red-500" />
              <span>User Issue Reports</span>
            </h2>
            <button
              onClick={() => onNavigateTab('operator-reports')}
              className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentReports.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No reports filed by drivers.</p>
          ) : (
            <div className="space-y-3">
              {recentReports.map((r) => (
                <div key={r.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{r.parking_name}</span>
                    <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${
                      r.status === 'pending' ? 'bg-red-100 text-red-700' : 'bg-emerald-100 text-emerald-700'
                    }`}>
                      {r.status}
                    </span>
                  </div>
                  <p className="text-slate-700 font-semibold">{r.reason}</p>
                  <p className="text-slate-500 text-[11px] mt-0.5">{r.description}</p>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Customer Reviews */}
        <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-xs space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-slate-100">
            <h2 className="font-bold text-slate-900 text-sm flex items-center gap-2">
              <Star className="w-4 h-4 text-amber-500 fill-amber-400" />
              <span>Recent Customer Reviews</span>
            </h2>
            <button
              onClick={() => onNavigateTab('operator-reviews')}
              className="text-xs font-bold text-brand-600 hover:underline flex items-center gap-0.5"
            >
              <span>View All</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>

          {recentReviews.length === 0 ? (
            <p className="text-xs text-slate-400 py-4 text-center">No reviews received yet.</p>
          ) : (
            <div className="space-y-3">
              {recentReviews.map((rev) => (
                <div key={rev.id} className="p-3 bg-slate-50 rounded-2xl border border-slate-200/70 text-xs">
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-bold text-slate-900">{rev.parking_name}</span>
                    <span className="text-amber-500 font-bold">{'★'.repeat(rev.rating)}</span>
                  </div>
                  <p className="text-slate-600">{rev.comment}</p>
                  <span className="text-[10px] text-slate-400 mt-1 block">By {rev.user_name}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
