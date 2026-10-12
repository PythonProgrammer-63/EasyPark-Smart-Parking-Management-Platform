import { useEffect, useState } from 'react';

const PARKING_TIME_ZONE = 'Asia/Kolkata';

function parseTime(value, fallback) {
  const time = String(value || fallback).trim();
  if (/^(24\s*hours?|24\/7)$/i.test(time)) return null;
  const match = time.match(/^(\d{1,2}):(\d{2})(?:\s*(AM|PM))?$/i);
  if (!match) return undefined;

  let hour = Number(match[1]);
  const minute = Number(match[2]);
  const meridiem = match[3]?.toUpperCase();
  if (minute > 59 || hour > (meridiem ? 12 : 23) || (meridiem && hour < 1)) return undefined;
  if (meridiem) hour = (hour % 12) + (meridiem === 'PM' ? 12 : 0);
  return hour * 60 + minute;
}

export function isParkingOpenNow(openingTime, closingTime, date = new Date()) {
  const opening = parseTime(openingTime, '07:00');
  const closing = parseTime(closingTime, '23:00');
  if (opening === undefined || closing === undefined || opening === null || closing === null) return true;
  if (opening === closing) return true;

  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: PARKING_TIME_ZONE,
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23'
  }).formatToParts(date);
  const currentMinutes = Number(parts.find((part) => part.type === 'hour').value) * 60
    + Number(parts.find((part) => part.type === 'minute').value);

  return opening < closing
    ? currentMinutes >= opening && currentMinutes < closing
    : currentMinutes >= opening || currentMinutes < closing;
}

export function formatTimeForInput(value, fallback = '07:00') {
  const minutes = parseTime(value, fallback);
  if (minutes === null) return '00:00';
  if (minutes === undefined) return fallback;
  const hour = String(Math.floor(minutes / 60)).padStart(2, '0');
  const minute = String(minutes % 60).padStart(2, '0');
  return `${hour}:${minute}`;
}

export function formatParkingTime(value, fallback = '07:00') {
  const minutes = parseTime(value, fallback);
  if (minutes === null) return '24 Hours';
  if (minutes === undefined) return value || fallback;
  const hour = Math.floor(minutes / 60);
  return `${String(hour % 12 || 12).padStart(2, '0')}:${String(minutes % 60).padStart(2, '0')} ${hour < 12 ? 'AM' : 'PM'}`;
}

export default function useParkingHours(openingTime, closingTime) {
  const [isOpenNow, setIsOpenNow] = useState(() => isParkingOpenNow(openingTime, closingTime));

  useEffect(() => {
    setIsOpenNow(isParkingOpenNow(openingTime, closingTime));
  }, [openingTime, closingTime]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setIsOpenNow(isParkingOpenNow(openingTime, closingTime));
    }, 30_000);
    return () => window.clearInterval(timer);
  }, [openingTime, closingTime]);

  return isOpenNow;
}
