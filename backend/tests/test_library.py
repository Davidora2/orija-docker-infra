# Optional backend unit helpers
from pathlib import Path

from app.services.library import _title_from_filename, parse_episode


def test_title_from_filename():
    assert "Demo Movie 2024" in _title_from_filename(Path("Demo.Movie.2024.1080p.mkv"))


def test_parse_episode():
    show, season, ep = parse_episode(Path("/media/shows/Breaking Bad/S01E01.mkv"))
    assert show == "Breaking Bad"
    assert season == 1
    assert ep == 1
