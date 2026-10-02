/**
 * Timezone Utility for converting recurring schedules between Local and UTC.
 * Uses 1970-01-04 (Sunday) as the reference point.
 */

const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

/**
 * Converts a local recurring day/time to UTC.
 * @param {string} dayOfWeek - e.g. 'Monday'
 * @param {string} time - e.g. '09:00'
 * @returns {object} { dayOfWeek, time } in UTC
 */
export const convertLocalToUTC = (dayOfWeek, time) => {
    if (!dayOfWeek || !time) return { dayOfWeek, time };

    const dayIndex = DAYS.indexOf(dayOfWeek);
    if (dayIndex === -1) return { dayOfWeek, time };

    const [hours, minutes] = time.split(':').map(Number);
    // Create a date in local time
    const date = new Date(1970, 0, 4 + dayIndex, hours, minutes);

    return {
        dayOfWeek: DAYS[date.getUTCDay()],
        time: `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
    };
};

/**
 * Converts a UTC recurring day/time to Local.
 * @param {string} dayOfWeek - e.g. 'Monday'
 * @param {string} time - e.g. '08:00'
 * @returns {object} { dayOfWeek, time } in Local
 */
export const convertUTCToLocal = (dayOfWeek, time) => {
    if (!dayOfWeek || !time) return { dayOfWeek, time };

    const dayIndex = DAYS.indexOf(dayOfWeek);
    if (dayIndex === -1) return { dayOfWeek, time };

    const [hours, minutes] = time.split(':').map(Number);
    // Create a date in UTC
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
        timezone: gmtString
    };
};

/**
 * Formats a Date object to local ISO string without timezone info
 * Helpful for datetime-local inputs
 */
export const toLocalISOString = (date) => {
    if (!date) return '';
    const d = new Date(date);
    const offset = d.getTimezoneOffset() * 60000;
    const localISOTime = (new Date(d - offset)).toISOString().slice(0, 16);
    return localISOTime;
};

/**
 * General display formatter for datetime.
 */
export const formatDisplayDate = (date) => {
    if (!date) return 'N/A';
    return new Date(date).toLocaleString(undefined, {
        year: 'numeric',
        month: 'short',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        timeZoneName: 'short'
    });
};
