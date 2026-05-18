export function resalePlatformFee(amount: number): number {
  const percent = Number(process.env.MISO_RESALE_PLATFORM_FEE_PERCENT ?? "5");
  const fixed = Number(process.env.MISO_RESALE_PLATFORM_FEE_FIXED ?? "0");
  const safePercent = Number.isFinite(percent) ? percent : 0;
  const safeFixed = Number.isFinite(fixed) ? fixed : 0;
  const fee = (amount * safePercent) / 100 + safeFixed;
  return Math.round(fee * 100) / 100;
}
