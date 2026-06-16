// MisoTicket ABI.
//
// Bytecode is generated from `contracts/MisoTicket.sol` by
// `npm run contracts:compile`.
//
// ABI is hand-written from the Solidity source so runtime code can
// deploy/read without depending on a compiler artifact.

import { type Abi } from "viem";

import { MISO_TICKET_BYTECODE } from "@/lib/thirdweb/contracts/misoTicket.bytecode";

export { MISO_TICKET_BYTECODE };

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
