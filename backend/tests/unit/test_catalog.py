from ai_calculator.domain.catalog import list_catalog_models


def test_list_catalog_models_includes_known_openai_model():
    models = list_catalog_models()

    assert any(m.provider == "openai" and m.name == "gpt-4o-mini" for m in models)


def test_list_catalog_models_returns_non_empty_list():
    models = list_catalog_models()

    assert len(models) > 0
