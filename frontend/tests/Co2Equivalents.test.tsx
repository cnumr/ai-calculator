import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import "../src/i18n";
import { Co2Equivalents } from "../src/components/Co2Equivalents";

describe("Co2Equivalents", () => {
  it("renders one equivalence line per entry in the local dataset", () => {
    render(<Co2Equivalents gwpKgCo2eq={2.18} />);

    expect(screen.getAllByRole("listitem")).toHaveLength(3);
    // ImpactCO2 factors give 34 streaming hours, 0 smartphone, and 15 km.
    expect(
      screen.getByText(/^34 hours of video streaming$|^34 heures de streaming vidéo$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^0 smartphone$/),
    ).toBeInTheDocument();
    expect(
      screen.getByText(/^15 km by car$|^15 km en voiture$/),
    ).toBeInTheDocument();
  });
});
