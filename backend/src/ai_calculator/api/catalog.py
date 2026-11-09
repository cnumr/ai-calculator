"""The use-case catalogue, loaded once and shared by the API routes.

Loading at import validates the catalogue at startup: an invalid
use_cases.yaml stops the backend instead of failing on the first request.
"""

from ai_calculator.domain.use_cases import Catalog, load_catalog

CATALOG: Catalog = load_catalog()
