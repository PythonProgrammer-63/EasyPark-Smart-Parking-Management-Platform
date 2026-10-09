import React, { useState } from 'react';
import { X, SlidersHorizontal, Check, RefreshCw, Zap, Shield, Video, Umbrella, Sun } from 'lucide-react';

export default function FilterModal({ isOpen, onClose, initialFilters, onApply }) {
  const [filters, setFilters] = useState(initialFilters || {
    parking_type: 'All',
    price_filter: 'all',
    max_distance: '',
    is_covered: false,
    is_open: false,
    has_cctv: false,
    has_security: false,
    has_ev_charging: false
  });

  if (!isOpen) return null;

  const handleReset = () => {
    const defaultState = {
      parking_type: 'All',
      price_filter: 'all',
      max_distance: '',
      is_covered: false,
      is_open: false,
      has_cctv: false,
      has_security: false,
      has_ev_charging: false
    };
    setFilters(defaultState);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    onApply(filters);
    onClose();
  };

  const parkingTypes = ['All', 'Mall', 'Hospital', 'Public', 'Private', 'Railway Station', 'Street Parking'];

  const priceOptions = [
    { value: 'all', label: 'All Prices' },
    { value: 'free', label: 'Free Only' },
    { value: 'paid', label: 'Paid Only' },
    { value: 'low_to_high', label: 'Price: Low to High' },
    { value: 'high_to_low', label: 'Price: High to Low' }
  ];

  const distanceOptions = [
    { value: '', label: 'Any Distance' },
    { value: '0.5', label: 'Within 500m' },
    { value: '1', label: 'Within 1 km' },
    { value: '2', label: 'Within 2 km' },
    { value: '5', label: 'Within 5 km' }
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl max-w-lg w-full overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-50 border-b border-slate-100 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-brand-50 text-brand-600 rounded-xl">
              <SlidersHorizontal className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base">Filter Parking</h3>
              <p className="text-xs text-slate-500">Refine parking spots by price, distance, and facilities</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-xl text-slate-400 hover:text-slate-600 hover:bg-slate-200 transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Filter Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6 max-h-[75vh] overflow-y-auto">
          {/* Parking Type Chips */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Parking Type
            </label>
            <div className="flex flex-wrap gap-2">
              {parkingTypes.map(type => (
                <button
                  type="button"
                  key={type}
                  onClick={() => setFilters(prev => ({ ...prev, parking_type: type }))}
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold transition ${
                    filters.parking_type === type
                      ? 'bg-brand-600 text-white shadow-xs'
                      : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>
          </div>

          {/* Pricing Options */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Pricing Option
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {priceOptions.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setFilters(prev => ({ ...prev, price_filter: opt.value }))}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-center transition border ${
                    filters.price_filter === opt.value
                      ? 'bg-brand-50 border-brand-500 text-brand-700 font-bold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Distance Filter */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Maximum Distance
            </label>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {distanceOptions.map(opt => (
                <button
                  type="button"
                  key={opt.value}
                  onClick={() => setFilters(prev => ({ ...prev, max_distance: opt.value }))}
                  className={`px-3 py-2 rounded-xl text-xs font-semibold text-center transition border ${
                    filters.max_distance === opt.value
                      ? 'bg-brand-50 border-brand-500 text-brand-700 font-bold'
                      : 'border-slate-200 text-slate-700 hover:bg-slate-50'
                  }`}
                >
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Facilities & Amenities */}
          <div>
            <label className="block text-xs font-bold text-slate-700 uppercase tracking-wider mb-2.5">
              Facilities & Security
            </label>
            <div className="space-y-2.5">
              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5 text-xs font-medium text-slate-800">
                  <Zap className="w-4 h-4 text-emerald-500" />
                  <span>EV Charging Available</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.has_ev_charging}
                  onChange={(e) => setFilters(prev => ({ ...prev, has_ev_charging: e.target.checked }))}
                  className="w-4 h-4 text-brand-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5 text-xs font-medium text-slate-800">
                  <Umbrella className="w-4 h-4 text-blue-500" />
                  <span>Covered Roof Parking</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.is_covered}
                  onChange={(e) => setFilters(prev => ({ ...prev, is_covered: e.target.checked }))}
                  className="w-4 h-4 text-brand-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5 text-xs font-medium text-slate-800">
                  <Video className="w-4 h-4 text-slate-600" />
                  <span>CCTV Surveillance</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.has_cctv}
                  onChange={(e) => setFilters(prev => ({ ...prev, has_cctv: e.target.checked }))}
                  className="w-4 h-4 text-brand-600 rounded"
                />
              </label>

              <label className="flex items-center justify-between p-3 rounded-xl border border-slate-200 hover:bg-slate-50 cursor-pointer">
                <div className="flex items-center gap-2.5 text-xs font-medium text-slate-800">
                  <Shield className="w-4 h-4 text-brand-600" />
                  <span>On-site Security Guard</span>
                </div>
                <input
                  type="checkbox"
                  checked={filters.has_security}
                  onChange={(e) => setFilters(prev => ({ ...prev, has_security: e.target.checked }))}
                  className="w-4 h-4 text-brand-600 rounded"
                />
              </label>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-100 flex items-center justify-between gap-3">
            <button
              type="button"
              onClick={handleReset}
              className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 flex items-center gap-1.5 transition"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Reset All</span>
            </button>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 rounded-xl text-xs font-semibold text-slate-600 hover:bg-slate-100 transition"
              >
                Cancel
              </button>
              <button
                type="submit"
                className="px-6 py-2.5 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white shadow-md shadow-brand-500/20 transition"
              >
                Apply Filters
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
