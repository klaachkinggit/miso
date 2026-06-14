import { describe, expect, it } from "vitest";

import {
  DEFAULT_THEME_KEY,
  REQUIRED_THEME_TOKENS,
  THEME_KEYS,
  THEME_PRESETS,
  getTheme,
  isValidThemeKey,
} from "@/lib/organizations/theme";

describe("storefront theme", () => {
  it("resolves known preset keys", () => {
    for (const key of THEME_KEYS) {
      expect(getTheme({ preset: key }).key).toBe(key);
    }
  });

  it("falls back to the default preset on null/undefined/unknown/garbage", () => {
    expect(getTheme(null).key).toBe(DEFAULT_THEME_KEY);
    expect(getTheme(undefined).key).toBe(DEFAULT_THEME_KEY);
    expect(getTheme({}).key).toBe(DEFAULT_THEME_KEY);
    expect(getTheme({ preset: "neon" }).key).toBe(DEFAULT_THEME_KEY);
    expect(getTheme({ preset: 42 }).key).toBe(DEFAULT_THEME_KEY);
    expect(getTheme("ink").key).toBe(DEFAULT_THEME_KEY); // bare string, not the wrapper shape
    expect(getTheme(["ink"]).key).toBe(DEFAULT_THEME_KEY);
    expect(getTheme("{ malformed").key).toBe(DEFAULT_THEME_KEY);
  });

  it("never interpolates arbitrary preset payloads — only the key is read", () => {
    const resolved = getTheme({ preset: "ink", cssVars: { "--background": "0 0% 0%" } });
    expect(resolved).toBe(THEME_PRESETS.ink);
    expect(resolved.cssVars["--background"]).toBe(THEME_PRESETS.ink.cssVars["--background"]);
  });

  it("exposes the expected closed set of keys", () => {
    expect(THEME_KEYS).toEqual(["ink", "aurora", "sunset", "mono"]);
  });

  it("defines every required token var on every preset", () => {
    for (const key of THEME_KEYS) {
      const preset = THEME_PRESETS[key];
      for (const token of REQUIRED_THEME_TOKENS) {
        expect(preset.cssVars[token], `${key} missing ${token}`).toBeTruthy();
      }
    }
  });

  it("carries a fontPair and a valid hero layout per preset", () => {
    const layouts = new Set(["centered", "split", "minimal"]);
    for (const key of THEME_KEYS) {
      const preset = THEME_PRESETS[key];
      expect(preset.fontPair.heading).toBeTruthy();
      expect(preset.fontPair.body).toBeTruthy();
      expect(layouts.has(preset.heroLayout)).toBe(true);
    }
  });

  it("isValidThemeKey accepts known keys and rejects unknown/non-string", () => {
    for (const key of THEME_KEYS) expect(isValidThemeKey(key)).toBe(true);
    expect(isValidThemeKey("neon")).toBe(false);
    expect(isValidThemeKey("")).toBe(false);
    expect(isValidThemeKey(null)).toBe(false);
    expect(isValidThemeKey(undefined)).toBe(false);
    expect(isValidThemeKey(123)).toBe(false);
    expect(isValidThemeKey("toString")).toBe(false); // not an own enumerable preset
  });
});
