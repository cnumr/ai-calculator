import { useState } from "react";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
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

const settingsToggle = /réglages|settings/i;

/**
 * Opens a card's settings panel: provider, profile, parameters, source and
 * impact details only exist once it is open (RWEB_0046).
 */
async function openSettings(user = userEvent.setup()) {
  await user.click(screen.getByRole("button", { name: settingsToggle }));
}

describe("UseCaseCard layout", () => {
  it("keeps frequency and results on the row, the settings in a panel opened on demand", async () => {
    const user = userEvent.setup();
    renderEmail();

    const row = document.querySelector<HTMLElement>(".use-case-card__row")!;
    expect(row).toContainElement(screen.getByLabelText(/fréquence|frequency/i));
    expect(row).toContainElement(screen.getByTitle(/gaz à effet de serre|greenhouse gases/i));
    // Closed: no provider or profile select in the DOM (RWEB_0046).
    const toggle = screen.getByRole("button", { name: settingsToggle });
    expect(toggle).toHaveAttribute("aria-expanded", "false");
    expect(screen.queryByLabelText(/fournisseur|provider/i)).not.toBeInTheDocument();

    await openSettings(user);

    expect(toggle).toHaveAttribute("aria-expanded", "true");
    const panel = document.getElementById(toggle.getAttribute("aria-controls")!);
    expect(panel).toContainElement(screen.getByLabelText(/fournisseur|provider/i));
    expect(panel).toContainElement(screen.getByLabelText(/profil|profile/i));

    await user.click(toggle);
    expect(screen.queryByLabelText(/fournisseur|provider/i)).not.toBeInTheDocument();
  });

  it("recalls the provider and profile on the row, and marks used use cases", async () => {
    await i18n.changeLanguage("en");
    const { rerender } = renderEmail({ frequencyPerDay: 0 });

    expect(document.querySelector(".use-case-card__meta")).toHaveTextContent("OpenAI · Eco");
    expect(document.querySelector(".use-case-card")).toHaveClass("use-case-card--idle");

    rerender(
      <UseCaseCard
        useCase={EMAIL}
        availableProviderIds={["openai", "anthropic"]}
        providerId="openai"
        profileId="eco"
        frequencyPerDay={2}
        dailyImpacts={DAILY}
        onChange={() => {}}
      />,
    );
    expect(document.querySelector(".use-case-card")).toHaveClass("use-case-card--used");
  });

  it("labels the frequency as an average per day, for assistive technologies", async () => {
    await i18n.changeLanguage("fr");
    renderEmail();

    const frequency = document.querySelector(".use-case-card__frequency");
    expect(frequency).toHaveTextContent("Fréquence quotidienne moyenne");
    expect(frequency).toHaveTextContent("/jour");
    expect(screen.getByLabelText("Fréquence quotidienne moyenne")).toHaveValue(1);
  });

  it("renders the use case name and its picto", () => {
    renderEmail();

    expect(
      screen.getByRole("heading", { name: /rédaction d'un mail court|writing a short email/i }),
    ).toBeInTheDocument();
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

    await openSettings();

    const detailIcons = document
      .querySelector(".use-case-card__impacts")!
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
  it("only offers profiles available for the currently selected provider", async () => {
    renderEmail({ providerId: "anthropic" });
    await openSettings();

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
    await openSettings();

    const options = Array.from(
      screen.getByLabelText("Profil").querySelectorAll("option"),
    ).map((o) => o.textContent);
    expect(options).toEqual(["Éco (GPT-4o mini)", "Équilibré"]);
  });

  it("calls onChange with the full card state when the profile changes", async () => {
    const onChange = vi.fn();
    renderEmail({ onChange });
    await openSettings();

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
    expect(document.querySelector(".use-case-card__panel")).toBeNull();
  });

  it("shows the daily min and max in the details", async () => {
    renderEmail();

    await openSettings();

    expect(screen.getByText(/min 2\.00 g CO2eq/)).toBeInTheDocument();
    expect(screen.getByText(/max 4\.00 g CO2eq/)).toBeInTheDocument();
  });

  it("shows not available for criteria the backend does not measure", async () => {
    renderEmail({
      dailyImpacts: { gwp: { min: 0.37, max: 0.37 }, energy: null, adpe: null, pe: null, water: null },
    });

    expect(summaryMetric(/water|eau/i)).toHaveTextContent(/not available|non disponible/i);

    await openSettings();
    const details = document.querySelector<HTMLElement>(".use-case-card__impacts")!;
    expect(within(details).getAllByText(/non disponible|not available/i)).toHaveLength(4);
    expect(screen.getByText(/min 370 g CO2eq/)).toBeInTheDocument();
  });

  it("renders the impact details only once their panel is opened", async () => {
    const user = userEvent.setup();
    renderEmail();

    // Closed: no gauge in the DOM (RWEB_0046).
    expect(document.querySelector(".range-gauge")).toBeNull();

    await openSettings(user);
    await waitFor(() => expect(document.querySelectorAll(".range-gauge")).toHaveLength(5));

    await openSettings(user);
    await waitFor(() => expect(document.querySelector(".range-gauge")).toBeNull());
  });

  it("shows a placeholder before the first calculation", () => {
    renderEmail({ dailyImpacts: null });

    expect(summaryMetric(/greenhouse gases/i)).toHaveTextContent("…");
    expect(document.querySelector(".use-case-card__impacts")).toBeNull();
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
    source: { id: "image_from_video", version: "0.11.3", url: "/methodologie#images" },
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
    await openSettings();

    const note = screen.getByRole("note");
    expect(note).toHaveTextContent(
      "Source : EcoLogits 0.11.3, modélisation de l'inférence des LLM.",
    );
    // With the impact details it justifies.
    expect(screen.getByRole("region", { name: "Détail des impacts par jour" })).toContainElement(note);
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
    await openSettings();

    expect(screen.getByRole("note")).toHaveTextContent(
      "Source: EcoLogits 0.11.3, video generation model.",
    );
  });

  it("explains that image values are transposed from an EcoLogits video", async () => {
    await i18n.changeLanguage("fr");
    render(
      <MemoryRouter>
        <UseCaseCard
          useCase={IMAGE}
          availableProviderIds={["google"]}
          providerId="google"
          profileId="image"
          frequencyPerDay={1}
          dailyImpacts={DAILY}
          onChange={() => {}}
        />
      </MemoryRouter>,
    );
    await openSettings();

    expect(screen.getByRole("note")).toHaveTextContent(
      "Source : transposition depuis la génération vidéo EcoLogits 0.11.3 (Veo 3.1), d'après l'étude « The Hidden Cost of an Image ».",
    );
  });

  it("shows no note when the catalogue gives no source", async () => {
    renderEmail();
    await openSettings();

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
    await openSettings(user);

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

  it.each([
    // The new provider offers the chosen profile: it is kept.
    ["balanced", "balanced"],
    // It does not: the use case's recommended profile is used.
    ["flagship", "balanced"],
  ])("keeps profile %s when changing provider, else the recommended one", async (chosen, expected) => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const useCase: UseCase = {
      id: "email",
      kind: "text",
      recommendedProfileId: "balanced",
      providers: [
        { providerId: "openai", profiles: [{ id: "eco" }, { id: "balanced" }, { id: "flagship" }] },
        { providerId: "mistral", profiles: [{ id: "eco" }, { id: "balanced" }] },
      ],
    };
    render(
      <UseCaseCard
        useCase={useCase}
        availableProviderIds={["openai", "mistral"]}
        providerId="openai"
        profileId={chosen}
        frequencyPerDay={1}
        dailyImpacts={DAILY}
        onChange={onChange}
      />,
    );

    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Provider"), "mistral");

    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ providerId: "mistral", profileId: expected }),
    );
  });

  it("shows the provider's initial when it has no logo", async () => {
    renderEmail({
      useCase: { ...EMAIL, providers: [{ providerId: "acme", profiles: [{ id: "eco" }] }] },
      availableProviderIds: ["acme"],
      providerId: "acme",
    });
    await openSettings();

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
    await openSettings();

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
    await openSettings(user);

    await user.selectOptions(screen.getByLabelText("Resolution"), "1080p");
    await user.selectOptions(screen.getByLabelText("Duration"), "5 s");
    await user.selectOptions(screen.getByLabelText("Audio"), "Without audio");

    expect(onChange).toHaveBeenLastCalledWith({
      resolution: "1080p",
      duration_s: 5,
      with_audio: false,
    });
  });

  it("recalls the parameter values on the row, and renders the fields once opened", async () => {
    await i18n.changeLanguage("fr");
    const user = userEvent.setup();
    render(<InteractiveVideoCard />);

    // Two lines: provider and profile, then the settings.
    const metaLines = () =>
      Array.from(document.querySelectorAll(".use-case-card__meta span")).map((l) => l.textContent);
    expect(metaLines()).toEqual(["Google · Standard", "720p · 8 s · Avec audio"]);
    // Closed: the fields are not rendered at all (RWEB_0046).
    expect(screen.queryByLabelText("Résolution")).not.toBeInTheDocument();

    await openSettings(user);
    await user.selectOptions(screen.getByLabelText("Résolution"), "1080p");

    expect(metaLines()).toEqual(["Google · Standard", "1080p · 8 s · Avec audio"]);
  });

  it("offers the editable token assumption of text profiles in the settings", async () => {
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

    const tokensLine = () => document.querySelectorAll(".use-case-card__meta span")[1];
    // French groups thousands with U+202F, which toHaveTextContent normalises.
    expect(tokensLine().textContent).toBe("1\u202f000 tokens générés");
    await openSettings(user);
    const tokens = screen.getByLabelText("Tokens générés par action");
    expect(tokens).toHaveValue(1000);
    expect(tokens).toHaveAccessibleDescription(/Valeur par défaut : 1.000 tokens générés/);

    await user.clear(tokens);
    await user.type(tokens, "250");

    expect(onChange).toHaveBeenLastCalledWith({ output_tokens: 250 });
    expect(tokensLine().textContent).toBe("250 tokens générés");
  });

  it("orders the settings: provider and profile, customisation, then impact details", async () => {
    await i18n.changeLanguage("fr");
    render(<InteractiveVideoCard />);
    await openSettings();

    const panel = document.querySelector<HTMLElement>(".use-case-card__panel")!;
    const firstRow = panel.querySelector(".use-case-card__selects")!;
    expect(within(firstRow as HTMLElement).getAllByRole("combobox")).toHaveLength(2);
    const sections = within(panel).getAllByRole("region");
    expect(sections.map((section) => section.querySelector("h5")!.textContent)).toEqual([
      "Personnalisation",
      "Détail des impacts par jour",
    ]);
    expect(sections[0]).toContainElement(screen.getByLabelText("Résolution"));
  });

  it("shows no parameter field for profiles without parameters", async () => {
    renderEmail();
    await openSettings();

    // Only the provider and profile selects, no customisation section.
    expect(document.querySelectorAll(".use-case-card__selects .use-case-card__field")).toHaveLength(2);
    expect(screen.queryByRole("heading", { name: /customisation/i })).not.toBeInTheDocument();
  });
});

describe("UseCaseCard image sizes", () => {
  const IMAGE: UseCase = {
    id: "image",
    kind: "image",
    source: { id: "image_from_video", version: "0.11.3", url: "/methodologie#images" },
    providers: [
      {
        providerId: "google",
        profiles: [
          {
            id: "image",
            parameters: [
              { id: "size", options: ["1024x1024", "2048x2048"], defaultValue: "1024x1024", min: null, max: null },
            ],
          },
        ],
      },
    ],
  };

  it("offers the image sizes and links its source to the methodology page", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(
      <MemoryRouter>
        <UseCaseCard
          useCase={IMAGE}
          availableProviderIds={["google"]}
          providerId="google"
          profileId="image"
          frequencyPerDay={1}
          dailyImpacts={DAILY}
          onChange={onChange}
        />
      </MemoryRouter>,
    );

    await openSettings(user);
    // A page of this site: same tab, no "new tab" mention.
    const link = screen.getByRole("link", { name: "Methodology" });
    expect(link).toHaveAttribute("href", "/methodologie#images");
    expect(link).not.toHaveAttribute("target");

    const size = screen.getByLabelText("Size");
    expect(within(size).getAllByRole("option").map((o) => o.textContent)).toEqual([
      "1024 × 1024",
      "2048 × 2048",
    ]);
    await user.selectOptions(size, "2048 × 2048");
    expect(onChange).toHaveBeenLastCalledWith(
      expect.objectContaining({ parameters: { size: "2048x2048" } }),
    );
  });
});
