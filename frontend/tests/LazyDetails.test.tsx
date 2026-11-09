import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import { LazyDetails } from "../src/components/LazyDetails";

describe("LazyDetails", () => {
  it("does not build its content while closed", () => {
    const content = vi.fn(() => <p>Panel content</p>);
    render(<LazyDetails summary="Show">{content}</LazyDetails>);

    expect(screen.queryByText("Panel content")).not.toBeInTheDocument();
    expect(content).not.toHaveBeenCalled();
  });

  it("renders its content when opened and removes it when closed", async () => {
    const user = userEvent.setup();
    render(<LazyDetails summary="Show">{() => <p>Panel content</p>}</LazyDetails>);

    await user.click(screen.getByText("Show"));
    await waitFor(() => expect(screen.getByText("Panel content")).toBeInTheDocument());
    expect(screen.getByText("Show").closest("details")).toHaveAttribute("open");

    await user.click(screen.getByText("Show"));
    await waitFor(() => expect(screen.queryByText("Panel content")).not.toBeInTheDocument());
  });

  it("keeps its class and summary for styling", () => {
    render(
      <LazyDetails className="use-case-card__details" summary={<span>Recap</span>}>
        {() => null}
      </LazyDetails>,
    );

    const details = document.querySelector("details");
    expect(details).toHaveClass("use-case-card__details");
    expect(details?.querySelector("summary")).toHaveTextContent("Recap");
  });
});
