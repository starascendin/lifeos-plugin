/**
 * Format a timestamp to a relative date string
 */
export function formatRelativeDate(timestamp: number): string {
  const now = new Date();
  const date = new Date(timestamp);
  const diffMs = now.getTime() - date.getTime();
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) {
    return 'Today';
  } else if (diffDays === 1) {
    return 'Yesterday';
  } else if (diffDays < 7) {
    return `${diffDays} days ago`;
  } else {
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: now.getFullYear() !== date.getFullYear() ? 'numeric' : undefined,
    });
  }
}

/**
 * Format a date string (YYYY-MM-DD) to a display string
 */
export function formatDateDisplay(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  });
}

/**
 * Format a date string (YYYY-MM-DD) to a short display string
 */
export function formatDateShort(dateString: string): string {
  const [year, month, day] = dateString.split('-').map(Number);
  const date = new Date(year, month - 1, day);

  return date.toLocaleDateString('en-US', {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });
}

/**
 * Format a timestamp to a time string
 */
export function formatTime(timestamp: number): string {
  const date = new Date(timestamp);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

/**
 * Get the day of week abbreviation (S, M, T, W, T, F, S)
 */
export function getDayOfWeekAbbrev(date: Date): string {
  const days = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  return days[date.getDay()];
}

/**
 * Get the month name
 */
export function getMonthName(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long' });
}

/**
 * Get the month and year string
 */
export function getMonthYearString(date: Date): string {
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
}

/**
 * Check if a date string is today
 */
export function isToday(dateString: string): boolean {
  const today = new Date();
  const todayString = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;
  return dateString === todayString;
}

/**
 * Get an array of dates for a week containing the given date
 */
export function getWeekDates(centerDate: Date): Date[] {
  const dates: Date[] = [];
  const dayOfWeek = centerDate.getDay();

  // Start from Sunday of the week
  const startOfWeek = new Date(centerDate);
  startOfWeek.setDate(centerDate.getDate() - dayOfWeek);

  for (let i = 0; i < 7; i++) {
    const date = new Date(startOfWeek);
    date.setDate(startOfWeek.getDate() + i);
    dates.push(date);
  }

  return dates;
}

/**
 * Get an array of dates for the current week and surrounding weeks
 */
export function getScrollableDates(centerDate: Date, weeksAround: number = 4): Date[] {
  const dates: Date[] = [];
  const totalDays = (weeksAround * 2 + 1) * 7;
  const startDate = new Date(centerDate);
  startDate.setDate(centerDate.getDate() - weeksAround * 7 - centerDate.getDay());

  for (let i = 0; i < totalDays; i++) {
    const date = new Date(startDate);
    date.setDate(startDate.getDate() + i);
    dates.push(date);
  }

  return dates;
}

/**
 * Format entry count string
 */
export function formatEntryCount(count: number): string {
  if (count === 0) return 'No entries';
  if (count === 1) return '1 entry';
  return `${count} entries`;
}
