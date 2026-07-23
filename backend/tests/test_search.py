from app.services.search import acronym, normalize_text, score_title, title_matches


def test_normalize_diacritics():
    assert normalize_text("Shōgun") == "shogun"


def test_score_exact_and_prefix():
    s, reason = score_title("Shōgun", "shogun")
    assert s >= 95 and reason in {"exact", "prefix", "contains", "fuzzy"}
    s2, _ = score_title("Shogun", "sho")
    assert s2 >= 70


def test_fuzzy_typo():
    s, reason = score_title("Inception", "incepton")
    assert s >= 70


def test_acronym():
    from app.services.search import acronyms

    assert "got" in acronyms("Game of Thrones")
    s, reason = score_title("Game of Thrones", "got")
    assert s >= 80 and reason == "acronym"


def test_threshold_helper():
    assert title_matches("The Matrix", "matrix")
    assert not title_matches("Shang-Chi", "shogun")
