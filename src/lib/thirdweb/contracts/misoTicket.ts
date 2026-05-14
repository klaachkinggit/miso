// MisoTicket ABI + typed call-data helpers.
//
// Bytecode is filled in after compiling `contracts/MisoTicket.sol`
// (Foundry / Hardhat) and pasting the resulting hex string into
// `MISO_TICKET_BYTECODE`. Until then, deploy paths will throw at the
// encode step, which is intentional: Phase 5 sets the bytecode.
//
// ABI is hand-written from the Solidity source so we can encode/decode
// without depending on a compiler artifact at runtime.

import {
  type Abi,
  type Address,
  type Hex,
  encodeDeployData,
  encodeFunctionData,
} from "viem";

export const MISO_TICKET_ABI = [
  {
    type: "constructor",
    inputs: [
      { name: "name_", type: "string" },
      { name: "symbol_", type: "string" },
      { name: "admin", type: "address" },
    ],
    stateMutability: "nonpayable",
  },
  {
    type: "function",
    name: "mintTo",
    stateMutability: "nonpayable",
    inputs: [
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
      { name: "uri", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "setAttribute",
    stateMutability: "nonpayable",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "key", type: "string" },
      { name: "value", type: "string" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "adminTransfer",
    stateMutability: "nonpayable",
    inputs: [
      { name: "from", type: "address" },
      { name: "to", type: "address" },
      { name: "tokenId", type: "uint256" },
    ],
    outputs: [],
  },
  {
    type: "function",
    name: "ownerOf",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "address" }],
  },
  {
    type: "function",
    name: "tokenURI",
    stateMutability: "view",
    inputs: [{ name: "tokenId", type: "uint256" }],
    outputs: [{ name: "", type: "string" }],
  },
  {
    type: "function",
    name: "attributes",
    stateMutability: "view",
    inputs: [
      { name: "tokenId", type: "uint256" },
      { name: "key", type: "string" },
    ],
    outputs: [{ name: "", type: "string" }],
  },
] as const satisfies Abi;

// Filled in after `forge build` / `hardhat compile`. Phase 5 deploys.
export const MISO_TICKET_BYTECODE: Hex | "" = "";

function requireBytecode(): Hex {
  if (!MISO_TICKET_BYTECODE) {
    throw new Error(
      "MISO_TICKET_BYTECODE is empty — compile contracts/MisoTicket.sol and paste the bytecode into src/lib/thirdweb/contracts/misoTicket.ts",
    );
  }
  return MISO_TICKET_BYTECODE;
}

export function encodeMisoTicketDeploy(args: {
  name: string;
  symbol: string;
  admin: Address;
}): Hex {
  return encodeDeployData({
    abi: MISO_TICKET_ABI,
    bytecode: requireBytecode(),
    args: [args.name, args.symbol, args.admin],
  });
}

export function encodeMintTo(args: {
  to: Address;
  tokenId: bigint;
  uri: string;
}): Hex {
  return encodeFunctionData({
    abi: MISO_TICKET_ABI,
    functionName: "mintTo",
    args: [args.to, args.tokenId, args.uri],
  });
}

export function encodeSetAttribute(args: {
  tokenId: bigint;
  key: string;
  value: string;
}): Hex {
  return encodeFunctionData({
    abi: MISO_TICKET_ABI,
    functionName: "setAttribute",
    args: [args.tokenId, args.key, args.value],
  });
}

export function encodeAdminTransfer(args: {
  from: Address;
  to: Address;
  tokenId: bigint;
}): Hex {
  return encodeFunctionData({
    abi: MISO_TICKET_ABI,
    functionName: "adminTransfer",
    args: [args.from, args.to, args.tokenId],
  });
}
