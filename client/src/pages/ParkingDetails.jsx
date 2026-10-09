import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  MapPin,
  Phone,
  Navigation,
  Heart,
  CreditCard,
  Star,
  AlertTriangle,
  Zap,
  Shield,
  Video,
  Clock,
  Car,
  Compass,
  CheckCircle2,
  Share2,
  Building2,
  Umbrella,
  Sun
} from 'lucide-react';
import { api } from '../services/api';
import { useLocation } from '../context/LocationContext';
import useParkingHours, { formatParkingTime } from '../hooks/useParkingHours';
import AvailabilityBadge from '../components/AvailabilityBadge';
import PhotoGallery from '../components/PhotoGallery';
import PaymentModal from '../components/PaymentModal';
import ReviewModal from '../components/ReviewModal';
import ReportModal from '../components/ReportModal';

export default function ParkingDetails({ parkingId, onBack, onNavigateTab }) {
  const { coords } = useLocation();
  const [parking, setParking] = useState(null);
  const isOpenNow = useParkingHours(parking?.opening_time, parking?.closing_time);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Modals state
  const [isPaymentOpen, setIsPaymentOpen] = useState(false);
  const [isReviewOpen, setIsReviewOpen] = useState(false);
  const [isReportOpen, setIsReportOpen] = useState(false);
  const [favLoading, setFavLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const fetchDetails = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getParkingDetails(parkingId, { lat: coords.lat, lng: coords.lng });
      setParking(res.parking);
    } catch (err) {
      console.error('Fetch parking details error:', err);
      setError('Unable to load parking details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (parkingId) {
      fetchDetails();
    }
  }, [parkingId, coords]);

  const handleToggleFavourite = async () => {
    if (favLoading || !parking) return;
    try {
      setFavLoading(true);
      const res = await api.toggleFavourite(parking.id);
      setParking(prev => ({ ...prev, is_favourite: res.is_favourite }));
    } catch (err) {
      console.error('Toggle fav error:', err);
    } finally {
      setFavLoading(false);
    }
  };

  const handleGetDirections = () => {
    if (!parking) return;
    const destName = encodeURIComponent(`${parking.name}, ${parking.entrance_location || ''}, ${parking.area}, ${parking.city}`);
    const mapsUrl = parking.google_maps_url
      || `https://www.google.com/maps/dir/?api=1&destination=${parking.latitude},${parking.longitude}&destination_place_id=${destName}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  const handleShare = () => {
    if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      setCopiedLink(true);
      setTimeout(() => setCopiedLink(false), 2500);
    }
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 text-center">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-bold text-slate-800">Loading Parking Details...</h3>
      </div>
    );
  }

  if (error || !parking) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <div className="w-16 h-16 bg-red-100 text-red-600 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <AlertTriangle className="w-8 h-8" />
        </div>
        <h3 className="text-xl font-bold text-slate-900 mb-2">Parking Location Not Found</h3>
        <p className="text-xs text-slate-500 mb-6">{error || 'This parking record may have been updated or removed.'}</p>
        <button
          onClick={onBack}
          className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700"
        >
          Return to Search
        </button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-20">
      {/* Top Breadcrumb & Quick Actions Bar */}
      <div className="bg-white border-b border-slate-200 sticky top-16 z-30 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3 flex items-center justify-between gap-2">
          <button
            onClick={onBack}
            className="flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-brand-600 px-3 py-2 rounded-xl hover:bg-slate-100 transition"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Back to Search</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={handleShare}
              className="p-2 rounded-xl text-slate-600 hover:text-slate-900 hover:bg-slate-100 transition text-xs font-semibold flex items-center gap-1"
              title="Share parking link"
            >
              <Share2 className="w-4 h-4" />
              <span className="hidden sm:inline">{copiedLink ? 'Link Copied!' : 'Share'}</span>
            </button>

            <button
              onClick={handleToggleFavourite}
              disabled={favLoading}
              className={`p-2 rounded-xl text-xs font-bold flex items-center gap-1.5 transition border ${
                parking.is_favourite
                  ? 'bg-red-50 text-red-600 border-red-200'
                  : 'bg-white text-slate-700 hover:bg-slate-50 border-slate-200'
              }`}
            >
              <Heart className={`w-4 h-4 ${parking.is_favourite ? 'fill-red-500 text-red-500' : ''}`} />
              <span className="hidden sm:inline">{parking.is_favourite ? 'Saved' : 'Add to Favourite'}</span>
            </button>
          </div>
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-6">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          {/* Left Column: Photos, Details, Facilities, Reviews */}
          <div className="lg:col-span-8 space-y-6">
            {/* Photo Gallery Carousel */}
            <PhotoGallery photos={parking.photos} parkingName={parking.name} />

            {/* Main Header Info Card */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="px-3 py-1 bg-brand-50 text-brand-700 font-bold text-xs rounded-xl border border-brand-200 uppercase tracking-wider">
                    {parking.parking_type}
                  </span>
                  <AvailabilityBadge
                    availableSpaces={parking.available_spaces}
                    totalSpaces={parking.total_spaces}
                    openingTime={parking.opening_time}
                    closingTime={parking.closing_time}
                    size="large"
                  />
                </div>

                {parking.distance !== null && parking.distance !== undefined && (
                  <span className="text-xs font-bold text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl border border-brand-200 flex items-center gap-1">
                    <Compass className="w-3.5 h-3.5" />
                    <span>{parking.distance} km from your location</span>
                  </span>
                )}
              </div>

              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight">
                  {parking.name}
                </h1>
                <p className="text-sm text-slate-600 mt-2 flex items-start gap-1.5">
                  <MapPin className="w-4 h-4 text-brand-600 shrink-0 mt-0.5" />
                  <span>
                    {parking.address}, {parking.area}, {parking.city}
                    {parking.landmark ? ` (Landmark: ${parking.landmark})` : ''}
                  </span>
                </p>
              </div>

              {/* Exact Entrance Location Notice */}
              <div className="p-4 rounded-2xl bg-amber-50/70 border border-amber-200/80 flex items-start gap-3">
                <div className="p-2 bg-amber-100 rounded-xl text-amber-800 shrink-0 mt-0.5">
                  <Navigation className="w-4 h-4" />
                </div>
                <div>
                  <h4 className="text-xs font-bold text-amber-950 uppercase tracking-wider">Exact Entrance Guide</h4>
                  <p className="text-xs text-amber-900 mt-0.5">
                    {parking.entrance_location || 'Main entrance accessible from front service lane.'}
                  </p>
                  <p className="text-[11px] text-amber-700 mt-1">
                    GPS Coordinates: {parking.latitude.toFixed(5)}, {parking.longitude.toFixed(5)}
                  </p>
                </div>
              </div>

              {/* Live Spaces Capacity Meters */}
              <div className="pt-2">
                <div className="flex justify-between text-xs font-bold text-slate-700 mb-1.5">
                  <span>Available Spaces Capacity</span>
                  <span>{parking.available_spaces} of {parking.total_spaces} spaces</span>
                </div>
                <div className="w-full bg-slate-100 h-3 rounded-full overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all duration-500 ${
                      parking.available_spaces === 0
                        ? 'bg-red-500'
                        : parking.available_spaces <= 5
                        ? 'bg-amber-500'
                        : 'bg-emerald-500'
                    }`}
                    style={{
                      width: `${Math.min(100, (parking.available_spaces / (parking.total_spaces || 1)) * 100)}%`
                    }}
                  />
                </div>
              </div>
            </div>

            {/* Parking Pricing Tiers */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-brand-600" />
                <span>Transparent Parking Tariff</span>
              </h2>

              {parking.is_free ? (
                <div className="p-6 bg-emerald-50 rounded-2xl border border-emerald-200 text-center">
                  <span className="text-2xl font-extrabold text-emerald-700">100% FREE PARKING</span>
                  <p className="text-xs text-emerald-600 mt-1">No hourly charges apply at this parking facility.</p>
                </div>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 font-medium block">1 Hour</span>
                    <span className="text-xl font-extrabold text-slate-900 mt-1 block">₹{parking.hourly_price}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 font-medium block">2 Hours</span>
                    <span className="text-xl font-extrabold text-slate-900 mt-1 block">₹{parking.two_hour_price || parking.hourly_price * 1.8}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-slate-50 border border-slate-200 text-center">
                    <span className="text-xs text-slate-500 font-medium block">5 Hours</span>
                    <span className="text-xl font-extrabold text-slate-900 mt-1 block">₹{parking.five_hour_price || parking.hourly_price * 4}</span>
                  </div>
                  <div className="p-4 rounded-2xl bg-brand-50 border border-brand-200 text-center">
                    <span className="text-xs text-brand-700 font-bold block">Daily Pass</span>
                    <span className="text-xl font-extrabold text-brand-900 mt-1 block">₹{parking.daily_price || parking.hourly_price * 8}</span>
                  </div>
                </div>
              )}
            </div>

            {/* Facilities & Features Grid */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
              <h2 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
                <Building2 className="w-5 h-5 text-brand-600" />
                <span>Facilities & Security</span>
              </h2>

              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs font-semibold">
                <div className={`p-3.5 rounded-2xl border flex items-center gap-2.5 ${
                  parking.is_covered ? 'bg-blue-50/60 border-blue-200 text-blue-900' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                }`}>
                  <Umbrella className="w-4 h-4 text-blue-600" />
                  <span>{parking.is_covered ? 'Covered Roof' : 'Open Air Lot'}</span>
                </div>

                <div className={`p-3.5 rounded-2xl border flex items-center gap-2.5 ${
                  parking.has_ev_charging ? 'bg-emerald-50/70 border-emerald-200 text-emerald-900' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                }`}>
                  <Zap className="w-4 h-4 text-emerald-600" />
                  <span>{parking.has_ev_charging ? 'EV Charging Ready' : 'No EV Chargers'}</span>
                </div>

                <div className={`p-3.5 rounded-2xl border flex items-center gap-2.5 ${
                  parking.has_cctv ? 'bg-slate-100 border-slate-300 text-slate-900' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                }`}>
                  <Video className="w-4 h-4 text-slate-700" />
                  <span>{parking.has_cctv ? '24/7 CCTV Monitored' : 'No CCTV'}</span>
                </div>

                <div className={`p-3.5 rounded-2xl border flex items-center gap-2.5 ${
                  parking.has_security ? 'bg-indigo-50/70 border-indigo-200 text-indigo-900' : 'bg-slate-50 border-slate-200 text-slate-400 opacity-60'
                }`}>
                  <Shield className="w-4 h-4 text-indigo-600" />
                  <span>{parking.has_security ? 'Security Guards on Duty' : 'Self Guarded'}</span>
                </div>

                <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 text-slate-800 flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-brand-600" />
                  <span>Hours: {formatParkingTime(parking.opening_time, '07:00')} - {formatParkingTime(parking.closing_time, '23:00')}</span>
                </div>

                <div className="p-3.5 rounded-2xl border bg-slate-50 border-slate-200 text-slate-800 flex items-center gap-2.5">
                  <Car className="w-4 h-4 text-brand-600" />
                  <span>Type: {parking.parking_type}</span>
                </div>
              </div>
            </div>

            {/* Ratings & Customer Reviews */}
            <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/90 shadow-xs">
              <div className="flex items-center justify-between mb-6">
                <div>
                  <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                    <Star className="w-5 h-5 text-amber-500 fill-amber-400" />
                    <span>Customer Ratings & Reviews</span>
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {parking.review_count} driver feedback submissions
                  </p>
                </div>
                <button
                  onClick={() => setIsReviewOpen(true)}
                  className="px-4 py-2 rounded-xl bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 text-xs font-bold flex items-center gap-1.5 transition"
                >
                  <Star className="w-3.5 h-3.5" />
                  <span>Write a Review</span>
                </button>
              </div>

              {/* Reviews List */}
              {parking.reviews && parking.reviews.length > 0 ? (
                <div className="space-y-4 divide-y divide-slate-100">
                  {parking.reviews.map((rev) => (
                    <div key={rev.id} className="pt-4 first:pt-0">
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <img
                            src={rev.user_avatar || 'https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?auto=format&fit=crop&w=200&q=80'}
                            alt={rev.user_name}
                            className="w-7 h-7 rounded-full object-cover"
                          />
                          <span className="text-xs font-bold text-slate-900">{rev.user_name}</span>
                        </div>
                        <div className="flex items-center gap-1 text-amber-500 text-xs font-bold">
                          {'★'.repeat(rev.rating)}{'☆'.repeat(5 - rev.rating)}
                        </div>
                      </div>
                      <p className="text-xs text-slate-600 leading-relaxed pl-9">{rev.comment}</p>
                      <span className="text-[10px] text-slate-400 block pl-9 mt-1">
                        {new Date(rev.created_at).toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' })}
                      </span>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="py-8 text-center bg-slate-50 rounded-2xl">
                  <p className="text-xs text-slate-500">No reviews yet for this parking.</p>
                  <button
                    onClick={() => setIsReviewOpen(true)}
                    className="mt-2 text-xs font-bold text-brand-600 hover:underline"
                  >
                    Be the first driver to leave a review!
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Right Column: Sticky Action Box (Directions, Call, Pay, Report) */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white rounded-3xl p-6 border border-slate-200/90 shadow-lg sticky top-32 space-y-4">
              <div>
                <span className="text-[10px] uppercase tracking-wider font-bold text-slate-400 block">
                  Quick Actions
                </span>
                <h3 className="text-xl font-extrabold text-slate-900 mt-0.5">
                  {parking.is_free ? 'Free Parking' : `₹${parking.hourly_price} / hour`}
                </h3>
              </div>

              {/* 1. Get Directions Button */}
              <button
                onClick={handleGetDirections}
                className="w-full py-3.5 px-4 rounded-2xl bg-brand-600 hover:bg-brand-700 text-white font-bold text-sm shadow-md shadow-brand-500/25 flex items-center justify-center gap-2 transition"
              >
                <Navigation className="w-5 h-5" />
                <span>Get Directions (Google Maps)</span>
              </button>

              {/* Book a slot and continue to payment */}
              <button
                onClick={() => setIsPaymentOpen(true)}
                disabled={!isOpenNow}
                className={`w-full py-3.5 px-4 rounded-2xl text-white font-bold text-sm shadow-md flex items-center justify-center gap-2 transition ${
                  isOpenNow
                    ? 'bg-emerald-600 hover:bg-emerald-700 shadow-emerald-600/25'
                    : 'bg-slate-400 shadow-slate-400/25 cursor-not-allowed'
                }`}
              >
                <CreditCard className="w-5 h-5" />
                <span>{isOpenNow ? 'Book a Parking Slot' : `Closed until ${formatParkingTime(parking.opening_time, '07:00')}`}</span>
              </button>

              {/* 3. Call Operator Button */}
              <a
                href={`tel:${parking.contact_number}`}
                className="w-full py-3 px-4 rounded-2xl bg-slate-100 hover:bg-slate-200 text-slate-800 font-bold text-xs flex items-center justify-center gap-2 transition"
              >
                <Phone className="w-4 h-4 text-slate-600" />
                <span>Call Parking ({parking.contact_number})</span>
              </a>

              {/* 4. Report Incorrect Info Button */}
              <button
                onClick={() => setIsReportOpen(true)}
                className="w-full py-2.5 px-3 text-xs font-semibold text-slate-500 hover:text-red-600 flex items-center justify-center gap-1.5 transition"
              >
                <AlertTriangle className="w-3.5 h-3.5" />
                <span>Report Incorrect Information</span>
              </button>

              {/* Operator Contact Info Box */}
              <div className="pt-4 border-t border-slate-100 text-xs text-slate-500 space-y-1">
                <span className="font-bold text-slate-700 block">Managed by:</span>
                <p className="text-slate-800 font-semibold">{parking.operator_name}</p>
                <p className="text-[11px]">{parking.operator_phone || parking.contact_number}</p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Payment Modal */}
      <PaymentModal
        isOpen={isPaymentOpen}
        onClose={() => setIsPaymentOpen(false)}
        parking={parking}
        onPaymentSuccess={() => fetchDetails()}
      />

      {/* Review Modal */}
      <ReviewModal
        isOpen={isReviewOpen}
        onClose={() => setIsReviewOpen(false)}
        parkingId={parking.id}
        parkingName={parking.name}
        onReviewSubmitted={() => fetchDetails()}
      />

      {/* Report Modal */}
      <ReportModal
        isOpen={isReportOpen}
        onClose={() => setIsReportOpen(false)}
        parkingId={parking.id}
        parkingName={parking.name}
      />
    </div>
  );
}
