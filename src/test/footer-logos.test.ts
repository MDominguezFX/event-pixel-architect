import { createHash } from "node:crypto";
import { describe, expect, it } from "vitest";
import { manssoLogo, startLogo } from "@/assets/footer-logos";

describe("portable original footer artwork", () => {
  it.each([
    ["MANSSO TIP", manssoLogo, "791e4bd446712c7bb4a0158536411e2598cab72b9ce9c24a236eb6971ec71393"],
    ["START SOLUTION", startLogo, "3cbc0e9b940b5ff923c49a1c19cccfc417dcd9a07cb52df22b921c133afa8b75"],
  ])("embeds the unchanged %s PNG without a hosting URL", (_name, url, sha256) => {
    expect(url.startsWith("data:image/png;base64,")).toBe(true);
    const bytes = Buffer.from(url.slice("data:image/png;base64,".length), "base64");
    expect(createHash("sha256").update(bytes).digest("hex")).toBe(sha256);
  });
});