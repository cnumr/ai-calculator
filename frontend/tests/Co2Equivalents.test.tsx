import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../src/i18n";
import { Co2Equivalents } from "../src/components/Co2Equivalents";

describe("Co2Equivalents", () => {
  it("renders one equivalence line per entry in the local dataset", () => {
    render(<Co2Equivalents gwpKgCo2eq={2.18} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // Tighten regexes to match exact rendered text: gwpKgCo2eq=2.18 gives counts of 10, 1, 109
    expect(
      screen.getByText(/^10 km by car$|^10 km en voiture$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^1 beef burgers$|^1 burgers au bœuf$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(
        /^109 hours of laptop use$|^109 heures d'utilisation d'un ordinateur portable$/,
      ),
    ).toBeInTheDocument();
  });
});
