import React, { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Navigation, Compass, Star } from 'lucide-react';
import { isParkingOpenNow } from '../hooks/useParkingHours';

export default function ParkingMap({
  parkings = [],
  userCoords,
  onSelectParking,
  selectedParkingId,
  height = '500px'
}) {
  const mapContainerRef = useRef(null);
  const mapInstanceRef = useRef(null);
  const markersRef = useRef([]);
  const [clock, setClock] = useState(() => Date.now());

  useEffect(() => {
    const timer = window.setInterval(() => setClock(Date.now()), 30_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!mapContainerRef.current) return;

    // Default center
    const centerLat = userCoords?.lat || (parkings[0]?.latitude) || 18.5204;
    const centerLng = userCoords?.lng || (parkings[0]?.longitude) || 73.8567;

    if (!mapInstanceRef.current) {
      const map = L.map(mapContainerRef.current, {
        center: [centerLat, centerLng],
        zoom: 13,
        zoomControl: false
      });

      L.control.zoom({ position: 'bottomright' }).addTo(map);

      // OpenStreetMap tiles
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
        maxZoom: 19,
      }).addTo(map);

      mapInstanceRef.current = map;
    }

    const map = mapInstanceRef.current;

    // Clear previous markers
    markersRef.current.forEach(m => map.removeLayer(m));
    markersRef.current = [];

    // User location marker
    if (userCoords?.lat && userCoords?.lng) {
      const userIcon = L.divIcon({
        className: 'custom-user-marker',
        html: `
          <div style="
            width: 24px;
            height: 24px;
            background: #2563eb;
            border: 3px solid white;
            border-radius: 50%;
            box-shadow: 0 0 0 6px rgba(37, 99, 235, 0.25);
            position: relative;
          ">
          </div>
        `,
        iconSize: [24, 24],
        iconAnchor: [12, 12]
      });

      const userMarker = L.marker([userCoords.lat, userCoords.lng], { icon: userIcon })
        .addTo(map)
        .bindPopup(`
          <div style="font-family: inherit; font-size: 12px; font-weight: bold; color: #1e3a8a;">
            📍 Your Current Location
          </div>
        `);

      markersRef.current.push(userMarker);
    }

    // Parking markers
    parkings.forEach((p) => {
      const parkingOpen = isParkingOpenNow(p.opening_time, p.closing_time, new Date(clock));
      let pinColor = '#10b981'; // Green (Available)
      let statusText = `🟢 ${p.available_spaces} spaces`;
      let statusBg = '#ecfdf5';
      let statusColor = '#047857';

      if (!parkingOpen) {
        pinColor = '#ef4444';
        statusText = `🔴 Closed (${p.opening_time || '07:00'}–${p.closing_time || '23:00'})`;
        statusBg = '#fef2f2';
        statusColor = '#b91c1c';
      } else if (p.available_spaces === 0) {
        pinColor = '#ef4444'; // Red (Full)
        statusText = '🔴 Full (0 spaces)';
        statusBg = '#fef2f2';
        statusColor = '#b91c1c';
      } else if (p.available_spaces <= 5) {
        pinColor = '#f59e0b'; // Amber (Limited)
        statusText = `🟠 Limited (${p.available_spaces} left)`;
        statusBg = '#fffbeb';
        statusColor = '#b45309';
      }

      const isSelected = selectedParkingId === p.id;

      const parkingIcon = L.divIcon({
        className: 'custom-parking-marker',
        html: `
          <div style="
            display: flex;
            align-items: center;
            justify-content: center;
            background: ${pinColor};
            color: white;
            font-weight: 800;
            font-size: 12px;
            width: ${isSelected ? '38px' : '32px'};
            height: ${isSelected ? '38px' : '32px'};
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 2px solid white;
            box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            cursor: pointer;
            transition: all 0.2s;
          ">
            <span style="transform: rotate(45deg); line-height: 1;">P</span>
          </div>
        `,
        iconSize: [32, 32],
        iconAnchor: [16, 32],
        popupAnchor: [0, -32]
      });

      const popupContent = `
        <div style="font-family: inherit; width: 230px; padding: 2px;">
          <img src="${p.primary_photo || 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=400&q=80'}" 
               style="width: 100%; height: 100px; object-fit: cover; border-radius: 8px; margin-bottom: 8px;" />
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
            <span style="font-size: 10px; font-weight: bold; text-transform: uppercase; background: #f1f5f9; padding: 2px 6px; border-radius: 4px; color: #475569;">
              ${p.parking_type}
            </span>
            <span style="font-size: 11px; font-weight: bold; background: ${statusBg}; color: ${statusColor}; padding: 2px 6px; border-radius: 4px;">
              ${statusText}
            </span>
          </div>
          <h4 style="font-size: 13px; font-weight: bold; margin: 0 0 2px 0; color: #0f172a; line-height: 1.2;">
            ${p.name}
          </h4>
          <p style="font-size: 11px; color: #64748b; margin: 0 0 8px 0;">
            📍 ${p.area}, ${p.city}
          </p>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px; border-top: 1px solid #f1f5f9; padding-top: 6px;">
            <span style="font-size: 12px; font-weight: 800; color: #0f172a;">
              ${p.is_free ? 'FREE' : `₹${p.hourly_price}/hr`}
            </span>
            <span style="font-size: 11px; color: #d97706; font-weight: bold;">
              ⭐ ${p.avg_rating > 0 ? p.avg_rating : '4.5'}
            </span>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 6px;">
            <button id="view-btn-${p.id}" style="
              background: #2563eb; color: white; border: none; padding: 6px 8px; border-radius: 6px;
              font-size: 11px; font-weight: bold; cursor: pointer; text-align: center;
            ">
              View Details
            </button>
            <button id="dir-btn-${p.id}" style="
              background: #f1f5f9; color: #1e293b; border: 1px solid #cbd5e1; padding: 6px 8px; border-radius: 6px;
              font-size: 11px; font-weight: bold; cursor: pointer; text-align: center;
            ">
              Directions 🧭
            </button>
          </div>
        </div>
      `;

      const marker = L.marker([p.latitude, p.longitude], { icon: parkingIcon })
        .addTo(map)
        .bindPopup(popupContent);

      marker.on('popupopen', () => {
        const viewBtn = document.getElementById(`view-btn-${p.id}`);
        if (viewBtn) {
          viewBtn.onclick = () => {
            if (onSelectParking) onSelectParking(p.id);
          };
        }
        const dirBtn = document.getElementById(`dir-btn-${p.id}`);
        if (dirBtn) {
          dirBtn.onclick = () => {
            const destinationName = encodeURIComponent(`${p.name}, ${p.area}, ${p.city}`);
            const url = p.google_maps_url
              || `https://www.google.com/maps/dir/?api=1&destination=${p.latitude},${p.longitude}&destination_place_id=${destinationName}`;
            window.open(url, '_blank', 'noopener,noreferrer');
          };
        }
      });

      markersRef.current.push(marker);
    });

    // If parkings exist, fit bounds to include them
    if (parkings.length > 0) {
      const group = new L.featureGroup(markersRef.current);
      map.fitBounds(group.getBounds().pad(0.15));
    }
  }, [parkings, userCoords, selectedParkingId, clock]);

  const handleRecenter = () => {
    if (mapInstanceRef.current && userCoords?.lat && userCoords?.lng) {
      mapInstanceRef.current.setView([userCoords.lat, userCoords.lng], 14, { animate: true });
    }
  };

  return (
    <div className="relative w-full rounded-2xl overflow-hidden shadow-inner border border-slate-200" style={{ height }}>
      <div ref={mapContainerRef} className="w-full h-full z-10" />

      {/* Recenter Button */}
      <button
        onClick={handleRecenter}
        className="absolute top-4 right-4 z-20 px-3 py-2 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-slate-200 text-xs font-bold text-slate-800 hover:bg-slate-50 flex items-center gap-1.5 transition active:scale-95"
      >
        <Compass className="w-4 h-4 text-brand-600 animate-spin-slow" />
        <span>Recenter Location</span>
      </button>

      {/* Map Legend */}
      <div className="absolute bottom-4 left-4 z-20 bg-white/95 backdrop-blur-md px-3 py-2 rounded-xl shadow-lg border border-slate-200 text-[11px] font-semibold text-slate-700 flex items-center gap-3">
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-emerald-500"></span>
          <span>Available</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-amber-500"></span>
          <span>Limited</span>
        </div>
        <div className="flex items-center gap-1">
          <span className="w-2.5 h-2.5 rounded-full bg-red-500"></span>
          <span>Full</span>
        </div>
      </div>
    </div>
  );
}
