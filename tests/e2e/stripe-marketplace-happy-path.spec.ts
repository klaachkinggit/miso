// Full real-app simulation E2E for the Stripe marketplace.
//
// One test walking every architectural layer except the network and the
// chain mint (both faked via injected SDK + ticket fast-path):
//
//   onboarding link (ensureSellerAccount → Stripe Express account)
//   → account.updated webhook (applyAccountSnapshot RPC, organizer
//      goes live)
//   → primary checkout (reserveTicket, payment row, paymentIntent.create,
//      CHECKOUT_CREATED transition)
//   → payment_intent.succeeded webhook (lease claim, fulfillment
//      fast-path, transfer creation, PAID transition, purchase mirror)
//   → admin manual refund (REFUND_PENDING, prorate-min reversal,
//      Stripe refunds.create, REFUNDED).
//
// Stripe SDK injected via setStripeClientForTest; chain mint short-
// circuited by pre-flipping the ticket to `sold` with a matching
// `original_purchase_id` (fulfillReservedTicket fast-path).
//
// Gated by MISO_E2E_INVARIANTS=1 (needs local Supabase + seed).

import { expect, test } from "@playwright/test";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type Stripe from "stripe";

import {
  setStripeClientForTest,
  resetStripeClientForTest,
} from "@/lib/stripe-marketplace/client";
import {
  createPrimaryCheckout,
  getMarketplacePaymentByPurchase,
} from "@/lib/stripe-marketplace/payments";
import { createOnboardingLink } from "@/lib/stripe-marketplace/seller-accounts";
import { manuallyRefundPayment } from "@/lib/stripe-marketplace/refunds";
import { handleWebhookEvent } from "@/lib/stripe-marketplace/webhook";

const enabled = process.env.MISO_E2E_INVARIANTS === "1";

function sb(): SupabaseClient {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
}

async function profileByEmail(client: SupabaseClient, email: string): Promise<string> {
  const { data } = await client
    .from("profiles")
    .select("id")
    .eq("email", email)
    .single<{ id: string }>();
  if (!data) throw new Error(`seed profile missing: ${email}`);
  return data.id;
}

interface FakeStripeRecorder {
  accountsCreated: Stripe.AccountCreateParams[];
  accountLinksCreated: Stripe.AccountLinkCreateParams[];
  intentsCreated: Stripe.PaymentIntentCreateParams[];
  transfersCreated: Stripe.TransferCreateParams[];
  reversalsCreated: Array<{ transferId: string; amount?: number }>;
  refundsCreated: Stripe.RefundCreateParams[];
}

// Fake Stripe SDK: every method the marketplace code path touches.
// Returns shapes that match the Stripe namespace closely enough for our
// code; recorder lets the test assert the right calls were made.
function fakeStripeClient(args: {
  stripeAccountId: string;
  paymentIntentId: string;
  chargeId: string;
  transferIdPrefix: string;
  refundId: string;
  recorder: FakeStripeRecorder;
}): Stripe {
  let transferCounter = 0;
  let reversalCounter = 0;

  const intent: Partial<Stripe.PaymentIntent> = {
    id: args.paymentIntentId,
    client_secret: `${args.paymentIntentId}_secret_test`,
    status: "requires_payment_method",
    latest_charge: null,
  };

  return {
    accounts: {
      create: async (params: Stripe.AccountCreateParams) => {
        args.recorder.accountsCreated.push(params);
        return {
          id: args.stripeAccountId,
          charges_enabled: false,
          payouts_enabled: false,
          details_submitted: false,
          requirements: { disabled_reason: null, currently_due: [], past_due: [] },
        };
      },
      retrieve: async (_id: string) => {
        // account.updated webhook → seller now ready.
        return {
          id: args.stripeAccountId,
          charges_enabled: true,
          payouts_enabled: true,
          details_submitted: true,
          requirements: { disabled_reason: null, currently_due: [], past_due: [] },
        };
      },
    },
    accountLinks: {
      create: async (params: Stripe.AccountLinkCreateParams) => {
        args.recorder.accountLinksCreated.push(params);
        return {
          url: "https://connect.stripe.com/setup/test-link",
          expires_at: Math.floor(Date.now() / 1000) + 3600,
        };
      },
    },
    paymentIntents: {
      create: async (params: Stripe.PaymentIntentCreateParams) => {
        args.recorder.intentsCreated.push(params);
        return intent;
      },
      retrieve: async () => intent,
    },
    transfers: {
      create: async (params: Stripe.TransferCreateParams) => {
        args.recorder.transfersCreated.push(params);
        return { id: `${args.transferIdPrefix}_${++transferCounter}` };
      },
      createReversal: async (transferId: string, params?: { amount?: number }) => {
        args.recorder.reversalsCreated.push({ transferId, amount: params?.amount });
        return { id: `trr_test_${++reversalCounter}` };
      },
    },
    refunds: {
      create: async (params: Stripe.RefundCreateParams) => {
        args.recorder.refundsCreated.push(params);
        return { id: args.refundId, amount: params.amount ?? 0 };
      },
    },
  } as unknown as Stripe;
}

interface SeedFixtures {
  buyer: string;
  seller: string;
  ticketId: string;
  eventId: string;
  categoryId: string;
  originalOrganizerUserId: string | null;
  originalCategoryPrice: string | number;
  originalCategoryCurrency: string;
}

async function setUpFixtures(client: SupabaseClient): Promise<SeedFixtures> {
  const buyer = await profileByEmail(client, "buyer@miso.local");
  const seller = await profileByEmail(client, "seller@miso.local");

  await client.from("stripe_seller_accounts").delete().eq("user_id", seller);

  const { data: openEvent } = await client
    .from("events")
    .select("id")
    .eq("status", "published")
    .eq("sales_enabled", true)
    .limit(1)
    .maybeSingle<{ id: string }>();
  if (!openEvent) test.skip(true, "no published event with sales open");

  const { data: ticket } = await client
    .from("tickets")
    .select("id, event_id, category_id")
    .eq("status", "available")
    .eq("event_id", openEvent!.id)
    .limit(1)
    .maybeSingle<{ id: string; event_id: string; category_id: string }>();
  if (!ticket) test.skip(true, "no available ticket on a published event");

  const { data: event } = await client
    .from("events")
    .select("organizer_user_id")
    .eq("id", ticket!.event_id)
    .single<{ organizer_user_id: string | null }>();
  const { data: category } = await client
    .from("ticket_categories")
    .select("price, currency")
    .eq("id", ticket!.category_id)
    .single<{ price: string | number; currency: string }>();
  if (!category) throw new Error("category disappeared");

  // Pin event organizer to our seed seller and switch the category to
  // EUR / 100 so createPrimaryCheckout takes the marketplace path.
  await client.from("events").update({ organizer_user_id: seller }).eq("id", ticket!.event_id);
  await client
    .from("ticket_categories")
    .update({ price: 100, currency: "EUR" })
    .eq("id", ticket!.category_id);

  return {
    buyer,
    seller,
    ticketId: ticket!.id,
    eventId: ticket!.event_id,
    categoryId: ticket!.category_id,
    originalOrganizerUserId: event?.organizer_user_id ?? null,
    originalCategoryPrice: category.price,
    originalCategoryCurrency: category.currency,
  };
}

async function tearDownFixtures(client: SupabaseClient, f: SeedFixtures, purchaseId?: string, paymentId?: string) {
  if (paymentId) {
    await client.from("marketplace_transfers").delete().eq("marketplace_payment_id", paymentId);
    await client.from("marketplace_payments").delete().eq("id", paymentId);
  }
  if (purchaseId) await client.from("purchases").delete().eq("id", purchaseId);
  await client.from("stripe_seller_accounts").delete().eq("user_id", f.seller);
  await client
    .from("tickets")
    .update({
      status: "available",
      owner_user_id: null,
      reserved_until: null,
      original_purchase_id: null,
      nft_contract_address: null,
      nft_token_id: null,
      mint_tx_hash: null,
      metadata_uri: null,
      owner_evm_address: null,
    })
    .eq("id", f.ticketId);
  await client
    .from("events")
    .update({ organizer_user_id: f.originalOrganizerUserId })
    .eq("id", f.eventId);
  await client
    .from("ticket_categories")
    .update({ price: f.originalCategoryPrice, currency: f.originalCategoryCurrency })
    .eq("id", f.categoryId);
}

test.describe("Stripe marketplace: full real-app simulation", () => {
  test.skip(!enabled, "Set MISO_E2E_INVARIANTS=1 to run.");

  test("onboarding → account.updated → checkout → succeeded webhook → paid → manual refund", async () => {
    const client = sb();
    const f = await setUpFixtures(client);

    const stripeAccountId = `acct_e2e_${Date.now()}`;
    const paymentIntentId = `pi_e2e_${Date.now()}`;
    const chargeId = `ch_e2e_${Date.now()}`;
    const refundId = `re_e2e_${Date.now()}`;
    const recorder: FakeStripeRecorder = {
      accountsCreated: [],
      accountLinksCreated: [],
      intentsCreated: [],
      transfersCreated: [],
      reversalsCreated: [],
      refundsCreated: [],
    };

    setStripeClientForTest(
      fakeStripeClient({
        stripeAccountId,
        paymentIntentId,
        chargeId,
        transferIdPrefix: "tr_e2e",
        refundId,
        recorder,
      }),
    );

    let purchaseId: string | undefined;
    let paymentId: string | undefined;

    try {
      // === LAYER 1: Seller onboarding ===
      const link = await createOnboardingLink({
        userId: f.seller,
        email: "seller@miso.local",
        appUrl: "http://localhost:3002",
        returnPath: "/smartboard?tab=banking",
      });
      expect(link.url).toContain("connect.stripe.com");
      expect(link.stripeAccountId).toBe(stripeAccountId);
      expect(recorder.accountsCreated).toHaveLength(1);
      expect(recorder.accountLinksCreated[0].account).toBe(stripeAccountId);

      const { data: pre } = await client
        .from("stripe_seller_accounts")
        .select("charges_enabled, payouts_enabled, seller_risk_status")
        .eq("user_id", f.seller)
        .single<{ charges_enabled: boolean; payouts_enabled: boolean; seller_risk_status: string }>();
      expect(pre!.charges_enabled).toBe(false);
      expect(pre!.payouts_enabled).toBe(false);

      // === LAYER 2: account.updated webhook lifts the seller live ===
      await handleWebhookEvent({
        id: `evt_acct_${Date.now()}`,
        type: "account.updated",
        data: { object: { id: stripeAccountId } },
      } as unknown as Stripe.Event);

      const { data: post } = await client
        .from("stripe_seller_accounts")
        .select("charges_enabled, payouts_enabled, details_submitted, seller_risk_status")
        .eq("user_id", f.seller)
        .single<{
          charges_enabled: boolean;
          payouts_enabled: boolean;
          details_submitted: boolean;
          seller_risk_status: string;
        }>();
      expect(post!.charges_enabled).toBe(true);
      expect(post!.payouts_enabled).toBe(true);
      expect(post!.details_submitted).toBe(true);
      expect(post!.seller_risk_status).toBe("clear");

      // === LAYER 3: Buyer primary checkout ===
      const checkout = await createPrimaryCheckout({
        buyerUserId: f.buyer,
        categoryId: f.categoryId,
      });
      if ("free" in checkout) throw new Error("expected a paid checkout");
      expect(checkout.paymentIntentId).toBe(paymentIntentId);
      expect(checkout.clientSecret).toBe(`${paymentIntentId}_secret_test`);
      expect(checkout.currency).toBe("EUR");
      expect(checkout.amountTotalCents).toBe(10_000);
      paymentId = checkout.marketplacePaymentId;
      expect(recorder.intentsCreated).toHaveLength(1);
      expect(recorder.intentsCreated[0].currency).toBe("eur");
      expect(recorder.intentsCreated[0].amount).toBe(10_000);

      const { data: paymentAfterCheckout } = await client
        .from("marketplace_payments")
        .select("status, purchase_id, stripe_payment_intent_id, primary_seller_cents, marketplace_fee_cents")
        .eq("id", paymentId)
        .single<{
          status: string;
          purchase_id: string;
          stripe_payment_intent_id: string;
          primary_seller_cents: number;
          marketplace_fee_cents: number;
        }>();
      expect(paymentAfterCheckout!.status).toBe("processing");
      expect(paymentAfterCheckout!.stripe_payment_intent_id).toBe(paymentIntentId);
      // 5% fee → 9500 to seller, 500 marketplace fee.
      expect(paymentAfterCheckout!.primary_seller_cents).toBe(9_500);
      expect(paymentAfterCheckout!.marketplace_fee_cents).toBe(500);
      purchaseId = paymentAfterCheckout!.purchase_id;

      const { data: purchaseAfterCheckout } = await client
        .from("purchases")
        .select("ticket_id")
        .eq("id", purchaseId)
        .single<{ ticket_id: string }>();
      expect(purchaseAfterCheckout?.ticket_id).toBeTruthy();
      f.ticketId = purchaseAfterCheckout!.ticket_id;

      const { data: ticketReserved } = await client
        .from("tickets")
        .select("status, owner_user_id")
        .eq("id", f.ticketId)
        .single<{ status: string; owner_user_id: string }>();
      expect(ticketReserved!.status).toBe("reserved");
      expect(ticketReserved!.owner_user_id).toBe(f.buyer);

      // === LAYER 4: Pre-flip ticket to fast-path fulfillReservedTicket ===
      const { data: flippedTicket, error: flipErr } = await client
        .from("tickets")
        .update({
          status: "sold",
          original_purchase_id: purchaseId,
          owner_user_id: f.buyer,
          nft_contract_address: "0x000000000000000000000000000000000000beef",
          nft_token_id: "1",
          mint_tx_hash: "0xabc",
          metadata_uri: "ipfs://stub",
          owner_evm_address: "0x000000000000000000000000000000000000cafe",
        })
        .eq("id", f.ticketId)
        .select("status, original_purchase_id")
        .single<{ status: string; original_purchase_id: string }>();
      if (flipErr) throw new Error(`ticket flip failed: ${flipErr.message}`);
      expect(flippedTicket!.status).toBe("sold");
      expect(flippedTicket!.original_purchase_id).toBe(purchaseId);

      // === LAYER 5: payment_intent.succeeded webhook ===
      try {
        await handleWebhookEvent({
          id: `evt_pi_${Date.now()}`,
          type: "payment_intent.succeeded",
          data: { object: { id: paymentIntentId, latest_charge: chargeId } },
        } as unknown as Stripe.Event);
      } catch (e) {
         
        console.error("[webhook threw]", e instanceof Error ? e.stack : e);
        throw e;
      }

      const { data: paymentAfterPaid } = await client
        .from("marketplace_payments")
        .select("status, stripe_charge_id, succeeded_at, fulfilled_at, transferred_at, failure_reason")
        .eq("id", paymentId)
        .single<{
          status: string;
          stripe_charge_id: string;
          succeeded_at: string;
          fulfilled_at: string;
          transferred_at: string;
          failure_reason: string | null;
        }>();
      if (paymentAfterPaid!.status !== "paid") {
         
        console.error(
          `payment did not reach paid: status=${paymentAfterPaid!.status} reason=${paymentAfterPaid!.failure_reason}`,
        );
      }
      expect(paymentAfterPaid!.status).toBe("paid");
      expect(paymentAfterPaid!.stripe_charge_id).toBe(chargeId);
      expect(paymentAfterPaid!.succeeded_at).not.toBeNull();
      expect(paymentAfterPaid!.fulfilled_at).not.toBeNull();
      expect(paymentAfterPaid!.transferred_at).not.toBeNull();

      // === LAYER 6: transfers row created from connected-account transfer ===
      const { data: transfers } = await client
        .from("marketplace_transfers")
        .select("status, stripe_transfer_id, recipient_role, amount_cents, recipient_user_id")
        .eq("marketplace_payment_id", paymentId);
      expect(transfers).toHaveLength(1);
      expect(transfers![0].status).toBe("created");
      expect(transfers![0].stripe_transfer_id).toMatch(/^tr_e2e_/);
      expect(transfers![0].recipient_role).toBe("organizer");
      expect(transfers![0].recipient_user_id).toBe(f.seller);
      expect(transfers![0].amount_cents).toBe(9_500);
      expect(recorder.transfersCreated).toHaveLength(1);
      expect(recorder.transfersCreated[0].destination).toBe(stripeAccountId);
      expect(recorder.transfersCreated[0].amount).toBe(9_500);
      expect(recorder.transfersCreated[0].currency).toBe("eur");

      // === LAYER 7: legacy purchases row mirrored ===
      const { data: purchaseAfter } = await client
        .from("purchases")
        .select("status, paid_at, provider_payment_id")
        .eq("id", purchaseId)
        .single<{ status: string; paid_at: string; provider_payment_id: string }>();
      expect(purchaseAfter!.status).toBe("paid");
      expect(purchaseAfter!.paid_at).not.toBeNull();
      expect(purchaseAfter!.provider_payment_id).toBe(paymentIntentId);

      // === LAYER 8: idempotent succeeded replay ===
      await handleWebhookEvent({
        id: `evt_pi_replay_${Date.now()}`,
        type: "payment_intent.succeeded",
        data: { object: { id: paymentIntentId, latest_charge: chargeId } },
      } as unknown as Stripe.Event);

      const { data: transfersAfterReplay } = await client
        .from("marketplace_transfers")
        .select("id")
        .eq("marketplace_payment_id", paymentId);
      expect(transfersAfterReplay).toHaveLength(1);

      // === LAYER 9: admin manual refund → REFUND_PENDING → reversal → REFUNDED ===
      const payment = await getMarketplacePaymentByPurchase(purchaseId!);
      expect(payment).not.toBeNull();
      const refundResult = await manuallyRefundPayment({ payment: payment! });
      expect(refundResult.refundId).toBe(refundId);
      // Buyer refund excludes the marketplace fee: 10000 - 500 = 9500.
      expect(refundResult.refundCents).toBe(9_500);
      expect(refundResult.reversedTransferIds).toHaveLength(1);
      expect(recorder.reversalsCreated).toHaveLength(1);
      expect(recorder.reversalsCreated[0].amount).toBe(9_500);
      expect(recorder.refundsCreated).toHaveLength(1);
      expect(recorder.refundsCreated[0].amount).toBe(9_500);
      expect(recorder.refundsCreated[0].refund_application_fee).toBe(false);
      expect(recorder.refundsCreated[0].reverse_transfer).toBe(false);

      const { data: paymentAfterRefund } = await client
        .from("marketplace_payments")
        .select("status, refunded_at")
        .eq("id", paymentId)
        .single<{ status: string; refunded_at: string }>();
      expect(paymentAfterRefund!.status).toBe("refunded");
      expect(paymentAfterRefund!.refunded_at).not.toBeNull();

      const { data: transferAfterReversal } = await client
        .from("marketplace_transfers")
        .select("status, stripe_transfer_reversal_id")
        .eq("marketplace_payment_id", paymentId)
        .single<{ status: string; stripe_transfer_reversal_id: string }>();
      expect(transferAfterReversal!.status).toBe("reversed");
      expect(transferAfterReversal!.stripe_transfer_reversal_id).toMatch(/^trr_test_/);
    } finally {
      resetStripeClientForTest();
      await tearDownFixtures(client, f, purchaseId, paymentId);
    }
  });
});
