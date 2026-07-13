import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../src/i18n";
import { Co2Equivalents } from "../src/components/Co2Equivalents";

describe("Co2Equivalents", () => {
  it("renders one equivalence line per entry in the local dataset", () => {
    render(<Co2Equivalents gwpKgCo2eq={2.18} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    expect(screen.getByText(/10.*km/)).toBeInTheDocument();
    expect(screen.getByText(/1.*burger/)).toBeInTheDocument();
    expect(screen.getByText(/109.*heures|109.*hours/)).toBeInTheDocument();
  });
});
