import React, { useState } from 'react';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Compass,
  Zap,
  Shield,
  Video,
  Clock,
  Car,
  Image as ImageIcon,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle,
  Umbrella
} from 'lucide-react';
import { api } from '../services/api';
import { useLocation } from '../context/LocationContext';

export default function OperatorAddParking({ onCancel, onSuccess }) {
  const { coords } = useLocation();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: 'Pune',
    area: '',
    landmark: '',
    latitude: coords.lat.toString(),
    longitude: coords.lng.toString(),
    google_maps_url: '',
    entrance_location: 'Main Entrance Ramp & Ticket Gate',
    parking_type: 'Public',
    contact_number: '+91 98230 12345',
    opening_time: '07:00',
    closing_time: '23:00',
    total_spaces: '100',
    available_spaces: '45',
    hourly_price: '30',
    two_hour_price: '50',
    five_hour_price: '100',
    daily_price: '220',
    is_free: false,
    is_covered: true,
    is_open: false,
    has_cctv: true,
    has_security: true,
    has_ev_charging: true
  });

  const [photos, setPhotos] = useState([
    {
      url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80',
      type: 'entrance',
      caption: 'Main Entry Ingress Ramp'
    },
    {
      url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80',
      type: 'area',
      caption: 'Covered Parking Bays'
    },
    {
      url: 'https://images.unsplash.com/photo-1573348722427-f1d6819fdf98?auto=format&fit=crop&w=1200&q=80',
      type: 'space',
      caption: 'Dedicated EV Charging Slots'
    }
  ]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
  };

  const handleAddPhoto = () => {
    setPhotos(prev => [
      ...prev,
      {
        url: 'https://images.unsplash.com/photo-1621929747188-0b4dc28498d2?auto=format&fit=crop&w=1200&q=80',
        type: 'general',
        caption: 'Facility View'
      }
    ]);
  };

  const handleRemovePhoto = (index) => {
    setPhotos(prev => prev.filter((_, i) => i !== index));
  };

  const handlePhotoChange = (index, field, value) => {
    setPhotos(prev => prev.map((p, i) => i === index ? { ...p, [field]: value } : p));
  };

  const handleSetCurrentCoords = () => {
    setFormData(prev => ({
      ...prev,
      latitude: coords.lat.toFixed(5),
      longitude: coords.lng.toFixed(5)
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.name || !formData.address || !formData.area || !formData.city || !formData.contact_number) {
      setError('Please fill in all required fields.');
      return;
    }

    try {
      setLoading(true);
      setError(null);

      const payload = {
        ...formData,
        photos: photos.filter(p => p.url && p.url.trim())
      };

      const res = await api.addParking(payload);
      onSuccess(res.parking);
    } catch (err) {
      console.error('Add parking error:', err);
      setError(err.message || 'Failed to add parking.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="mb-6 flex items-center justify-between">
        <button
          onClick={onCancel}
          className="flex items-center gap-1.5 text-xs font-bold text-slate-600 hover:text-slate-900 bg-white px-3.5 py-2 rounded-xl border border-slate-200"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Dashboard</span>
        </button>

        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1.5 rounded-xl border border-emerald-200">
          ⚡ Direct Instant Publishing Enabled
        </span>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="pb-6 border-b border-slate-100 mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">List New Parking Location</h1>
          <p className="text-xs text-slate-500 mt-1">
            Fill in the details below. As soon as you submit, this parking will be immediately visible on Driver search & map.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1: Basic Info */}
          <div>
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              1. Basic Parking Information
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Parking Facility Name *
                </label>
                <input
                  type="text"
                  required
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  placeholder="e.g. Grand City Mall Multilevel Parking"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Parking Type *
                </label>
                <select
                  name="parking_type"
                  value={formData.parking_type}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500 bg-white"
                >
                  <option value="Public">Public Parking</option>
                  <option value="Private">Private Facility</option>
                  <option value="Mall">Shopping Mall</option>
                  <option value="Hospital">Hospital / Healthcare</option>
                  <option value="Railway Station">Railway Station</option>
                  <option value="Street Parking">Street Parking</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Operator Contact Phone *
                </label>
                <input
                  type="text"
                  required
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  placeholder="+91 98230 12345"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Location & Coordinates */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              2. Location & Navigation Coordinates
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Full Street Address *
                </label>
                <input
                  type="text"
                  required
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  placeholder="e.g. Plot 42, Off MG Road, Near Central Square"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Area / Locality *
                </label>
                <input
                  type="text"
                  required
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
                  placeholder="e.g. Camp / Deccan / Viman Nagar"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  City *
                </label>
                <input
                  type="text"
                  required
                  name="city"
                  value={formData.city}
                  onChange={handleChange}
                  placeholder="e.g. Pune"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Nearby Landmark
                </label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleChange}
                  placeholder="e.g. Opposite Westend Metro Station"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Exact Entrance Location Guide
                </label>
                <input
                  type="text"
                  name="entrance_location"
                  value={formData.entrance_location}
                  onChange={handleChange}
                  placeholder="e.g. Gate 2, North Wing Basement Ramp"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-1">
                  <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Latitude *
                  </label>
                  <button
                    type="button"
                    onClick={handleSetCurrentCoords}
                    className="text-[11px] font-bold text-brand-600 hover:underline flex items-center gap-1"
                  >
                    <Compass className="w-3 h-3" />
                    <span>Use Current GPS</span>
                  </button>
                </div>
                <input
                  type="number"
                  step="any"
                  required
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  placeholder="18.5204"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Longitude *
                </label>
                <input
                  type="number"
                  step="any"
                  required
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
                  placeholder="73.8567"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Google Maps Link
                </label>
                <input
                  type="url"
                  name="google_maps_url"
                  value={formData.google_maps_url}
                  onChange={handleChange}
                  placeholder="https://maps.app.goo.gl/..."
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">Optional. Drivers can open this exact pin in Google Maps.</p>
              </div>
            </div>
          </div>

          {/* Section 3: Spaces & Pricing */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              3. Spaces, Hours & Pricing
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Total Capacity *
                </label>
                <input
                  type="number"
                  required
                  name="total_spaces"
                  value={formData.total_spaces}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Initial Available *
                </label>
                <input
                  type="number"
                  required
                  name="available_spaces"
                  value={formData.available_spaces}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-emerald-600 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Opening Time
                </label>
                <input
                  type="time"
                  name="opening_time"
                  value={formData.opening_time}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
                <p className="mt-1 text-[11px] text-slate-500">India time. Set both times equal for 24-hour access.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Closing Time
                </label>
                <input
                  type="time"
                  name="closing_time"
                  value={formData.closing_time}
                  onChange={handleChange}
                  required
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  1 Hour (₹) *
                </label>
                <input
                  type="number"
                  name="hourly_price"
                  value={formData.hourly_price}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  2 Hours (₹)
                </label>
                <input
                  type="number"
                  name="two_hour_price"
                  value={formData.two_hour_price}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  5 Hours (₹)
                </label>
                <input
                  type="number"
                  name="five_hour_price"
                  value={formData.five_hour_price}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Daily Pass (₹)
                </label>
                <input
                  type="number"
                  name="daily_price"
                  value={formData.daily_price}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Section 4: Facilities & Amenities */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              4. Facilities & Security Features
            </h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="has_ev_charging"
                  checked={formData.has_ev_charging}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-800">EV Fast Charging</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="is_covered"
                  checked={formData.is_covered}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-800">Covered Roof</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="is_open"
                  checked={formData.is_open}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-800">Open Air Lot</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="has_cctv"
                  checked={formData.has_cctv}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-800">24/7 CCTV Camera</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="has_security"
                  checked={formData.has_security}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-xs font-semibold text-slate-800">Security Guard</span>
              </label>

              <label className="flex items-center gap-2.5 p-3 rounded-xl border border-slate-200 cursor-pointer hover:bg-slate-50">
                <input
                  type="checkbox"
                  name="is_free"
                  checked={formData.is_free}
                  onChange={handleChange}
                  className="w-4 h-4 text-brand-600 rounded"
                />
                <span className="text-xs font-semibold text-emerald-700">100% Free Parking</span>
              </label>
            </div>
          </div>

          {/* Section 5: Photos (Entrance, Area, Space, Exit, Signboard) */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                  5. Parking Photos Gallery
                </h3>
                <p className="text-xs text-slate-500">Provide direct image URLs categorized by view</p>
              </div>
              <button
                type="button"
                onClick={handleAddPhoto}
                className="text-xs font-bold text-brand-600 hover:text-brand-700 bg-brand-50 px-3 py-1.5 rounded-xl transition flex items-center gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>Add Photo URL</span>
              </button>
            </div>

            <div className="space-y-3">
              {photos.map((ph, idx) => (
                <div key={idx} className="p-3.5 bg-slate-50 rounded-2xl border border-slate-200 flex flex-col sm:flex-row items-start sm:items-center gap-3">
                  <select
                    value={ph.type}
                    onChange={(e) => handlePhotoChange(idx, 'type', e.target.value)}
                    className="px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold bg-white"
                  >
                    <option value="entrance">Entrance Photo</option>
                    <option value="area">Parking Area Photo</option>
                    <option value="space">Space / EV Photo</option>
                    <option value="exit">Exit Photo</option>
                    <option value="signboard">Signboard Photo</option>
                    <option value="general">General View</option>
                  </select>

                  <input
                    type="url"
                    value={ph.url}
                    onChange={(e) => handlePhotoChange(idx, 'url', e.target.value)}
                    placeholder="https://images.unsplash.com/..."
                    className="flex-1 w-full px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white font-mono"
                  />

                  <input
                    type="text"
                    value={ph.caption}
                    onChange={(e) => handlePhotoChange(idx, 'caption', e.target.value)}
                    placeholder="Caption"
                    className="w-full sm:w-40 px-3 py-1.5 rounded-lg border border-slate-200 text-xs bg-white"
                  />

                  {photos.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemovePhoto(idx)}
                      className="p-1.5 text-slate-400 hover:text-red-500 transition"
                      title="Remove photo"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* Submit Action Bar */}
          <div className="pt-6 border-t border-slate-100 flex items-center justify-end gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="px-5 py-3 rounded-2xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-brand-500/25 transition disabled:opacity-50 flex items-center gap-2"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>{loading ? 'Publishing...' : 'Directly Publish Parking'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
