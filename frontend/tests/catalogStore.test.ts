import { describe, expect, it, vi } from "vitest";
import * as apiClient from "../src/api/client";
import { loadCatalog } from "../src/api/catalogStore";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return { ...actual, fetchUseCases: vi.fn() };
});

const mockedFetchUseCases = vi.mocked(apiClient.fetchUseCases);
const CATALOG = { providers: [], useCases: [] };

describe("loadCatalog", () => {
  it("fetches the catalogue once and shares it", async () => {
    mockedFetchUseCases.mockResolvedValue(CATALOG);

    const [first, second] = await Promise.all([loadCatalog(), loadCatalog()]);
    const later = await loadCatalog();

    expect(first).toBe(CATALOG);
    expect(second).toBe(CATALOG);
    expect(later).toBe(CATALOG);
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(1);
  });

  it("fetches again after a failure, so that retrying works", async () => {
    mockedFetchUseCases.mockReset();
    mockedFetchUseCases
      .mockRejectedValueOnce(new apiClient.ApiError(500, "boom"))
      .mockResolvedValueOnce(CATALOG);

    await expect(loadCatalog()).rejects.toBeInstanceOf(apiClient.ApiError);
    await expect(loadCatalog()).resolves.toBe(CATALOG);
    expect(mockedFetchUseCases).toHaveBeenCalledTimes(2);
  });
});
