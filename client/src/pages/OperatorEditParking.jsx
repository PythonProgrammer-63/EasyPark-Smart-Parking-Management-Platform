import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Save,
  Plus,
  Trash2,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { formatTimeForInput } from '../hooks/useParkingHours';

export default function OperatorEditParking({ parkingId, onCancel, onSuccess }) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    name: '',
    address: '',
    city: '',
    area: '',
    landmark: '',
    latitude: '',
    longitude: '',
    google_maps_url: '',
    entrance_location: '',
    parking_type: 'Public',
    contact_number: '',
    opening_time: '07:00',
    closing_time: '23:00',
    total_spaces: '',
    available_spaces: '',
    hourly_price: '',
    two_hour_price: '',
    five_hour_price: '',
    daily_price: '',
    is_free: false,
    is_covered: true,
    is_open: false,
    has_cctv: true,
    has_security: true,
    has_ev_charging: false
  });

  const [photos, setPhotos] = useState([]);

  useEffect(() => {
    const fetchParking = async () => {
      try {
        setLoading(true);
        const res = await api.getParkingDetails(parkingId);
        const p = res.parking;
        setFormData({
          name: p.name || '',
          address: p.address || '',
          city: p.city || '',
          area: p.area || '',
          landmark: p.landmark || '',
          latitude: (p.latitude || '').toString(),
          longitude: (p.longitude || '').toString(),
          google_maps_url: p.google_maps_url || '',
          entrance_location: p.entrance_location || '',
          parking_type: p.parking_type || 'Public',
          contact_number: p.contact_number || '',
          opening_time: formatTimeForInput(p.opening_time, '07:00'),
          closing_time: formatTimeForInput(p.closing_time, '23:00'),
          total_spaces: (p.total_spaces || '').toString(),
          available_spaces: (p.available_spaces || '').toString(),
          hourly_price: (p.hourly_price || '').toString(),
          two_hour_price: (p.two_hour_price || '').toString(),
          five_hour_price: (p.five_hour_price || '').toString(),
          daily_price: (p.daily_price || '').toString(),
          is_free: !!p.is_free,
          is_covered: !!p.is_covered,
          is_open: !!p.is_open,
          has_cctv: !!p.has_cctv,
          has_security: !!p.has_security,
          has_ev_charging: !!p.has_ev_charging
        });

        if (p.photos && p.photos.length > 0) {
          setPhotos(p.photos.map(ph => ({
            url: ph.photo_url,
            type: ph.photo_type,
            caption: ph.caption || ''
          })));
        } else {
          setPhotos([
            {
              url: 'https://images.unsplash.com/photo-1590674899484-d5640e854abe?auto=format&fit=crop&w=1200&q=80',
              type: 'entrance',
              caption: 'Main Entrance'
            }
          ]);
        }
      } catch (err) {
        console.error('Fetch parking error:', err);
        setError('Failed to load parking for editing.');
      } finally {
        setLoading(false);
      }
    };

    if (parkingId) {
      fetchParking();
    }
  }, [parkingId]);

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
        url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80',
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      setSaving(true);
      setError(null);

      const payload = {
        ...formData,
        photos: photos.filter(p => p.url && p.url.trim())
      };

      const res = await api.updateParking(parkingId, payload);
      onSuccess(res.parking);
    } catch (err) {
      console.error('Update error:', err);
      setError(err.message || 'Failed to update parking.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-20 text-center text-xs text-slate-400">
        <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
        <h3 className="text-base font-bold text-slate-800">Loading Facility Details...</h3>
      </div>
    );
  }

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

        <span className="text-xs font-bold text-slate-500">Editing Parking ID #{parkingId}</span>
      </div>

      <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200 shadow-sm">
        <div className="pb-6 border-b border-slate-100 mb-6">
          <h1 className="text-2xl font-extrabold text-slate-900">Edit Parking Information</h1>
          <p className="text-xs text-slate-500 mt-1">
            Updates will reflect immediately for all drivers searching and browsing EasyPark.
          </p>
        </div>

        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 text-xs flex items-center gap-2 border border-red-200">
            <AlertCircle className="w-5 h-5 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Section 1 */}
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
                  Contact Number *
                </label>
                <input
                  type="text"
                  required
                  name="contact_number"
                  value={formData.contact_number}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>
            </div>
          </div>

          {/* Section 2: Address & Coordinates */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              2. Location & Coordinates
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="sm:col-span-2">
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Address *
                </label>
                <input
                  type="text"
                  required
                  name="address"
                  value={formData.address}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Area *
                </label>
                <input
                  type="text"
                  required
                  name="area"
                  value={formData.area}
                  onChange={handleChange}
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
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Landmark
                </label>
                <input
                  type="text"
                  name="landmark"
                  value={formData.landmark}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Entrance Guide
                </label>
                <input
                  type="text"
                  name="entrance_location"
                  value={formData.entrance_location}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Latitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="latitude"
                  value={formData.latitude}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Longitude
                </label>
                <input
                  type="number"
                  step="any"
                  name="longitude"
                  value={formData.longitude}
                  onChange={handleChange}
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
                  Total Spaces
                </label>
                <input
                  type="number"
                  name="total_spaces"
                  value={formData.total_spaces}
                  onChange={handleChange}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-xs font-bold text-slate-900 focus:ring-2 focus:ring-brand-500"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Available Spaces
                </label>
                <input
                  type="number"
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
                <p className="mt-1 text-[11px] text-slate-500">India time. Set both times equal for 24-hour access.</p>
              </div>

              <div>
                <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-1">
                  Hourly Price (₹)
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
                  2 Hours Price (₹)
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
                  5 Hours Price (₹)
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
                  Daily Price (₹)
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

          {/* Section 4: Facilities */}
          <div className="pt-4 border-t border-slate-100">
            <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider mb-3">
              4. Facilities & Security
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

          {/* Section 5: Photos */}
          <div className="pt-4 border-t border-slate-100 space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 uppercase tracking-wider">
                5. Parking Photos Gallery
              </h3>
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
                    placeholder="https://..."
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

          {/* Submit */}
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
              disabled={saving}
              className="px-8 py-3.5 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-lg shadow-brand-500/25 transition disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              <span>{saving ? 'Saving...' : 'Save All Changes'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
