import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { MISO_TICKET_BYTECODE } from "@/lib/thirdweb/contracts/misoTicket.bytecode";

const source = readFileSync("contracts/MisoTicket.sol", "utf8");

describe("MisoTicket contract safety guards", () => {
  it("rejects a zero admin in source and bytecode", () => {
    expect(source).toContain('require(admin != address(0), "admin zero");');
    expect(MISO_TICKET_BYTECODE).toContain("61646d696e207a65726f");
  });

  it("sets token URI before safe mint receiver callbacks", () => {
    const uriWrite = source.indexOf("_tokenURIs[tokenId] = uri;");
    const safeMint = source.indexOf("_safeMint(to, tokenId);");

    expect(uriWrite).toBeGreaterThanOrEqual(0);
    expect(safeMint).toBeGreaterThanOrEqual(0);
    expect(uriWrite).toBeLessThan(safeMint);
  });

  it("uses ERC721 receiver checks for admin transfers", () => {
    expect(source).toContain("_safeTransfer(from, to, tokenId);");
    expect(source).not.toContain("_transfer(from, to, tokenId);");
  });
});
