import { render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { App } from "../src/App";
import * as apiClient from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return {
    ...actual,
    fetchUseCases: vi.fn().mockResolvedValue({
      providers: [{ id: "openai", selectedByDefault: true }],
      useCases: [
        {
          id: "test",
          providers: [
            {
              providerId: "openai",
              profiles: [
                {
                  id: "eco",
                  impacts: {
                    gwp: { min: 0, max: 0 },
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
    }),
  };
});

describe("App", () => {
  it("renders the calculator page at the root route", async () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    await waitFor(() => {
      expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
    });
  });

  it("renders the methodology page at /methodologie", () => {
    window.history.pushState({}, "", "/methodologie");
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /méthodologie|methodology/i,
    );
  });
});
