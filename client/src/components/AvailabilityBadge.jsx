import React from 'react';
import useParkingHours, { formatParkingTime } from '../hooks/useParkingHours';

export default function AvailabilityBadge({
  availableSpaces,
  totalSpaces,
  openingTime,
  closingTime,
  size = 'normal'
}) {
  const isOpenNow = useParkingHours(openingTime, closingTime);
  const isLarge = size === 'large';
  const isSmall = size === 'small';
  const padding = isLarge ? 'px-3.5 py-1.5 text-sm' : isSmall ? 'px-2 py-0.5 text-xs' : 'px-2.5 py-1 text-xs';

  if (!isOpenNow) {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-red-50 text-red-700 border border-red-200 ${padding}`}>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        <span>🔴 Closed ({formatParkingTime(openingTime, '07:00')}–{formatParkingTime(closingTime, '23:00')})</span>
      </span>
    );
  }

  if (availableSpaces === 0) {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-red-50 text-red-700 border border-red-200 ${padding}`}>
        <span className="w-2 h-2 rounded-full bg-red-500 animate-pulse"></span>
        <span>🔴 Full (0 spaces)</span>
      </span>
    );
  }

  if (availableSpaces <= 5) {
    return (
      <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-amber-50 text-amber-800 border border-amber-200 ${padding}`}>
        <span className="w-2 h-2 rounded-full bg-amber-500"></span>
        <span>🟠 Limited ({availableSpaces} spaces left)</span>
      </span>
    );
  }

  return (
    <span className={`inline-flex items-center gap-1.5 font-semibold rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 ${padding}`}>
      <span className="w-2 h-2 rounded-full bg-emerald-500"></span>
      <span>🟢 Available ({availableSpaces} spaces)</span>
    </span>
  );
}
