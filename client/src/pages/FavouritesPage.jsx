import React, { useState, useEffect } from 'react';
import { Heart, Trash2, MapPin, Navigation, Star, ChevronRight, Car } from 'lucide-react';
import { api } from '../services/api';
import AvailabilityBadge from '../components/AvailabilityBadge';

export default function FavouritesPage({ onSelectParking, onNavigateSearch }) {
  const [favourites, setFavourites] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchFavourites = async () => {
    try {
      setLoading(true);
      const res = await api.getFavourites();
      setFavourites(res.favourites || []);
    } catch (err) {
      console.error('Fetch favs error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchFavourites();
  }, []);

  const handleRemove = async (parkingId) => {
    try {
      await api.removeFavourite(parkingId);
      setFavourites(prev => prev.filter(f => f.id !== parkingId));
    } catch (err) {
      console.error('Remove fav error:', err);
    }
  };

  const handleDirections = (p) => {
    const destName = encodeURIComponent(`${p.name}, ${p.area}, ${p.city}`);
    const url = `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&destination_place_id=${destName}`;
    window.open(url, '_blank', 'noopener,noreferrer');
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-extrabold text-slate-900 flex items-center gap-2">
            <Heart className="w-6 h-6 text-red-500 fill-red-500" />
            <span>Favourite Parkings</span>
          </h1>
          <p className="text-xs text-slate-500 mt-1">Quick access to your saved parking spots</p>
        </div>
        <span className="text-xs font-bold bg-red-50 text-red-700 px-3 py-1.5 rounded-xl border border-red-200">
          {favourites.length} Saved Locations
        </span>
      </div>

      {loading ? (
        <div className="py-20 text-center text-xs text-slate-400">Loading favourites...</div>
      ) : favourites.length === 0 ? (
        <div className="bg-white rounded-3xl p-12 text-center border border-slate-200 shadow-xs max-w-md mx-auto">
          <div className="w-16 h-16 bg-red-50 text-red-400 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <Heart className="w-8 h-8" />
          </div>
          <h3 className="text-base font-bold text-slate-800 mb-1">No Favourites Saved Yet</h3>
          <p className="text-xs text-slate-500 mb-6">
            Click the heart icon on any parking spot in Search or Map View to save it here.
          </p>
          <button
            onClick={onNavigateSearch}
            className="px-5 py-2.5 bg-brand-600 text-white rounded-xl text-xs font-bold hover:bg-brand-700 transition"
          >
            Explore Parkings
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {favourites.map((p) => (
            <div
              key={p.id}
              onClick={() => onSelectParking(p.id)}
              className="group bg-white rounded-3xl border border-slate-200 shadow-xs hover:shadow-lg transition cursor-pointer overflow-hidden flex flex-col justify-between"
            >
              <div className="relative h-44 w-full bg-slate-100">
                <img
                  src={p.primary_photo || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=600&q=80'}
                  alt={p.name}
                  className="w-full h-full object-cover group-hover:scale-105 transition duration-300"
                />
                <div className="absolute top-3 left-3">
                  <span className="px-2.5 py-1 text-[11px] font-bold bg-white/95 backdrop-blur-md rounded-lg">
                    {p.parking_type}
                  </span>
                </div>
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemove(p.id);
                  }}
                  className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 hover:bg-white text-red-500 shadow-sm transition"
                  title="Remove from favourites"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
                <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
                  <AvailabilityBadge
                    availableSpaces={p.available_spaces}
                    openingTime={p.opening_time}
                    closingTime={p.closing_time}
                    size="small"
                  />
                  <span className="text-xs font-extrabold bg-black/60 backdrop-blur-md px-2 py-0.5 rounded-md">
                    {p.is_free ? 'FREE' : `₹${p.hourly_price}/hr`}
                  </span>
                </div>
              </div>

              <div className="p-4 flex-1 flex flex-col justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 text-sm group-hover:text-brand-600 transition truncate">
                    {p.name}
                  </h3>
                  <p className="text-xs text-slate-500 mt-1 flex items-center gap-1 truncate">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    <span>{p.area}, {p.city}</span>
                  </p>
                </div>

                <div className="mt-4 pt-3 border-t border-slate-100 flex items-center justify-between">
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDirections(p);
                    }}
                    className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold flex items-center gap-1 transition"
                  >
                    <Navigation className="w-3.5 h-3.5 text-brand-600" />
                    <span>Directions</span>
                  </button>

                  <button
                    onClick={() => onSelectParking(p.id)}
                    className="px-3 py-1.5 rounded-xl bg-brand-600 hover:bg-brand-700 text-white text-xs font-bold flex items-center gap-1 shadow-xs transition"
                  >
                    <span>View Details</span>
                    <ChevronRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
