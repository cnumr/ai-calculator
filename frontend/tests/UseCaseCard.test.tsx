import { useState } from "react";
import { render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";
import i18n from "../src/i18n";
import { UseCaseCard } from "../src/components/UseCaseCard";
import type { Impacts, ParameterValue, UseCase } from "../src/api/client";

// Tests that need French switch to it explicitly; reset to the jsdom
// default (English) so the language never leaks into the next test.
afterEach(async () => {
  await i18n.changeLanguage("en");
});

const ZERO_RANGE = { min: 0, max: 0 };
const ZERO_IMPACTS: Impacts = {
  gwp: ZERO_RANGE,
  energy: ZERO_RANGE,
  adpe: ZERO_RANGE,
  pe: ZERO_RANGE,
  water: ZERO_RANGE,
};

// Impacts for the day, as computed by the backend (kg CO2eq, L...).
const DAILY: Impacts = {
  ...ZERO_IMPACTS,
  gwp: { min: 0.002, max: 0.004 },
  water: { min: 0.001, max: 0.002 },
};

const EMAIL: UseCase = {
  id: "email",
  kind: "text",
  providers: [
    { providerId: "openai", profiles: [{ id: "eco" }, { id: "powerful" }] },
    { providerId: "anthropic", profiles: [{ id: "eco" }] },
  ],
};

const VIDEO: UseCase = {
  id: "video",
  kind: "video",
  providers: [
    {
      providerId: "google",
      profiles: [
        {
          id: "video",
          parameters: [
            { id: "resolution", options: ["720p", "1080p"], defaultValue: "720p" },
            { id: "duration_s", options: [5, 8], defaultValue: 8 },
            { id: "with_audio", options: [true, false], defaultValue: true },
          ],
        },
      ],
    },
  ],
};

function renderEmail(props: Partial<Parameters<typeof UseCaseCard>[0]> = {}) {
  return render(
    <UseCaseCard
      useCase={EMAIL}
      availableProviderIds={["openai", "anthropic"]}
      providerId="openai"
      profileId="eco"
      frequencyPerDay={1}
      dailyImpacts={DAILY}
      onChange={() => {}}
      {...props}
    />,
  );
}

function summaryMetric(label: RegExp) {
  const summary = document.querySelector<HTMLDListElement>(
    ".use-case-card__summary",
  );
  expect(summary).toBeInTheDocument();
  const metric = within(summary!).getByTitle(label).closest<HTMLDivElement>("div");
  expect(metric).toBeInTheDocument();
  return metric!;
}

const detailsToggle = /voir\/masquer le détail|show\/hide the impact details/i;

describe("UseCaseCard layout", () => {
  it("groups the card into header, main row and details zones", () => {
    renderEmail();

    const card = document.querySelector<HTMLElement>(".use-case-card");
    const header = card?.querySelector(".use-case-card__header");
    const selects = card?.querySelector(".use-case-card__selects");
    const main = card?.querySelector(".use-case-card__main");
    const details = card?.querySelector(".use-case-card__details");

    expect(header).toContainElement(screen.getByLabelText(/fréquence|frequency/i));
    expect(selects).toContainElement(screen.getByLabelText(/fournisseur|provider/i));
    expect(selects).toContainElement(screen.getByLabelText(/profil|profile/i));
    expect(main).toContainElement(
      screen.getByTitle(/gaz à effet de serre|greenhouse gases/i),
    );
    expect(details?.parentElement).toBe(card);
  });

  it("labels the frequency as an average per day, visibly", async () => {
    await i18n.changeLanguage("fr");
    renderEmail();

    const frequency = document.querySelector(".use-case-card__frequency");
    expect(frequency).toHaveTextContent("Fréquence quotidienne moyenne");
    expect(frequency).toHaveTextContent("/jour");
    expect(screen.getByLabelText("Fréquence quotidienne moyenne")).toHaveValue(1);
  });

  it("renders the use case name and its picto", () => {
    renderEmail();

    expect(screen.getByText(/rédaction d'un email|writing an email/i)).toBeInTheDocument();
    expect(screen.getByRole("img", { hidden: true })).toBeInTheDocument();
  });

  it("shows large titled summary icons and smaller untitled detail icons", async () => {
    renderEmail();

    const summary = document.querySelector<HTMLElement>(".use-case-card__summary");
    expect(
      within(summary!).getByTitle(/gaz à effet de serre|greenhouse gases/i),
    ).toHaveClass("use-case-card__summary-icon");
    expect(within(summary!).getByTitle(/eau|water/i)).toHaveClass(
      "use-case-card__summary-icon",
    );

    await userEvent.click(screen.getByText(detailsToggle));

    const detailIcons = document
      .querySelector(".use-case-card__details")!
      .querySelectorAll(".use-case-card__detail-icon");
    expect(detailIcons).toHaveLength(5);
    detailIcons.forEach((icon) => {
      expect(icon).toHaveAttribute("aria-hidden", "true");
      expect(icon).not.toHaveAttribute("title");
    });
  });

  it("renders localized summary labels in French and English", async () => {
    await i18n.changeLanguage("fr");
    const { unmount } = renderEmail();
    const summary = () => document.querySelector<HTMLElement>(".use-case-card__summary")!;

    expect(within(summary()).getByTitle("Gaz à effet de serre")).toBeInTheDocument();
    expect(within(summary()).getByTitle("Eau")).toBeInTheDocument();

    unmount();
    await i18n.changeLanguage("en");
    renderEmail();

    expect(within(summary()).getByTitle("Greenhouse gases")).toBeInTheDocument();
    expect(within(summary()).getByTitle("Water")).toBeInTheDocument();
  });
});

describe("UseCaseCard selection", () => {
  it("only offers profiles available for the currently selected provider", () => {
    renderEmail({ providerId: "anthropic" });

    const options = Array.from(
      screen.getByLabelText(/profil|profile/i).querySelectorAll("option"),
    ).map((o) => o.getAttribute("value"));
    expect(options).toEqual(["eco"]);
  });

  it("names the model behind each profile when it is known", async () => {
    await i18n.changeLanguage("fr");
    const useCase: UseCase = {
      id: "email",
      kind: "text",
      providers: [
        {
          providerId: "openai",
          profiles: [
            { id: "eco", models: ["GPT-4o mini"] },
            { id: "balanced", models: [] },
          ],
        },
      ],
    };
    renderEmail({ useCase, availableProviderIds: ["openai"] });

    const options = Array.from(
      screen.getByLabelText("Profil").querySelectorAll("option"),
    ).map((o) => o.textContent);
    expect(options).toEqual(["Éco (GPT-4o mini)", "Équilibré"]);
  });

  it("states the token assumption of text profiles", async () => {
    await i18n.changeLanguage("fr");
    const useCase: UseCase = {
      id: "email",
      kind: "text",
      providers: [
        { providerId: "openai", profiles: [{ id: "eco", outputTokens: 1000 }] },
        { providerId: "google", profiles: [{ id: "image", outputTokens: null }] },
      ],
    };
    const { rerender } = renderEmail({
      useCase,
      availableProviderIds: ["openai", "google"],
    });

    // French groups thousands with U+202F, which toHaveTextContent normalises.
    expect(document.querySelector(".use-case-card__assumption")?.textContent).toBe(
      "Hypothèse de calcul : 1 000 tokens générés par action",
    );

    rerender(
      <UseCaseCard
        useCase={useCase}
        availableProviderIds={["openai", "google"]}
        providerId="google"
        profileId="image"
        frequencyPerDay={1}
        onChange={() => {}}
      />,
    );

    expect(document.querySelector(".use-case-card__assumption")).toBeNull();
  });

  it("calls onChange with the full card state when the profile changes", async () => {
    const onChange = vi.fn();
    renderEmail({ onChange });

    await userEvent.selectOptions(screen.getByLabelText(/profil|profile/i), "powerful");

    expect(onChange).toHaveBeenCalledWith({
      providerId: "openai",
      profileId: "powerful",
      frequencyPerDay: 1,
      parameters: {},
    });
  });

  it("reports the typed frequency", async () => {
    const onChange = vi.fn();
    renderEmail({ onChange });

    await userEvent.type(screen.getByLabelText("Average daily frequency"), "2");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ frequencyPerDay: 12 }),
    );
  });
});

describe("UseCaseCard impacts (computed by the backend)", () => {
  it("shows the midpoint of the daily GHG and water it receives", async () => {
    await i18n.changeLanguage("en");
    renderEmail();

    // gwp 2-4 g, water 1-2 L -> midpoints 3 g and 1.5 L
    expect(summaryMetric(/greenhouse gases/i)).toHaveTextContent("3.00 g CO2eq");
    expect(summaryMetric(/^water$/i)).toHaveTextContent("1.50 mL");
    expect(screen.getByText(detailsToggle).closest("details")).not.toHaveAttribute(
      "open",
    );
  });

  it("shows the daily min and max in the details", async () => {
    renderEmail();

    await userEvent.click(screen.getByText(detailsToggle));

    expect(screen.getByText(/min 2\.00 g CO2eq/)).toBeInTheDocument();
    expect(screen.getByText(/max 4\.00 g CO2eq/)).toBeInTheDocument();
  });

  it("shows not available for criteria the backend does not measure", async () => {
    renderEmail({
      dailyImpacts: { gwp: { min: 0.37, max: 0.37 }, energy: null, adpe: null, pe: null, water: null },
    });

    expect(summaryMetric(/water|eau/i)).toHaveTextContent(/not available|non disponible/i);

    await userEvent.click(screen.getByText(detailsToggle));
    const details = screen.getByText(detailsToggle).closest("details")!;
    expect(within(details).getAllByText(/non disponible|not available/i)).toHaveLength(4);
    expect(screen.getByText(/min 370 g CO2eq/)).toBeInTheDocument();
  });

  it("shows a placeholder before the first calculation", () => {
    renderEmail({ dailyImpacts: null });

    expect(summaryMetric(/greenhouse gases/i)).toHaveTextContent("…");
    expect(document.querySelector(".use-case-card__details")).toBeNull();
  });

  it("dims the impacts while they do not match the selection yet", () => {
    renderEmail({ pending: true });

    const card = document.querySelector(".use-case-card");
    expect(card).toHaveClass("use-case-card--pending");
    expect(card).toHaveAttribute("aria-busy", "true");
    expect(summaryMetric(/greenhouse gases/i)).toHaveTextContent("3.00 g CO2eq");
  });

  it("is not busy once the impacts are current", () => {
    renderEmail();

    expect(document.querySelector(".use-case-card")).not.toHaveAttribute("aria-busy");
  });
});

describe("UseCaseCard data-source note", () => {
  const IMAGE: UseCase = {
    id: "image",
    kind: "image",
    providers: [{ providerId: "google", profiles: [{ id: "image" }] }],
  };

  it("warns that image values have no published source", async () => {
    await i18n.changeLanguage("fr");
    renderEmail({ useCase: IMAGE, availableProviderIds: ["google"], providerId: "google", profileId: "image" });

    expect(screen.getByRole("note")).toHaveTextContent(
      "Valeur indicative, sans source publiée à ce jour.",
    );
  });

  it("shows no note for use cases computed by EcoLogits", () => {
    renderEmail();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("UseCaseCard model parameters", () => {
  function InteractiveVideoCard({ onChange }: { onChange?: (p: Record<string, ParameterValue>) => void }) {
    const [state, setState] = useState({
      providerId: "google",
      profileId: "video",
      frequencyPerDay: 1,
      parameters: {} as Record<string, ParameterValue>,
    });
    return (
      <UseCaseCard
        useCase={VIDEO}
        availableProviderIds={["google"]}
        {...state}
        dailyImpacts={DAILY}
        onChange={(next) => {
          setState(next);
          onChange?.(next.parameters);
        }}
      />
    );
  }

  it("shows one select per parameter, initialised from the defaults", async () => {
    await i18n.changeLanguage("fr");
    render(<InteractiveVideoCard />);

    expect(screen.getByLabelText("Résolution")).toHaveDisplayValue("720p");
    expect(screen.getByLabelText("Durée")).toHaveDisplayValue("8 s");
    expect(screen.getByLabelText("Audio")).toHaveDisplayValue("Avec audio");
    expect(
      Array.from(screen.getByLabelText("Audio").querySelectorAll("option")).map(
        (o) => o.textContent,
      ),
    ).toEqual(["Avec audio", "Sans audio"]);
  });

  it("reports the chosen parameter values", async () => {
    const onChange = vi.fn();
    const user = userEvent.setup();
    render(<InteractiveVideoCard onChange={onChange} />);

    await user.selectOptions(screen.getByLabelText("Resolution"), "1080p");
    await user.selectOptions(screen.getByLabelText("Duration"), "5 s");
    await user.selectOptions(screen.getByLabelText("Audio"), "Without audio");

    expect(onChange).toHaveBeenLastCalledWith({
      resolution: "1080p",
      duration_s: 5,
      with_audio: false,
    });
  });

  it("folds the parameters into a Customize menu that recalls the values", async () => {
    await i18n.changeLanguage("fr");
    const user = userEvent.setup();
    render(<InteractiveVideoCard />);

    const menu = document.querySelector<HTMLDetailsElement>(".use-case-card__customize");
    expect(menu).not.toBeNull();
    expect(menu!.open).toBe(false);
    expect(menu).toContainElement(screen.getByLabelText("Résolution"));
    const summary = menu!.querySelector("summary");
    expect(summary).toHaveTextContent("Personnaliser : 720p · 8 s · Avec audio");

    await user.selectOptions(screen.getByLabelText("Résolution"), "1080p");

    expect(summary).toHaveTextContent("Personnaliser : 1080p · 8 s · Avec audio");
  });

  it("shows no parameter select for profiles without parameters", () => {
    renderEmail();

    expect(screen.queryByLabelText("Resolution")).not.toBeInTheDocument();
    expect(document.querySelector(".use-case-card__customize")).not.toBeInTheDocument();
  });
});
