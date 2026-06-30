import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/thirdweb/transactions", () => {
  class TransactionRevertError extends Error {
    name = "TransactionRevertError";
    record = { errorMessage: "" };
  }
  class TransactionTimeoutError extends Error {
    name = "TransactionTimeoutError";
    transactionId = "tx_x";
  }
  return {
    TransactionRevertError,
    TransactionTimeoutError,
    waitForTransaction: vi.fn(),
    writeContract: vi.fn(),
  };
});

vi.mock("@/lib/supabase/service", () => ({
  createServiceClient: () => ({}),
}));

import {
  ChainOpInFlightError,
  ChainOpRepairError,
  classifyChainError,
} from "@/lib/chain/ops";
import { TransactionTimeoutError } from "@/lib/thirdweb/transactions";

describe("classifyChainError", () => {
  it("classes ChainOpRepairError as non_compensatable + repair_needed", () => {
    const err = new ChainOpRepairError(
      "op_1",
      "0xtx",
      "post-mine write failed",
    );
    expect(classifyChainError(err)).toEqual({
      kind: "non_compensatable",
      state: "repair_needed",
    });
  });

  it("classes ChainOpInFlightError as non_compensatable + in_flight", () => {
    const err = new ChainOpInFlightError("op_2", "tx_2", new Error("boom"));
    expect(classifyChainError(err)).toEqual({
      kind: "non_compensatable",
      state: "in_flight",
    });
  });

  it("classes TransactionTimeoutError as non_compensatable + in_flight", () => {
    expect(classifyChainError(new TransactionTimeoutError("timeout"))).toEqual({
      kind: "non_compensatable",
      state: "in_flight",
    });
  });

  it("classes plain errors as compensatable", () => {
    expect(classifyChainError(new Error("buyer email missing"))).toEqual({
      kind: "compensatable",
    });
    expect(classifyChainError(null)).toEqual({ kind: "compensatable" });
    expect(classifyChainError(undefined)).toEqual({ kind: "compensatable" });
  });

  it("trusts error.name when cross-realm instanceof would miss", () => {
    const lookalike = new Error("repair");
    lookalike.name = "ChainOpRepairError";
    expect(classifyChainError(lookalike)).toEqual({
      kind: "non_compensatable",
      state: "repair_needed",
    });
  });
});
