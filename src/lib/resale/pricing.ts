import { stripeProcessingFeeForBuyerTotal } from "@/lib/payments/pricing";

export function resalePlatformFee(amount: number): number {
  const percent = Number(process.env.MISO_RESALE_PLATFORM_FEE_PERCENT ?? "5");
  const fixed = Number(process.env.MISO_RESALE_PLATFORM_FEE_FIXED ?? "0");
  const safePercent = Number.isFinite(percent) ? percent : 0;
  const safeFixed = Number.isFinite(fixed) ? fixed : 0;
  const fee = (amount * safePercent) / 100 + safeFixed;
  return Math.round(fee * 100) / 100;
}

export function resaleStripeFeeAmount(params: {
  sellerAmount: number;
  platformFeeAmount: number;
  royaltyAmount: number;
}): number {
  return stripeProcessingFeeForBuyerTotal(
    params.sellerAmount + params.platformFeeAmount + params.royaltyAmount,
  );
}

export function resaleRoyaltyAmount(params: {
  sellerAmount: number;
  enabled: boolean;
  bps: number;
}): number {
  if (!params.enabled || params.bps <= 0) return 0;
  const safeBps = Number.isFinite(params.bps)
    ? Math.max(0, Math.min(10_000, params.bps))
    : 0;
  const royalty = (params.sellerAmount * safeBps) / 10_000;
  return Math.round(royalty * 100) / 100;
}
