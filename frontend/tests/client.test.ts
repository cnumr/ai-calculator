import { afterEach, describe, expect, it, vi } from "vitest";
import { ApiError, fetchUseCases } from "../src/api/client";

describe("fetchUseCases", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("converts snake_case provider_id/selected_by_default to camelCase", async () => {
    const body = {
      providers: [{ id: "openai", selected_by_default: true }],
      use_cases: [
        {
          id: "email",
          providers: [
            {
              provider_id: "openai",
              profiles: [
                {
                  id: "eco",
                  impacts: {
                    gwp: { min: 1, max: 2 },
                    energy: { min: 0, max: 0 },
                    adpe: { min: 0, max: 0 },
                    pe: { min: 0, max: 0 },
                    water: { min: 0, max: 0 },
                  },
                },
              ],
            },
          ],
        },
      ],
    };
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve(body),
      }),
    );

    const catalog = await fetchUseCases();

    expect(catalog.providers).toEqual([
      { id: "openai", selectedByDefault: true },
    ]);
    expect(catalog.useCases[0].providers[0].providerId).toBe("openai");
    expect(catalog.useCases[0].providers[0].profiles[0].impacts.gwp).toEqual({
      min: 1,
      max: 2,
    });
  });

  it("throws ApiError when the response is not ok", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({ ok: false, status: 500 }),
    );

    await expect(fetchUseCases()).rejects.toBeInstanceOf(ApiError);
  });
});
