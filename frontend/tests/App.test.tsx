import { render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { MemoryRouter } from "react-router-dom";
import "../src/i18n";
import { App } from "../src/App";
import * as apiClient from "../src/api/client";

vi.mock("../src/api/client", async () => {
  const actual = await vi.importActual<typeof apiClient>("../src/api/client");
  return { ...actual, fetchProviders: vi.fn().mockResolvedValue([]) };
});

describe("App", () => {
  it("renders the calculator page at the root route", () => {
    render(
      <MemoryRouter initialEntries={["/"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toBeInTheDocument();
  });

  it("renders the methodology page at /methodologie", () => {
    render(
      <MemoryRouter initialEntries={["/methodologie"]}>
        <App />
      </MemoryRouter>,
    );

    expect(screen.getByRole("heading", { level: 1 })).toHaveTextContent(
      /méthodologie|methodology/i,
    );
  });
});
