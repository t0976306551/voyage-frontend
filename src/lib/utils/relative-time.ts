/**
 * Format an ISO date string as a relative time in Traditional Chinese.
 * - 剛剛 (< 1 min)
 * - N 分鐘前 (< 60 min)
 * - N 小時前 (< 24 h)
 * - N 天前 (< 7 d)
 * - N 週前 (< 30 d)
 * - N 個月前 (>= 30 d)
 */
export function formatRelativeDays(date: string): string {
  const then = new Date(date).getTime();
  if (Number.isNaN(then)) return '';
  const now = Date.now();
  const diffMs = Math.max(0, now - then);
  const sec = Math.floor(diffMs / 1000);
  if (sec < 60) return '剛剛';
  const min = Math.floor(sec / 60);
  if (min < 60) return `${min} 分鐘前`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr} 小時前`;
  const day = Math.floor(hr / 24);
  if (day < 7) return `${day} 天前`;
  const week = Math.floor(day / 7);
  if (day < 30) return `${week} 週前`;
  const month = Math.floor(day / 30);
  return `${month} 個月前`;
}
