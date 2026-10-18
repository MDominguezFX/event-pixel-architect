import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { manssoLogo, startLogo } from "@/assets/footer-logos";

describe("portable original footer artwork", () => {
  it.each([
    ["MANSSO TIP", manssoLogo, "PLACEHOLDER_MANSSO"],
    ["START SOLUTION", startLogo, "PLACEHOLDER_START"],
  ])("embeds the unchanged %s PNG without a hosting URL", (_name, url, sha256) => {
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    const bytes = Buffer.from(url.slice("data:image/png;base64,".length), "base64");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
  });
});