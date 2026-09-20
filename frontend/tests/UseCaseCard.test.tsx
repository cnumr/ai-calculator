import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import i18n from "../src/i18n";
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
        {
          id: "eco",
          impacts: {
            ...ZERO_IMPACTS,
            gwp: { min: 0.001, max: 0.002 },
            water: { min: 0.001, max: 0.002 },
          },
        },
        {
          id: "powerful",
          impacts: {
            ...ZERO_IMPACTS,
            gwp: { min: 0.005, max: 0.008 },
            water: { min: 0.005, max: 0.008 },
          },
        },
      ],
    },
    {
      providerId: "anthropic",
      profiles: [
        {
          id: "eco",
          impacts: {
            ...ZERO_IMPACTS,
            gwp: { min: 0.003, max: 0.004 },
            water: { min: 0.003, max: 0.004 },
          },
        },
      ],
    },
  ],
};

function InteractiveUseCaseCard() {
  const [selection, setSelection] = useState({
    providerId: "openai",
    profileId: "eco",
    frequencyPerDay: 1,
  });

  return (
    <UseCaseCard
      useCase={EMAIL}
      availableProviderIds={["openai", "anthropic"]}
      {...selection}
      onChange={setSelection}
      onImpactsChange={() => {}}
    />
  );
}

function summaryMetric(label: RegExp) {
  const metric = screen
    .getByText(label, { selector: "dt" })
    .closest<HTMLDivElement>("div");
  expect(metric).toBeInTheDocument();
  return metric!;
}

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
      expect.objectContaining({ gwp: { min: 0.001, max: 0.002 } }),
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

    expect(screen.getByText(/min 3\.00 gCO2eq/)).toBeInTheDocument();
    expect(screen.getByText(/max 6\.00 gCO2eq/)).toBeInTheDocument();
  });

  it("shows scaled midpoint GHG and water values without opening details", () => {
    render(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={2}
        onChange={() => {}}
        onImpactsChange={() => {}}
      />,
    );

    const summary = document.querySelector<HTMLDListElement>(
      ".use-case-card__summary",
    );
    expect(summary).toBeInTheDocument();
    expect(
      within(summary!)
        .getByText(/greenhouse gases|gaz à effet de serre/i)
        .closest<HTMLDivElement>("div"),
    ).toHaveTextContent(/3\.00 gCO2eq/);
    expect(
      within(summary!)
        .getByText(/water|eau/i)
        .closest<HTMLDivElement>("div"),
    ).toHaveTextContent(/3\.00 mL/);
    expect(
      screen
        .getByText(/voir\/masquer le détail|show\/hide the impact details/i)
        .closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("updates the visible summary when the frequency changes", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    render(<InteractiveUseCaseCard />);

    await user.clear(screen.getByLabelText("Frequency per day"));
    await user.type(screen.getByLabelText("Frequency per day"), "2");

    expect(summaryMetric(/greenhouse gases/i)).toHaveTextContent(
      "3.00 gCO2eq",
    );
    expect(summaryMetric(/^water$/i)).toHaveTextContent("3.00 mL");
  });

  it("updates the visible summary when the profile changes", async () => {
    await i18n.changeLanguage("fr");
    const user = userEvent.setup();
    render(<InteractiveUseCaseCard />);

    await user.selectOptions(screen.getByLabelText("Profil"), "powerful");

    expect(summaryMetric(/gaz à effet de serre/i)).toHaveTextContent(
      "6.50 gCO2eq",
    );
    expect(summaryMetric(/^eau$/i)).toHaveTextContent("6.50 mL");
  });

  it("updates the visible summary when the provider changes", async () => {
    await i18n.changeLanguage("en");
    const user = userEvent.setup();
    render(<InteractiveUseCaseCard />);

    expect(summaryMetric(/greenhouse gases/i)).toHaveTextContent(
      "1.50 gCO2eq",
    );
    expect(summaryMetric(/^water$/i)).toHaveTextContent("1.50 mL");

    await user.selectOptions(screen.getByLabelText("Provider"), "anthropic");

    expect(summaryMetric(/greenhouse gases/i)).toHaveTextContent(
      "3.50 gCO2eq",
    );
    expect(summaryMetric(/^water$/i)).toHaveTextContent("3.50 mL");
    expect(
      screen
        .getByText(/show\/hide the impact details/i)
        .closest("details"),
    ).not.toHaveAttribute("open");
  });

  it("renders localized summary labels in French and English", async () => {
    await i18n.changeLanguage("fr");
    const { unmount } = render(<InteractiveUseCaseCard />);

    expect(
      screen.getByText("Gaz à effet de serre", { selector: "dt" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Eau", { selector: "dt" })).toBeInTheDocument();

    unmount();
    await i18n.changeLanguage("en");
    render(<InteractiveUseCaseCard />);

    expect(
      screen.getByText("Greenhouse gases", { selector: "dt" }),
    ).toBeInTheDocument();
    expect(screen.getByText("Water", { selector: "dt" })).toBeInTheDocument();
  });

  it("shows unavailable when a card summary metric is null", () => {
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

    const summary = document.querySelector<HTMLDListElement>(
      ".use-case-card__summary",
    );
    expect(summary).toBeInTheDocument();
    expect(
      within(summary!)
        .getByText(/water|eau/i)
        .closest<HTMLDivElement>("div"),
    ).toHaveTextContent(/not available|non disponible/i);
  });

  it("shows a not-available message instead of a gauge for null criteria", async () => {
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

    const details = screen
      .getByText(/voir\/masquer le détail|show\/hide the impact details/i)
      .closest("details");
    expect(details).toBeInTheDocument();
    expect(
      within(details!).getAllByText(/non disponible|not available/i),
    ).toHaveLength(3);
    expect(screen.getByText(/min 370 gCO2eq/)).toBeInTheDocument();
  });
});
