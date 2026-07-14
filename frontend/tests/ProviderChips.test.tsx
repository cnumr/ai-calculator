import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { ProviderChips } from "../src/components/ProviderChips";

const PROVIDERS = [
  { id: "openai", selectedByDefault: true },
  { id: "anthropic", selectedByDefault: false },
];

describe("ProviderChips", () => {
  it("reflects selected state via aria-pressed", () => {
    render(
      <ProviderChips
        providers={PROVIDERS}
        selected={new Set(["openai"])}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByRole("button", { name: /openai/i })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
    expect(screen.getByRole("button", { name: /anthropic/i })).toHaveAttribute(
      "aria-pressed",
      "false",
    );
  });

  it("calls onToggle with the provider id when clicked", async () => {
    const onToggle = vi.fn();
    render(
      <ProviderChips
        providers={PROVIDERS}
        selected={new Set(["openai"])}
        onToggle={onToggle}
      />,
    );

    await userEvent.click(screen.getByRole("button", { name: /anthropic/i }));

    expect(onToggle).toHaveBeenCalledWith("anthropic");
  });

  it("shows a textual fallback when a provider has no known logo", () => {
    render(
      <ProviderChips
        providers={[{ id: "unknown_provider", selectedByDefault: false }]}
        selected={new Set()}
        onToggle={() => {}}
      />,
    );

    expect(screen.getByText("U")).toBeInTheDocument();
  });
});
