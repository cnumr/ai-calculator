import { createRef } from "react";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import i18n from "../src/i18n";
import GuidedTour, { TOUR_STEPS } from "../src/components/GuidedTour";

/** The tour's targets, as the calculator page marks them. */
function Page() {
  return (
    <div>
      <div data-tour="ecosystem">providers</div>
      <article data-use-case="doc_small">
        <button data-tour="configure">doc configure</button>
      </article>
      <article data-use-case="email">
        <button data-tour="configure">email configure</button>
        <div data-tour="frequency">email frequency</div>
        <button data-tour="impacts">email impacts</button>
      </article>
      <label data-tour="only-used">only used</label>
      {/* No annual total yet: that step falls back under the tour button. */}
      <div data-tour="headcount">headcount</div>
      <button data-tour="reset">reset</button>
    </div>
  );
}

function renderTour(onClose = vi.fn()) {
  const anchor = createRef<HTMLButtonElement>();
  render(
    <MemoryRouter>
      <button ref={anchor}>tour</button>
      <Page />
      <GuidedTour anchor={anchor} onClose={onClose} />
    </MemoryRouter>,
  );
  return onClose;
}

const outlined = () =>
  Array.from(document.querySelectorAll("[data-tour-active]")).map((el) => el.textContent);

beforeEach(async () => {
  await i18n.changeLanguage("fr");
});

describe("GuidedTour", () => {
  it("opens on the first step, named by its progress and title", () => {
    renderTour();

    const dialog = screen.getByRole("dialog", { name: "1 / 8 Votre écosystème IA" });
    expect(dialog).toHaveAccessibleDescription(/fournisseurs autorisés/);
    expect(dialog).toHaveFocus();
    expect(outlined()).toEqual(["providers"]);
    expect(screen.queryByRole("button", { name: "Précédent" })).not.toBeInTheDocument();
  });

  it("goes through the 8 steps on the example use case, then finishes", async () => {
    const user = userEvent.setup();
    const onClose = renderTour();
    const seen: Array<string | null> = [];

    for (let step = 1; step < TOUR_STEPS.length; step += 1) {
      await user.click(screen.getByRole("button", { name: "Suivant" }));
      seen.push(outlined()[0] ?? null);
    }

    expect(seen).toEqual([
      // Card steps: the short email, not the first card.
      "email configure",
      "email frequency",
      "email impacts",
      "only used",
      // Missing target: nothing outlined, the step still shows.
      null,
      "headcount",
      "reset",
    ]);
    expect(screen.getByRole("dialog")).toHaveAccessibleName("8 / 8 Repartir de zéro");
    expect(screen.getByRole("link", { name: "Voir la méthodologie" })).toHaveAttribute(
      "href",
      "/methodologie",
    );

    await user.click(screen.getByRole("button", { name: "Terminer" }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("goes back with Previous", async () => {
    const user = userEvent.setup();
    renderTour();

    await user.click(screen.getByRole("button", { name: "Suivant" }));
    await user.click(screen.getByRole("button", { name: "Précédent" }));

    expect(screen.getByRole("dialog")).toHaveAccessibleName("1 / 8 Votre écosystème IA");
    expect(outlined()).toEqual(["providers"]);
  });

  it("falls back to the first card when the example is not shown", async () => {
    const user = userEvent.setup();
    const anchor = createRef<HTMLButtonElement>();
    render(
      <MemoryRouter>
        <button ref={anchor}>tour</button>
        <div data-tour="ecosystem" />
        <article data-use-case="doc_small">
          <button data-tour="configure">doc configure</button>
        </article>
        <GuidedTour anchor={anchor} onClose={() => {}} />
      </MemoryRouter>,
    );

    await user.click(screen.getByRole("button", { name: "Suivant" }));
    expect(outlined()).toEqual(["doc configure"]);
  });

  it("leaves with Escape or the close button", async () => {
    const user = userEvent.setup();
    const onClose = renderTour();

    await user.keyboard("{Escape}");
    await user.click(screen.getByRole("button", { name: "Quitter la visite" }));

    expect(onClose).toHaveBeenCalledTimes(2);
  });

  it("releases the outlined element once closed", () => {
    const anchor = createRef<HTMLButtonElement>();
    const { rerender } = render(
      <MemoryRouter>
        <button ref={anchor}>tour</button>
        <Page />
        <GuidedTour anchor={anchor} onClose={() => {}} />
      </MemoryRouter>,
    );
    expect(outlined()).toHaveLength(1);

    rerender(
      <MemoryRouter>
        <button ref={anchor}>tour</button>
        <Page />
      </MemoryRouter>,
    );
    expect(outlined()).toHaveLength(0);
  });

  it("speaks English too", async () => {
    await i18n.changeLanguage("en");
    renderTour();

    expect(screen.getByRole("dialog")).toHaveAccessibleName("1 / 8 Your AI ecosystem");
    expect(screen.getByRole("button", { name: "Next" })).toBeInTheDocument();
  });
});
