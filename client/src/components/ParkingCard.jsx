import React, { useState } from 'react';
import {
  MapPin,
  Navigation,
  Heart,
  Zap,
  Shield,
  Video,
  Clock,
  Car,
  Star,
  ChevronRight,
  Eye
} from 'lucide-react';
import AvailabilityBadge from './AvailabilityBadge';
import { api } from '../services/api';
import { formatParkingTime } from '../hooks/useParkingHours';

export default function ParkingCard({ parking, onSelect, onToggleFavourite, userCoords }) {
  const [isFav, setIsFav] = useState(parking.is_favourite || false);
  const [favLoading, setFavLoading] = useState(false);

  const handleFavouriteClick = async (e) => {
    e.stopPropagation();
    if (favLoading) return;
    try {
      setFavLoading(true);
      const res = await api.toggleFavourite(parking.id);
      setIsFav(res.is_favourite);
      if (onToggleFavourite) onToggleFavourite(parking.id, res.is_favourite);
    } catch (err) {
      console.error('Favourite error:', err);
    } finally {
      setFavLoading(false);
    }
  };

  const handleDirectionsClick = (e) => {
    e.stopPropagation();
    const destinationName = encodeURIComponent(`${parking.name}, ${parking.area}, ${parking.city}`);
    const mapsUrl = parking.google_maps_url
      || `https://www.google.com/maps/dir/?api=1&destination=${parking.latitude},${parking.longitude}&destination_place_id=${destinationName}`;
    window.open(mapsUrl, '_blank', 'noopener,noreferrer');
  };

  return (
    <div
      onClick={() => onSelect(parking.id)}
      className="group bg-white rounded-2xl border border-slate-200/90 shadow-xs hover:shadow-xl hover:border-brand-300 transition-all duration-200 flex flex-col overflow-hidden cursor-pointer"
    >
      {/* Photo Container & Badges */}
      <div className="relative h-48 w-full overflow-hidden bg-slate-100">
        <img
          src={parking.primary_photo || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=800&q=80'}
          alt={parking.name}
          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
          loading="lazy"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-black/20" />

        {/* Top Badges */}
        <div className="absolute top-3 left-3 flex flex-wrap gap-1.5 items-center">
          <span className="px-2.5 py-1 text-xs font-bold bg-white/95 backdrop-blur-md text-slate-800 rounded-lg shadow-sm">
            {parking.parking_type}
          </span>
          {parking.has_ev_charging ? (
            <span className="px-2 py-1 text-xs font-bold bg-emerald-500/90 text-white rounded-lg shadow-sm flex items-center gap-1 backdrop-blur-xs">
              <Zap className="w-3 h-3 fill-current" />
              <span>EV</span>
            </span>
          ) : null}
        </div>

        {/* Favourite Button */}
        <button
          onClick={handleFavouriteClick}
          disabled={favLoading}
          aria-label="Save to favourites"
          className="absolute top-3 right-3 p-2 rounded-xl bg-white/90 backdrop-blur-md hover:bg-white text-slate-700 shadow-sm transition transform hover:scale-110 active:scale-95"
        >
          <Heart
            className={`w-4 h-4 transition ${
              isFav ? 'fill-red-500 text-red-500' : 'text-slate-600 hover:text-red-500'
            }`}
          />
        </button>

        {/* Bottom Bar on Photo */}
        <div className="absolute bottom-3 left-3 right-3 flex items-center justify-between text-white">
          <AvailabilityBadge
            availableSpaces={parking.available_spaces}
            totalSpaces={parking.total_spaces}
            openingTime={parking.opening_time}
            closingTime={parking.closing_time}
          />
          {parking.distance !== null && parking.distance !== undefined && (
            <span className="px-2 py-0.5 text-xs font-semibold bg-black/60 backdrop-blur-md rounded-md">
              📍 {parking.distance} km away
            </span>
          )}
        </div>
      </div>

      {/* Content Body */}
      <div className="p-4 flex-1 flex flex-col justify-between">
        <div>
          {/* Header & Rating */}
          <div className="flex items-start justify-between gap-2 mb-1.5">
            <h3 className="font-bold text-slate-900 text-base group-hover:text-brand-600 transition leading-snug line-clamp-1">
              {parking.name}
            </h3>
            <div className="flex items-center gap-1 shrink-0 px-2 py-0.5 rounded-lg bg-amber-50 text-amber-800 text-xs font-bold">
              <Star className="w-3.5 h-3.5 fill-amber-400 text-amber-500" />
              <span>{parking.avg_rating > 0 ? parking.avg_rating : 'New'}</span>
            </div>
          </div>

          {/* Address & Landmark */}
          <p className="text-xs text-slate-500 flex items-center gap-1 mb-3 line-clamp-1">
            <MapPin className="w-3.5 h-3.5 text-slate-400 shrink-0" />
            <span>{parking.area}, {parking.city} {parking.landmark ? `• Near ${parking.landmark}` : ''}</span>
          </p>

          {/* Facilities Badges */}
          <div className="flex flex-wrap gap-1.5 mb-4 text-[11px] text-slate-600">
            {parking.is_covered ? (
              <span className="px-2 py-0.5 bg-slate-100 rounded-md">Covered Roof</span>
            ) : (
              <span className="px-2 py-0.5 bg-slate-100 rounded-md">Open Lot</span>
            )}
            {parking.has_cctv ? (
              <span className="px-2 py-0.5 bg-slate-100 rounded-md flex items-center gap-1">
                <Video className="w-3 h-3 text-slate-500" /> CCTV
              </span>
            ) : null}
            {parking.has_security ? (
              <span className="px-2 py-0.5 bg-slate-100 rounded-md flex items-center gap-1">
                <Shield className="w-3 h-3 text-slate-500" /> Security
              </span>
            ) : null}
            <span className="px-2 py-0.5 bg-slate-100 rounded-md flex items-center gap-1">
              <Clock className="w-3 h-3 text-slate-500" /> {formatParkingTime(parking.opening_time, '07:00')} - {formatParkingTime(parking.closing_time, '23:00')}
            </span>
          </div>
        </div>

        {/* Pricing & Actions Footer */}
        <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-2">
          <div>
            <span className="text-[10px] text-slate-400 font-medium uppercase block">Tariff</span>
            {parking.is_free ? (
              <span className="text-sm font-extrabold text-emerald-600">FREE PARKING</span>
            ) : (
              <div className="flex items-baseline gap-1">
                <span className="text-base font-extrabold text-slate-900">₹{parking.hourly_price}</span>
                <span className="text-xs text-slate-500 font-normal">/ hour</span>
              </div>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handleDirectionsClick}
              className="px-2.5 py-2 rounded-xl text-xs font-semibold bg-slate-100 hover:bg-slate-200 text-slate-700 flex items-center gap-1 transition"
              title="Get Directions on Google Maps"
            >
              <Navigation className="w-3.5 h-3.5 text-brand-600" />
              <span className="hidden sm:inline">Directions</span>
            </button>
            <button
              onClick={() => onSelect(parking.id)}
              className="px-3 py-2 rounded-xl text-xs font-bold bg-brand-600 hover:bg-brand-700 text-white flex items-center gap-1 shadow-sm shadow-brand-500/20 transition"
            >
              <span>Details</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
