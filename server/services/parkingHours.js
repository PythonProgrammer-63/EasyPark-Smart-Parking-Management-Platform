const PARKING_TIME_ZONE = 'Asia/Kolkata';
const DEFAULT_OPENING_TIME = '07:00';
const DEFAULT_CLOSING_TIME = '23:00';

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

function isValidParkingTime(value) {
  return typeof value === 'string' && parseTime(value) !== undefined;
}

function isParkingOpenNow(openingTime, closingTime, date = new Date()) {
  const opening = parseTime(openingTime, DEFAULT_OPENING_TIME);
  const closing = parseTime(closingTime, DEFAULT_CLOSING_TIME);
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

module.exports = { isParkingOpenNow, isValidParkingTime };
