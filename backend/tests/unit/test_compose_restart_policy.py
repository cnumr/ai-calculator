from pathlib import Path

import yaml

COMPOSE_FILE = Path(__file__).resolve().parents[3] / "docker-compose.yml"
ALLOWED_RESTART_POLICIES = {"always", "unless-stopped"}


def test_every_production_service_restarts_after_host_reboot():
    compose = yaml.safe_load(COMPOSE_FILE.read_text())

    for name, service in compose["services"].items():
        assert service.get("restart") in ALLOWED_RESTART_POLICIES, (
            f"service '{name}' doit définir restart: unless-stopped"
        )
