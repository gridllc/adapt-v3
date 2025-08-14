export function toMmSs(sec: number): string {
  const s = Math.max(0, Math.floor(sec || 0));
  const m = Math.floor(s / 60);
  const r = s % 60;
  return `${m}:${r.toString().padStart(2, '0')}`;
}

export function fromMmSs(str: string): number {
  if (!str) return 0;
  const [m, s] = str.split(':').map(n => parseInt(n, 10));
  if (Number.isFinite(m) && Number.isFinite(s)) return m * 60 + s;
  return 0;
}

export function getStart(step: any): number {
  return Number(step?.start ?? step?.startTime ?? 0);
}

export function getEnd(step: any): number {
  return Number(step?.end ?? step?.endTime ?? 0);
}

export function getDuration(step: any): number {
  const start = getStart(step);
  const end = getEnd(step);
  return Math.max(0, end - start);
}

export function isValidTimeFormat(timeString: string): boolean {
  if (!timeString) return false;
  const timeRegex = /^\d{1,2}:\d{2}$/;
  if (!timeRegex.test(timeString)) return false;
  
  const [m, s] = timeString.split(':').map(n => parseInt(n, 10));
  return Number.isFinite(m) && Number.isFinite(s) && m >= 0 && s >= 0 && s < 60;
} 