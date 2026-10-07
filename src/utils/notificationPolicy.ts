import { AppSettings } from '../store/types';

export function canNotify(settings: AppSettings, date = new Date()): boolean {
  if (!settings.notifications) return false;
  const minutes = (value: string) => {
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
  };
  const start = minutes(settings.quietHoursStart);
  const end = minutes(settings.quietHoursEnd);
  const now = date.getHours() * 60 + date.getMinutes();
  if (start === end) return true;
  return !(start < end ? now >= start && now < end : now >= start || now < end);
}
