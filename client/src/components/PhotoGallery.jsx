import React, { useState } from 'react';
import { ChevronLeft, ChevronRight, X, Maximize2, Image as ImageIcon } from 'lucide-react';

export default function PhotoGallery({ photos = [], parkingName }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [lightboxOpen, setLightboxOpen] = useState(false);

  const displayPhotos = photos.length > 0 ? photos : [
    {
      id: 1,
      photo_url: 'https://images.unsplash.com/photo-1506521781263-d8422e82f27a?auto=format&fit=crop&w=1200&q=80',
      photo_type: 'entrance',
      caption: 'Main Parking Entrance'
    }
  ];

  const currentPhoto = displayPhotos[activeIndex] || displayPhotos[0];

  const nextPhoto = () => {
    setActiveIndex((prev) => (prev + 1) % displayPhotos.length);
  };

  const prevPhoto = () => {
    setActiveIndex((prev) => (prev - 1 + displayPhotos.length) % displayPhotos.length);
  };

  const getTypeBadge = (type) => {
    const labels = {
      entrance: 'Entrance',
      area: 'Parking Area',
      space: 'Parking Space / EV',
      exit: 'Exit Lane',
      signboard: 'Signboard & Info',
      general: 'Facility View'
    };
    return labels[type] || 'Photo';
  };

  return (
    <div className="space-y-3">
      {/* Featured Photo Banner */}
      <div className="relative h-72 sm:h-96 w-full rounded-3xl overflow-hidden bg-slate-900 shadow-md group">
        <img
          src={currentPhoto.photo_url}
          alt={currentPhoto.caption || parkingName}
          className="w-full h-full object-cover transition duration-300 group-hover:scale-102"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-black/30 pointer-events-none" />

        {/* Top Tag & Zoom */}
        <div className="absolute top-4 left-4 right-4 flex items-center justify-between pointer-events-auto">
          <span className="px-3 py-1 bg-black/60 backdrop-blur-md text-white text-xs font-bold rounded-xl uppercase tracking-wider border border-white/20">
            {getTypeBadge(currentPhoto.photo_type)}
          </span>
          <button
            onClick={() => setLightboxOpen(true)}
            className="p-2.5 bg-black/60 backdrop-blur-md text-white hover:bg-black/80 rounded-xl transition border border-white/20"
            title="Expand photo fullscreen"
          >
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>

        {/* Navigation Arrows */}
        {displayPhotos.length > 1 && (
          <>
            <button
              onClick={prevPhoto}
              className="absolute left-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 backdrop-blur-md text-white hover:bg-black/80 rounded-full transition border border-white/20"
              aria-label="Previous photo"
            >
              <ChevronLeft className="w-5 h-5" />
            </button>
            <button
              onClick={nextPhoto}
              className="absolute right-4 top-1/2 -translate-y-1/2 p-2.5 bg-black/50 backdrop-blur-md text-white hover:bg-black/80 rounded-full transition border border-white/20"
              aria-label="Next photo"
            >
              <ChevronRight className="w-5 h-5" />
            </button>
          </>
        )}

        {/* Bottom Caption */}
        <div className="absolute bottom-4 left-4 right-4 text-white pointer-events-none flex items-center justify-between">
          <p className="text-sm font-semibold truncate max-w-md drop-shadow">
            {currentPhoto.caption || `${parkingName} - ${getTypeBadge(currentPhoto.photo_type)}`}
          </p>
          <span className="text-xs bg-black/50 backdrop-blur-md px-2.5 py-1 rounded-lg">
            {activeIndex + 1} / {displayPhotos.length}
          </span>
        </div>
      </div>

      {/* Thumbnails Strip */}
      {displayPhotos.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
          {displayPhotos.map((p, idx) => (
            <button
              key={p.id || idx}
              onClick={() => setActiveIndex(idx)}
              className={`relative shrink-0 w-20 h-14 rounded-xl overflow-hidden border-2 transition ${
                activeIndex === idx
                  ? 'border-brand-600 ring-2 ring-brand-400/40 scale-105'
                  : 'border-transparent opacity-70 hover:opacity-100'
              }`}
            >
              <img src={p.photo_url} alt="" className="w-full h-full object-cover" />
              <span className="absolute bottom-0 inset-x-0 bg-black/60 text-[9px] text-white text-center py-0.5 truncate px-0.5">
                {getTypeBadge(p.photo_type)}
              </span>
            </button>
          ))}
        </div>
      )}

      {/* Lightbox Modal */}
      {lightboxOpen && (
        <div className="fixed inset-0 z-50 bg-black/95 flex flex-col items-center justify-center p-4">
          <button
            onClick={() => setLightboxOpen(false)}
            className="absolute top-6 right-6 p-3 rounded-full bg-white/10 text-white hover:bg-white/20 transition"
          >
            <X className="w-6 h-6" />
          </button>
          <div className="max-w-4xl max-h-[80vh] w-full flex items-center justify-center relative">
            <img
              src={currentPhoto.photo_url}
              alt=""
              className="max-h-[75vh] w-auto object-contain rounded-2xl shadow-2xl"
            />
          </div>
          <div className="mt-4 text-center text-white">
            <span className="inline-block text-xs uppercase tracking-wider font-bold bg-brand-600 px-3 py-1 rounded-full mb-1">
              {getTypeBadge(currentPhoto.photo_type)}
            </span>
            <p className="text-sm text-slate-300">{currentPhoto.caption}</p>
          </div>
        </div>
      )}
    </div>
  );
}
