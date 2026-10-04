export function toMonthly(amt: number, freq: string): number {
  if (freq === 'monthly')   return amt;
  if (freq === 'quarterly') return amt / 3;
  if (freq === 'yearly')    return amt / 12;
  if (freq === 'weekly')    return amt * 52 / 12;
  return amt;
}

export function fmt(n: number, dp = 0): string {
  return '$' + Math.abs(n).toLocaleString('en-AU', {
    minimumFractionDigits: dp,
    maximumFractionDigits: dp,
  });
}

export function fmtS(n: number): string {
  return (n < 0 ? '-' : '') + fmt(n);
}

export function fmtK(n: number): string {
  const a = Math.abs(n);
  if (a >= 1e6) return (n < 0 ? '-' : '') + '$' + (a / 1e6).toFixed(2) + 'M';
  if (a >= 1000) return (n < 0 ? '-' : '') + '$' + Math.round(a / 1000) + 'k';
  return fmtS(n);
}
