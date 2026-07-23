from pathlib import Path

from app.services.library import _title_from_filename, parse_episode
from app.services.sorter import parse_media_filename, safe_name


def test_title_from_filename():
    assert "Demo Movie 2024" in _title_from_filename(Path("Demo.Movie.2024.1080p.mkv"))


def test_parse_episode():
    show, season, ep = parse_episode(Path("/srv/storage/data/media/TVshows/Breaking Bad/Season 01/S01E01.mkv"))
    assert show == "Breaking Bad"
    assert season == 1
    assert ep == 1


def test_sorter_detects_movie():
    parsed = parse_media_filename(Path("/incoming/The.Matrix.1999.1080p.BluRay.x264.mkv"))
    assert parsed["media_type"] == "movie"
    assert "Matrix" in parsed["title"]
    assert parsed["year"] == "1999"


def test_sorter_detects_show():
    parsed = parse_media_filename(Path("/incoming/Breaking.Bad.S01E01.720p.mkv"))
    assert parsed["media_type"] == "show"
    assert "Breaking Bad" in parsed["title"]
    assert parsed["season"] == 1
    assert parsed["episode"] == 1


def test_safe_name():
    assert "/" not in safe_name('Foo/Bar: Baz?')
