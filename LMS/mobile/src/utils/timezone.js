const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

export const convertUTCToLocal = (dayOfWeek, time) => {
  if (!dayOfWeek || !time) return { dayOfWeek, time, timezone: '', hhmm: time || '' };

  const dayIndex = DAYS.indexOf(dayOfWeek);
  if (dayIndex === -1) return { dayOfWeek, time, timezone: '', hhmm: time || '' };

  const [hours, minutes] = time.split(':').map(Number);
  const date = new Date(Date.UTC(1970, 0, 4 + dayIndex, hours, minutes));

  const offset = -date.getTimezoneOffset();
  const absOffset = Math.abs(offset);
  const hoursOffset = Math.floor(absOffset / 60);
  const minsOffset = absOffset % 60;
  const sign = offset >= 0 ? '+' : '-';
  const gmtString = `GMT${sign}${hoursOffset.toString().padStart(2, '0')}:${minsOffset.toString().padStart(2, '0')}`;

  const hhmm = `${date.getHours().toString().padStart(2, '0')}:${date.getMinutes().toString().padStart(2, '0')}`;

  return {
    dayOfWeek: DAYS[date.getDay()],
    time: `${hhmm} (${gmtString})`,
    hhmm,
    timezone: gmtString,
  };
};
