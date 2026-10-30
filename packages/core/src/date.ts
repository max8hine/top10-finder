const pad = (n: number) => String(n).padStart(2, '0');

/** Local calendar date as YYYY-MM-DD. */
export const ymd = (d: Date) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const today = () => ymd(new Date());

export const addDays = (day: string, n: number) => {
  const d = new Date(day + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return ymd(d);
};
