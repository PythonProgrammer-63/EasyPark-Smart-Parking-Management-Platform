import React, { useState, useEffect } from 'react';
import { Search, MapPin, Compass, SlidersHorizontal, Navigation, Star, ChevronRight, RefreshCw } from 'lucide-react';
import { api } from '../services/api';
import { useLocation } from '../context/LocationContext';
import ParkingMap from '../components/ParkingMap';
import AvailabilityBadge from '../components/AvailabilityBadge';
import FilterModal from '../components/FilterModal';

export default function MapViewPage({ onSelectParking }) {
  const { coords, isLocating, requestCurrentLocation, locationName } = useLocation();
  const [parkings, setParkings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedId, setSelectedId] = useState(null);
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [filters, setFilters] = useState({
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
      const params = {
        search: searchQuery,
        lat: coords.lat,
        lng: coords.lng,
        parking_type: filters.parking_type !== 'All' ? filters.parking_type : undefined,
        price_filter: filters.price_filter !== 'all' ? filters.price_filter : undefined,
        max_distance: filters.max_distance || undefined,
        is_covered: filters.is_covered ? 'true' : undefined,
        is_open: filters.is_open ? 'true' : undefined,
        has_cctv: filters.has_cctv ? 'true' : undefined,
        has_security: filters.has_security ? 'true' : undefined,
        has_ev_charging: filters.has_ev_charging ? 'true' : undefined
      };

      const res = await api.getParkings(params);
      setParkings(res.parkings || []);
      if (res.parkings?.length > 0 && !selectedId) {
        setSelectedId(res.parkings[0].id);
      }
    } catch (err) {
      console.error('Map fetch error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchParkings();
  }, [coords, filters]);

  const handleDirections = (p) => {
    const destName = encodeURIComponent(`${p.name}, ${p.area}, ${p.city}`);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&destination_place_id=${destName}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
      {/* Top Search & Filter Control Bar */}
      <div className="bg-white rounded-2xl p-4 shadow-sm border border-slate-200/90 mb-6 flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center gap-2 w-full md:w-auto">
          <div className="relative flex-1 md:w-80">
            <Search className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && fetchParkings()}
              placeholder="Search map spots..."
              className="w-full pl-9 pr-3 py-2 text-xs bg-slate-50 rounded-xl border border-slate-200 focus:outline-hidden focus:ring-2 focus:ring-brand-500"
            />
          </div>
          <button
            onClick={fetchParkings}
            className="px-3.5 py-2 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition"
          >
            Search
          </button>
        </div>

        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <button
            onClick={requestCurrentLocation}
            disabled={isLocating}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-brand-50 text-brand-700 hover:bg-brand-100 flex items-center gap-1.5 transition border border-brand-200"
          >
            <Compass className={`w-4 h-4 ${isLocating ? 'animate-spin' : ''}`} />
            <span>Near Me GPS</span>
          </button>

          <button
            onClick={() => setIsFilterOpen(true)}
            className="px-3 py-2 rounded-xl text-xs font-bold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1.5 transition border border-slate-200"
          >
            <SlidersHorizontal className="w-4 h-4" />
            <span>Filters</span>
          </button>
        </div>
      </div>

      {/* Split Map and Sidebar Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        {/* Left Side: Parking Cards Scrollable Sidebar */}
        <div className="lg:col-span-5 space-y-3 max-h-[750px] overflow-y-auto pr-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-xs font-bold text-slate-500">
              {parkings.length} Spots Plotted on Map
            </span>
            <span className="text-[11px] text-slate-400">Click marker or card</span>
          </div>

          {loading ? (
            <div className="py-12 text-center text-xs text-slate-400">Loading map markers...</div>
          ) : parkings.length === 0 ? (
            <div className="p-8 text-center bg-white rounded-2xl border border-slate-200 text-xs text-slate-500">
              No parking locations found with active filters.
            </div>
          ) : (
            parkings.map((p) => {
              const isSelected = selectedId === p.id;
              return (
                <div
                  key={p.id}
                  onClick={() => setSelectedId(p.id)}
                  className={`p-4 rounded-2xl border transition cursor-pointer flex gap-3 ${
                    isSelected
                      ? 'bg-brand-50/70 border-brand-500 shadow-sm ring-2 ring-brand-400/30'
                      : 'bg-white border-slate-200 hover:bg-slate-50'
                  }`}
                >
                  <img
                    src={p.primary_photo || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=300&q=80'}
                    alt={p.name}
                    className="w-20 h-20 rounded-xl object-cover shrink-0"
                  />
                  <div className="flex-1 min-w-0 flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-1">
                        <h4 className="font-bold text-xs text-slate-900 truncate">{p.name}</h4>
                        <span className="text-xs font-extrabold text-slate-900 shrink-0">
                          {p.is_free ? 'FREE' : `₹${p.hourly_price}/hr`}
                        </span>
                      </div>
                      <p className="text-[11px] text-slate-500 truncate mt-0.5">
                        📍 {p.area}, {p.city} {p.distance !== null ? `(${p.distance} km)` : ''}
                      </p>
                    </div>

                    <div className="flex items-center justify-between pt-2 border-t border-slate-100">
                      <AvailabilityBadge
                        availableSpaces={p.available_spaces}
                        openingTime={p.opening_time}
                        closingTime={p.closing_time}
                        size="small"
                      />
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDirections(p);
                          }}
                          className="p-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs"
                          title="Get Directions"
                        >
                          <Navigation className="w-3.5 h-3.5 text-brand-600" />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectParking(p.id);
                          }}
                          className="px-2.5 py-1 rounded-lg bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold"
                        >
                          Details
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Right Side: Interactive Map View */}
        <div className="lg:col-span-7 sticky top-24">
          <ParkingMap
            parkings={parkings}
            userCoords={coords}
            selectedParkingId={selectedId}
            onSelectParking={onSelectParking}
            height="750px"
          />
        </div>
      </div>

      {/* Filter Modal */}
      <FilterModal
        isOpen={isFilterOpen}
        onClose={() => setIsFilterOpen(false)}
        initialFilters={filters}
        onApply={(newFilters) => setFilters(newFilters)}
      />
    </div>
  );
}
