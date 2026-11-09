import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
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
            { id: "resolution", options: ["720p", "1080p"], defaultValue: "720p", min: null, max: null },
            { id: "duration_s", options: [5, 8], defaultValue: 8, min: null, max: null },
            { id: "with_audio", options: [true, false], defaultValue: true, min: null, max: null },
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

/** Opens a card's "Customize" menu: its fields only exist once it is open. */
async function openCustomize(user = userEvent.setup()) {
  await user.click(document.querySelector(".use-case-card__customize summary")!);
  await waitFor(() =>
    expect(document.querySelector(".use-case-card__parameters")).not.toBeNull(),
  );
}

describe("UseCaseCard layout", () => {
  it("puts provider, profile and frequency on one row, results below", () => {
    renderEmail();

    const card = document.querySelector<HTMLElement>(".use-case-card")!;
    const selects = card.querySelector(".use-case-card__selects");
    const results = card.querySelector(".use-case-card__results");
    const details = card.querySelector(".use-case-card__details");

    expect(selects).toContainElement(screen.getByLabelText(/fournisseur|provider/i));
    expect(selects).toContainElement(screen.getByLabelText(/profil|profile/i));
    expect(selects).toContainElement(screen.getByLabelText(/fréquence|frequency/i));
    expect(results).toContainElement(
      screen.getByTitle(/gaz à effet de serre|greenhouse gases/i),
    );
    // The selection row comes before the results.
    expect(
      selects!.compareDocumentPosition(results!) & Node.DOCUMENT_POSITION_FOLLOWING,
    ).toBeTruthy();
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

    expect(screen.getByText(/rédaction d'un mail court|writing a short email/i)).toBeInTheDocument();
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

  it("renders the impact details only once their panel is opened", async () => {
    const user = userEvent.setup();
    renderEmail();

    // Closed: no gauge in the DOM (RWEB_0046).
    expect(document.querySelector(".range-gauge")).toBeNull();

    await user.click(screen.getByText(detailsToggle));
    await waitFor(() => expect(document.querySelectorAll(".range-gauge")).toHaveLength(5));

    await user.click(screen.getByText(detailsToggle));
    await waitFor(() => expect(document.querySelector(".range-gauge")).toBeNull());
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

describe("UseCaseCard methodological source", () => {
  const IMAGE: UseCase = {
    id: "image",
    kind: "image",
    source: { id: "unsourced", version: null, url: null },
    providers: [{ providerId: "google", profiles: [{ id: "image" }] }],
  };
  const SOURCED_EMAIL: UseCase = {
    ...EMAIL,
    source: {
      id: "ecologits_llm",
      version: "0.11.3",
      url: "https://ecologits.ai/latest/methodology/llm_inference/",
    },
  };

  it("names EcoLogits, its version and links to its methodology", async () => {
    await i18n.changeLanguage("fr");
    renderEmail({ useCase: SOURCED_EMAIL });

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(
      "Source : EcoLogits 0.11.3, modélisation de l'inférence des LLM.",
    );
    const link = within(note).getByRole("link", { name: /méthodologie/i });
    expect(link).toHaveAttribute(
      "href",
      "https://ecologits.ai/latest/methodology/llm_inference/",
    );
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAccessibleName("Méthodologie (nouvel onglet)");
  });

  it("names the video model of EcoLogits for video use cases", async () => {
    await i18n.changeLanguage("en");
    renderEmail({
      useCase: {
        ...VIDEO,
        source: { id: "ecologits_video", version: "0.11.3", url: "https://ecologits.ai/latest/methodology/video_generation/" },
      },
      availableProviderIds: ["google"],
      providerId: "google",
      profileId: "video",
    });

    expect(screen.getByRole("note")).toHaveTextContent(
      "Source: EcoLogits 0.11.3, video generation model.",
    );
  });

  it("warns that image values have no published source, without a link", async () => {
    await i18n.changeLanguage("fr");
    renderEmail({ useCase: IMAGE, availableProviderIds: ["google"], providerId: "google", profileId: "image" });

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent("Valeur indicative, sans source publiée à ce jour.");
    expect(within(note).queryByRole("link")).not.toBeInTheDocument();
  });

  it("shows no note when the catalogue gives no source", () => {
    renderEmail();

    expect(screen.queryByRole("note")).not.toBeInTheDocument();
  });
});

describe("UseCaseCard provider logo", () => {
  it("shows the selected provider's logo left of its select", async () => {
    const user = userEvent.setup();
    function Interactive() {
      const [state, setState] = useState({
        providerId: "openai",
        profileId: "eco",
        frequencyPerDay: 1,
        parameters: {} as Record<string, ParameterValue>,
      });
      return (
        <UseCaseCard
          useCase={EMAIL}
          availableProviderIds={["openai", "anthropic"]}
          {...state}
          dailyImpacts={DAILY}
          onChange={setState}
        />
      );
    }
    render(<Interactive />);

    const provider = document.querySelector(".use-case-card__provider")!;
    const logo = () => provider.querySelector<HTMLImageElement>(".use-case-card__provider-logo")!;
    // Decorative: the select already names the provider.
    expect(logo()).toHaveAttribute("alt", "");
    expect(logo()).toHaveAttribute("aria-hidden", "true");
    expect(provider.firstElementChild).toBe(logo());
    const openaiLogo = logo().getAttribute("src");

    await user.selectOptions(screen.getByLabelText("Provider"), "anthropic");

    expect(logo().getAttribute("src")).not.toBe(openaiLogo);
  });

  it("shows the provider's initial when it has no logo", () => {
    renderEmail({
      useCase: { ...EMAIL, providers: [{ providerId: "acme", profiles: [{ id: "eco" }] }] },
      availableProviderIds: ["acme"],
      providerId: "acme",
    });

    expect(
      document.querySelector(".use-case-card__provider-logo--fallback"),
    ).toHaveTextContent("A");
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
    await openCustomize();

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
    await openCustomize(user);

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
    // Closed: the fields are not rendered at all (RWEB_0046).
    expect(screen.queryByLabelText("Résolution")).not.toBeInTheDocument();
    const summary = menu!.querySelector("summary");
    expect(summary).toHaveTextContent("Personnaliser : 720p · 8 s · Avec audio");

    await openCustomize(user);
    expect(menu).toContainElement(screen.getByLabelText("Résolution"));
    await user.selectOptions(screen.getByLabelText("Résolution"), "1080p");

    expect(summary).toHaveTextContent("Personnaliser : 1080p · 8 s · Avec audio");
  });

  it("folds the editable token assumption of text profiles into Customize", async () => {
    await i18n.changeLanguage("fr");
    const onChange = vi.fn();
    const user = userEvent.setup();
    function TextCard() {
      const [state, setState] = useState({
        providerId: "openai",
        profileId: "eco",
        frequencyPerDay: 1,
        parameters: {} as Record<string, ParameterValue>,
      });
      return (
        <UseCaseCard
          useCase={{
            ...EMAIL,
            providers: [
              {
                providerId: "openai",
                profiles: [
                  {
                    id: "eco",
                    parameters: [
                      { id: "output_tokens", defaultValue: 1000, options: null, min: 1, max: 10_000_000 },
                    ],
                  },
                ],
              },
            ],
          }}
          availableProviderIds={["openai"]}
          {...state}
          dailyImpacts={DAILY}
          onChange={(next) => {
            setState(next);
            onChange(next.parameters);
          }}
        />
      );
    }
    render(<TextCard />);

    const summary = document.querySelector(".use-case-card__customize summary")!;
    // French groups thousands with U+202F, which toHaveTextContent normalises.
    expect(summary.textContent).toBe("Personnaliser : 1\u202f000 tokens générés");
    await openCustomize(user);
    const tokens = screen.getByLabelText("Tokens générés par action");
    expect(tokens).toHaveValue(1000);
    expect(tokens).toHaveAccessibleDescription(/Valeur par défaut : 1.000 tokens générés/);

    await user.clear(tokens);
    await user.type(tokens, "250");

    expect(onChange).toHaveBeenLastCalledWith({ output_tokens: 250 });
    expect(summary.textContent).toBe("Personnaliser : 250 tokens générés");
  });

  it("shows no parameter select for profiles without parameters", () => {
    renderEmail();

    expect(screen.queryByLabelText("Resolution")).not.toBeInTheDocument();
    expect(document.querySelector(".use-case-card__customize")).not.toBeInTheDocument();
  });
});
