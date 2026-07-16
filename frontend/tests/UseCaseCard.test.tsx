import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import "../src/i18n";
import { UseCaseCard } from "../src/components/UseCaseCard";
import type { UseCase } from "../src/api/client";

const ZERO_RANGE = { min: 0, max: 0 };
const ZERO_IMPACTS = {
  gwp: ZERO_RANGE,
  energy: ZERO_RANGE,
  adpe: ZERO_RANGE,
  pe: ZERO_RANGE,
  water: ZERO_RANGE,
};

const EMAIL: UseCase = {
  id: "email",
  providers: [
    {
      providerId: "openai",
      profiles: [
        { id: "eco", impacts: { ...ZERO_IMPACTS, gwp: { min: 1, max: 2 } } },
        {
          id: "powerful",
          impacts: { ...ZERO_IMPACTS, gwp: { min: 5, max: 8 } },
        },
      ],
    },
    {
      providerId: "anthropic",
      profiles: [
        { id: "eco", impacts: { ...ZERO_IMPACTS, gwp: { min: 3, max: 4 } } },
      ],
    },
  ],
};

describe("UseCaseCard", () => {
  it("renders the use case name and its picto", () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    expect(
      screen.getByText(/rédaction d'un email|writing an email/i),
    ).toBeInTheDocument();
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });

  it("only offers profiles available for the currently selected provider", () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="anthropic"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    const profileSelect = screen.getByLabelText(/profil|profile/i);
    const options = Array.from(profileSelect.querySelectorAll("option")).map(
      (o) => o.getAttribute("value"),
    );
    expect(options).toEqual(["eco"]);
  });

  it("calls onImpactsChange with the resolved profile impacts on mount", () => {
    const onImpactsChange = vi.fn();
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={onImpactsChange}
      />,
    );

    expect(onImpactsChange).toHaveBeenCalledWith(
      expect.objectContaining({ gwp: { min: 1, max: 2 } }),
    );
  });

  it("calls onChange when the profile select changes", async () => {
    const onChange = vi.fn();
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={onChange}
        onImpactsChange={() => {}}
      />,
    );

    await userEvent.selectOptions(
      screen.getByLabelText(/profil|profile/i),
      "powerful",
    );

    expect(onChange).toHaveBeenCalledWith({
      providerId: "openai",
      profileId: "powerful",
      frequencyPerDay: 1,
    });
  });

  it("shows details for the 5 indicators only after the toggle is opened", async () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    const details = screen
      .getByText(/voir\/masquer le détail|show\/hide the impact details/i)
      .closest("details");
    expect(details).not.toBeNull();
    expect(details).not.toHaveAttribute("open");

    await userEvent.click(
      screen.getByText(
        /voir\/masquer le détail|show\/hide the impact details/i,
      ),
    );

    expect(details).toHaveAttribute("open");
  });

  it("scales the details values by frequencyPerDay", async () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={3}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByText(
        /voir\/masquer le détail|show\/hide the impact details/i,
      ),
    );

    expect(screen.getByText(/min 3\.00 kgCO2eq/)).toBeInTheDocument();
    expect(screen.getByText(/max 6\.00 kgCO2eq/)).toBeInTheDocument();
  });

  it("shows a not-available message instead of a gauge for null criteria", async () => {
    const VIDEO: UseCase = {
      id: "video",
      providers: [
        {
          providerId: "google",
          profiles: [
            {
              id: "video",
              impacts: {
                gwp: { min: 0.37, max: 0.37 },
                energy: null,
                adpe: { min: 0.000008, max: 0.000008 },
                pe: null,
                water: null,
              },
            },
          ],
        },
      ],
    };

    render(
      <UseCaseCard
        useCase={VIDEO}
        availableProviderIds={["google"]}
        providerId="google"
        profileId="video"
        frequencyPerDay={1}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    await userEvent.click(
      screen.getByText(
        /voir\/masquer le détail|show\/hide the impact details/i,
      ),
    );

    expect(screen.getAllByText(/non disponible|not available/i).length).toBe(3);
    expect(screen.getByText(/min 370 gCO2eq/)).toBeInTheDocument();
  });
});
