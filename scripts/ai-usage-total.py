#!/usr/bin/env python3
"""Total des tokens d'IA consommés sur le projet, par modèle.

Source de référence (voir AGENTS.md), indépendante du poste de travail :
  - les changesets en attente (.changeset/*.md) et ceux déjà publiés
    (CHANGELOG.md), via leur ligne « Réalisé avec … » ;
  - le registre docs/ai-usage.csv, pour le travail sans changeset.
Les lignes des changesets sont arrondies (« ≈ 41 k »), celles du registre
exactes.

Usage :
  scripts/ai-usage-total.py            # tableau par modèle
  scripts/ai-usage-total.py --json     # pour un calcul d'impacts
"""

import argparse
import collections
import csv
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
LEDGER = ROOT / "docs" / "ai-usage.csv"

# « Claude Opus 5.5 : ≈ 3,4 M tokens (dont 3,3 M relus en cache, 31 k générés) »
USAGE = re.compile(
    r"(Claude [\w]+ [\d.]+) : ≈ ([\d,]+ [kM]) tokens "
    r"\(dont ([\d,]+ [kM]) relus en cache, ([\d,]+ [kM]) générés\)"
)


def amount(text: str) -> int:
    value, unit = text.split()
    return round(float(value.replace(",", ".")) * (1_000_000 if unit == "M" else 1_000))


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--json", action="store_true")
    args = parser.parse_args()

    totals: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    texts = [*sorted((ROOT / ".changeset").glob("*.md")), ROOT / "CHANGELOG.md"]
    for path in texts:
        if not path.exists():
            continue
        for line in path.read_text(encoding="utf-8").splitlines():
            if "Réalisé avec" not in line:
                continue
            for match in USAGE.finditer(line):
                c = totals[match[1]]
                c["total"] += amount(match[2])
                c["cache"] += amount(match[3])
                c["out"] += amount(match[4])

    with LEDGER.open(encoding="utf-8") as ledger:
        for row in csv.DictReader(ledger):
            c = totals[row["modele"]]
            c["total"] += int(row["tokens"])
            c["cache"] += int(row["cache"])
            c["out"] += int(row["generes"])

    if args.json:
        print(json.dumps({model: dict(c) for model, c in totals.items()}, indent=2))
        return
    print(f"{'Modèle':<18} {'Tokens':>14} {'Relus en cache':>16} {'Générés':>12}")
    for model, c in sorted(totals.items(), key=lambda item: -item[1]["out"]):
        print(f"{model:<18} {c['total']:>14,} {c['cache']:>16,} {c['out']:>12,}".replace(",", " "))


if __name__ == "__main__":
    main()
