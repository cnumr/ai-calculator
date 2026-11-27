#!/usr/bin/env python3
"""Tokens Claude consommés sur ce projet entre deux instants, par modèle.

Lit les journaux de session de Claude Code (~/.claude/projects/<projet>/,
sous-agents compris), compte chaque requête une seule fois et affiche la
ligne à ajouter en fin de changeset (voir AGENTS.md).

Usage :
  scripts/claude-usage.py --since 2026-11-09T15:45 [--until 2026-11-09T16:30]
  scripts/claude-usage.py --since ... --csv "Description du travail"
Les dates sans fuseau sont en heure locale. Avec --csv, affiche à la place
les lignes à ajouter à docs/ai-usage.csv, registre des tokens consommés sans
changeset (voir scripts/ai-usage-total.py).
"""

import argparse
import collections
import csv
import json
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path

MODEL_NAMES = {"opus": "Opus", "sonnet": "Sonnet", "haiku": "Haiku", "fable": "Fable"}


def to_utc(value: str) -> datetime:
    moment = datetime.fromisoformat(value.replace("Z", "+00:00"))
    if moment.tzinfo is None:
        moment = moment.astimezone()  # heure locale
    return moment.astimezone(timezone.utc)


def label(model: str) -> str:
    # claude-opus-5-5 -> Claude Opus 5.5
    parts = model.removeprefix("claude-").split("-")
    family = MODEL_NAMES.get(parts[0], parts[0].capitalize())
    return f"Claude {family} {'.'.join(p for p in parts[1:] if p.isdigit())}".strip()


def human(count: int) -> str:
    if count >= 1_000_000:
        return f"{count / 1_000_000:.1f} M".replace(".", ",")
    return f"{round(count / 1000)} k"


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--since", required=True)
    parser.add_argument("--until")
    parser.add_argument("--project", default=str(Path(__file__).resolve().parent.parent))
    parser.add_argument("--csv", metavar="DESCRIPTION", help="lignes pour docs/ai-usage.csv")
    args = parser.parse_args()

    since = to_utc(args.since)
    until = to_utc(args.until) if args.until else datetime.now(timezone.utc)
    logs = Path.home() / ".claude" / "projects" / args.project.replace("/", "-")

    usage: dict[str, collections.Counter] = collections.defaultdict(collections.Counter)
    seen = set()
    for path in logs.glob("**/*.jsonl"):
        for line in path.open(encoding="utf-8"):
            try:
                entry = json.loads(line)
            except json.JSONDecodeError:
                continue
            message = entry.get("message") or {}
            tokens = message.get("usage")
            if entry.get("type") != "assistant" or not tokens or message.get("model") == "<synthetic>":
                continue
            key = (message.get("id"), entry.get("requestId"))
            if key in seen or not since <= to_utc(entry["timestamp"]) < until:
                continue
            seen.add(key)
            counter = usage[message["model"]]
            counter["cache"] += tokens.get("cache_read_input_tokens") or 0
            counter["out"] += tokens.get("output_tokens") or 0
            counter["total"] += sum(
                tokens.get(k) or 0
                for k in ("input_tokens", "cache_creation_input_tokens", "cache_read_input_tokens", "output_tokens")
            )

    if not usage:
        raise SystemExit("Aucune requête Claude trouvée sur cette période.")
    if args.csv:
        author = subprocess.run(
            ["git", "config", "user.name"], capture_output=True, text=True, cwd=args.project
        ).stdout.strip()
        writer = csv.writer(sys.stdout, lineterminator="\n")
        for model, c in sorted(usage.items(), key=lambda item: -item[1]["total"]):
            writer.writerow(
                [until.astimezone().date().isoformat(), author, label(model), c["total"], c["cache"], c["out"], args.csv]
            )
        return
    parts = [
        f"{label(model)} : ≈ {human(c['total'])} tokens (dont {human(c['cache'])} relus en cache, {human(c['out'])} générés)"
        for model, c in sorted(usage.items(), key=lambda item: -item[1]["total"])
    ]
    print(f"_Réalisé avec Claude Code — {' ; '.join(parts)}._")


if __name__ == "__main__":
    main()
