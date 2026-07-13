import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { App } from "../src/App";
import * as apiClient from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return { ...actual, fetchProviders: vi.fn().mockResolvedValue([]) };
});

describe("App", () => {
  it("renders the calculator page at the root route", () => {
    window.history.pushState({}, "", "/");
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the methodology page at /methodologie", () => {
    window.history.pushState({}, "", "/methodologie");
    render(<App />);

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /méthodologie|methodology/i,
    );
  });
});
