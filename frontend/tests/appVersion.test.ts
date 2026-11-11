import { describe, expect, it } from "vitest";
import { appVersion } from "../src/appVersion";

describe("appVersion", () => {
  it("returns the package version when no build is given", () => {
    expect(appVersion("0.4.0")).toBe("0.4.0");
  });

  it("ignores an empty or blank build", () => {
    expect(appVersion("0.4.0", "")).toBe("0.4.0");
    expect(appVersion("0.4.0", "  ")).toBe("0.4.0");
  });

  it("appends the commit as build metadata", () => {
    expect(appVersion("0.4.0", "ab12cd3")).toBe("0.4.0+sha.ab12cd3");
  });
});
