/**
 * Format duration in milliseconds to MM:SS or HH:MM:SS
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(seconds)}`;
  }
  return `${minutes}:${padZero(seconds)}`;
}

/**
 * Format duration for display in list (shorter format)
 */
export function formatDurationShort(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;

  if (hours > 0) {
    return `${hours}:${padZero(minutes)}:${padZero(seconds)}`;
  }
  if (minutes > 0) {
    return `${minutes}:${padZero(seconds)}`;
  }
  return `0:${padZero(seconds)}`;
}

/**
 * Pad a number with leading zero if needed
 */
function padZero(num: number): string {
  return num.toString().padStart(2, '0');
}

/**
 * Format timestamp to relative date string
 */
export function formatRelativeDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);

  const isToday = isSameDay(date, now);
  if (isToday) {
    return formatTime(date);
  }

  const yesterday = new Date(now);
  yesterday.setDate(yesterday.getDate() - 1);
  if (isSameDay(date, yesterday)) {
    return 'Yesterday';
  }

  const oneWeekAgo = new Date(now);
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  if (date > oneWeekAgo) {
    return formatDayOfWeek(date);
  }

  return formatShortDate(date);
}

/**
 * Check if two dates are the same day
 */
function isSameDay(date1: Date, date2: Date): boolean {
  return (
    date1.getFullYear() === date2.getFullYear() &&
    date1.getMonth() === date2.getMonth() &&
    date1.getDate() === date2.getDate()
  );
}

/**
 * Format time as HH:MM AM/PM
 */
function formatTime(date: Date): string {
  const hours = date.getHours();
  const minutes = date.getMinutes();
  const ampm = hours >= 12 ? 'PM' : 'AM';
  const displayHours = hours % 12 || 12;
  return `${displayHours}:${padZero(minutes)} ${ampm}`;
}

/**
 * Format day of week
 */
function formatDayOfWeek(date: Date): string {
  const days = [
    'Sunday',
    'Monday',
    'Tuesday',
    'Wednesday',
    'Thursday',
    'Friday',
    'Saturday',
  ];
  return days[date.getDay()];
}

/**
 * Format short date (e.g., "Dec 10")
 */
function formatShortDate(date: Date): string {
  const months = [
    'Jan',
    'Feb',
    'Mar',
    'Apr',
    'May',
    'Jun',
    'Jul',
    'Aug',
    'Sep',
    'Oct',
    'Nov',
    'Dec',
  ];
  return `${months[date.getMonth()]} ${date.getDate()}`;
}

/**
 * Generate a default name for a new recording
 */
export function generateDefaultName(existingCount: number): string {
  if (existingCount === 0) {
    return 'New Recording';
  }
  return `New Recording ${existingCount + 1}`;
}
