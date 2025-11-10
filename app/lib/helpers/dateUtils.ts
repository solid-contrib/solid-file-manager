/**
 * Date utility functions for formatting and processing dates
 */

/**
 * Formats a date to a human-readable relative time string
 * @param date - Date object to format
 * @returns Formatted date string (e.g., "Today", "Yesterday", "2 days ago", "12/25/2023")
 */
export function formatDate(date?: Date): string {
  if (!date) return "";
  const now = new Date();
  const diff = now.getTime() - date.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} weeks ago`;

  return date.toLocaleDateString();
}

