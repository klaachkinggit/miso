// Demo marketplace transfer — synthetic signatures only. No real thaw/transfer/refreeze.

export interface MarketplaceTransferResult {
  thaw_signature: string;
  transfer_signature: string;
  refreeze_signature: string;
}

export async function marketplaceTransfer(): Promise<MarketplaceTransferResult> {
  const stamp = Date.now();
  return {
    thaw_signature: `demo_thaw_${stamp}`,
    transfer_signature: `demo_xfer_${stamp}`,
    refreeze_signature: `demo_refreeze_${stamp}`,
  };
}
