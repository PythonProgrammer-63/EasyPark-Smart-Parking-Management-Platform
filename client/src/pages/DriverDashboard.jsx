import React, { useState, useEffect } from 'react';
import {
  Search,
  MapPin,
  Compass,
  SlidersHorizontal,
  LayoutGrid,
  List,
  Map as MapIcon,
  RefreshCw,
  Sparkles,
  Zap,
  Car,
  AlertCircle
} from 'lucide-react';
import { api } from '../services/api';
import { useLocation } from '../context/LocationContext';
import ParkingCard from '../components/ParkingCard';
import ParkingMap from '../components/ParkingMap';
import FilterModal from '../components/FilterModal';

export default function DriverDashboard({ onSelectParking, onNavigateTab }) {
  const { coords, isLocating, requestCurrentLocation, usingGps, locationName } = useLocation();
  const [searchTerm, setSearchTerm] = useState('');
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [viewMode, setViewMode] = useState('grid'); // 'grid', 'list', 'map'
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [activeFilters, setActiveFilters] = useState({
    parking_type: 'All',
    price_filter: 'all',
    max_distance: '',
    is_covered: false,
    is_open: false,
    has_cctv: false,
    has_security: false,
    has_ev_charging: false
  });

  const fetchParkings = async () => {
    try {
      setLoading(true);
      setError(null);

      const params = {
        search: searchTerm,
        lat: coords.lat,
        lng: coords.lng,
        parking_type: activeFilters.parking_type !== 'All' ? activeFilters.parking_type : undefined,
        price_filter: activeFilters.price_filter !== 'all' ? activeFilters.price_filter : undefined,
        max_distance: activeFilters.max_distance || undefined,
        is_covered: activeFilters.is_covered ? 'true' : undefined,
        is_open: activeFilters.is_open ? 'true' : undefined,
        has_cctv: activeFilters.has_cctv ? 'true' : undefined,
        has_security: activeFilters.has_security ? 'true' : undefined,
        has_ev_charging: activeFilters.has_ev_charging ? 'true' : undefined
      };

      const res = await api.getParkings(params);
      setParkings(res.parkings || []);
    } catch (err) {
      console.error('Fetch parkings error:', err);
      setError('Unable to load parking spots. Please verify server connection.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkings();
  }, [coords, activeFilters]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchParkings();
  };

  const activeFilterCount = [
    activeFilters.parking_type !== 'All',
    activeFilters.price_filter !== 'all',
    activeFilters.max_distance !== '',
    activeFilters.is_covered,
    activeFilters.is_open,
    activeFilters.has_cctv,
    activeFilters.has_security,
    activeFilters.has_ev_charging
  ].filter(Boolean).length;

  return (
    <div className="min-h-screen pb-16">
      {/* Hero Search Section */}
      <section className="bg-gradient-to-b from-brand-900 via-brand-800 to-brand-700 text-white pt-8 pb-14 px-4 sm:px-6 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center max-w-2xl mx-auto mb-8">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-white/10 backdrop-blur-md text-brand-100 mb-3 border border-white/20">
              <Sparkles className="w-3.5 h-3.5 text-amber-300" />
              <span>Smart Real-Time Parking Finder</span>
            </span>
            <h1 className="text-3xl sm:text-4xl font-extrabold tracking-tight">
              Find Open Parking in Seconds
            </h1>
            <p className="text-xs sm:text-sm text-brand-100 mt-2">
              Browse live slot availability, check hourly rates, EV charging, and get direct GPS navigation.
            </p>
          </div>

          {/* Search Bar Container */}
          <div className="max-w-3xl mx-auto bg-white rounded-3xl p-2.5 sm:p-3 shadow-2xl border border-white/20">
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row items-center gap-2">
              <div className="relative flex-1 w-full">
                <Search className="w-5 h-5 text-slate-400 absolute left-4 top-3.5" />
                <input
                  type="text"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  placeholder="Search by parking name, area, landmark, or city (e.g. Phoenix Mall)..."
                  className="w-full pl-11 pr-4 py-3 bg-slate-50 hover:bg-slate-100/80 focus:bg-white rounded-2xl text-xs sm:text-sm text-slate-900 focus:outline-hidden focus:ring-2 focus:ring-brand-500 border border-slate-200/80 transition"
                />
              </div>

              <div className="flex items-center gap-2 w-full sm:w-auto">
                <button
                  type="button"
                  onClick={requestCurrentLocation}
                  disabled={isLocating}
                  className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 ${
                    usingGps
                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                      : 'bg-brand-50 text-brand-700 hover:bg-brand-100 border border-brand-200'
                  }`}
                  title="Find parking near your current GPS location"
                >
                  <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
                  <span>{isLocating ? 'Locating...' : 'Near Me'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setIsFilterOpen(true)}
                  className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-center gap-1.5 transition shrink-0 border ${
                    activeFilterCount > 0
                      ? 'bg-brand-600 text-white border-brand-700 shadow-sm'
                      : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200'
                  }`}
                >
                  <SlidersHorizontal className="w-4 h-4" />
                  <span>Filters {activeFilterCount > 0 ? `(${activeFilterCount})` : ''}</span>
                </button>

                <button
                  type="submit"
                  className="px-6 py-3 bg-brand-600 hover:bg-brand-700 text-white font-bold text-xs sm:text-sm rounded-2xl shadow-md shadow-brand-500/25 transition shrink-0 hidden sm:block"
                >
                  Search
                </button>
              </div>
            </form>

            {/* Quick Keyword Suggestions */}
            <div className="mt-2.5 pt-2.5 border-t border-slate-100 px-2 flex flex-wrap items-center gap-1.5 text-xs text-slate-500">
              <span className="font-semibold text-slate-400">Popular:</span>
              {['Phoenix Mall', 'FC Road', 'Apollo Hospital', 'Railway Station', 'EV Charging'].map((kw) => (
                <button
                  key={kw}
                  type="button"
                  onClick={() => {
                    setSearchTerm(kw);
                    fetchParkings();
                  }}
                  className="px-2.5 py-1 rounded-lg bg-slate-100 hover:bg-brand-50 hover:text-brand-700 text-[11px] font-medium text-slate-600 transition"
                >
                  {kw}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Main Content Area */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-6">
        {/* Controls & Active State Bar */}
        <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <MapPin className="w-4 h-4 text-brand-600 shrink-0" />
            <span className="text-xs text-slate-500">Showing parking spots near:</span>
            <span className="text-xs font-bold text-slate-800 bg-slate-100 px-2.5 py-1 rounded-lg">
              {locationName}
            </span>
          </div>

          <div className="flex items-center justify-between w-full sm:w-auto gap-3">
            <span className="text-xs font-bold text-slate-500">
              {loading ? 'Searching...' : `${parkings.length} locations found`}
            </span>

            {/* View Mode Toggle Buttons */}
            <div className="flex items-center bg-slate-100 p-1 rounded-xl border border-slate-200">
              <button
                onClick={() => setViewMode('grid')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'grid' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Grid View"
              >
                <LayoutGrid className="w-4 h-4" />
                <span className="hidden md:inline">Grid</span>
              </button>
              <button
                onClick={() => setViewMode('list')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'list' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="List View"
              >
                <List className="w-4 h-4" />
                <span className="hidden md:inline">List</span>
              </button>
              <button
                onClick={() => setViewMode('map')}
                className={`p-1.5 rounded-lg text-xs font-semibold flex items-center gap-1 transition ${
                  viewMode === 'map' ? 'bg-white text-brand-700 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
                title="Map View"
              >
                <MapIcon className="w-4 h-4" />
                <span className="hidden md:inline">Map</span>
              </button>
            </div>
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mb-6 p-4 rounded-2xl bg-red-50 text-red-700 text-xs flex items-center justify-between border border-red-200">
            <div className="flex items-center gap-2">
              <AlertCircle className="w-5 h-5 shrink-0" />
              <span>{error}</span>
            </div>
            <button
              onClick={fetchParkings}
              className="px-3 py-1.5 bg-red-100 hover:bg-red-200 text-red-800 rounded-xl font-bold flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Retry</span>
            </button>
          </div>
        )}

        {/* Loading State */}
        {loading ? (
          <div className="py-20 text-center">
            <div className="w-12 h-12 border-4 border-brand-200 border-t-brand-600 rounded-full animate-spin mx-auto mb-4" />
            <h3 className="text-base font-bold text-slate-800">Scanning Parking Locations...</h3>
            <p className="text-xs text-slate-400 mt-1">Retrieving live spaces and rates</p>
          </div>
        ) : parkings.length === 0 ? (
          /* Empty State */
          <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-lg mx-auto">
            <div className="w-16 h-16 bg-slate-100 text-slate-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
              <Car className="w-8 h-8" />
            </div>
            <h3 className="text-lg font-bold text-slate-800 mb-1">No Matching Parking Found</h3>
            <p className="text-xs text-slate-500 mb-6">
              Try adjusting your search keywords, clearing applied filters, or expanding your search radius.
            </p>
            <button
              onClick={() => {
                setSearchTerm('');
                setActiveFilters({
                  parking_type: 'All',
                  price_filter: 'all',
                  max_distance: '',
                  is_covered: false,
                  is_open: false,
                  has_cctv: false,
                  has_security: false,
                  has_ev_charging: false
                });
              }}
              className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition"
            >
              Reset All Filters
            </button>
          </div>
        ) : (
          <>
            {/* Map View Mode */}
            {viewMode === 'map' && (
              <div className="space-y-4">
                <ParkingMap
                  parkings={parkings}
                  userCoords={coords}
                  onSelectParking={onSelectParking}
                  height="600px"
                />
              </div>
            )}

            {/* Grid / List View Modes */}
            {viewMode !== 'map' && (
              <div
                className={`grid gap-6 ${
                  viewMode === 'grid'
                    ? 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3'
                    : 'grid-cols-1'
                }`}
              >
                {parkings.map((parking) => (
                  <ParkingCard
                    key={parking.id}
                    parking={parking}
                    onSelect={onSelectParking}
                    userCoords={coords}
                  />
                ))}
              </div>
            )}
          </>
        )}
      </main>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        initialFilters={activeFilters}
        onApply={(newFilters) => setActiveFilters(newFilters)}
      />
    </div>
  );
}
