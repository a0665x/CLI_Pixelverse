import re
from pathlib import Path


def test_command_deck_density_keeps_readable_type_and_compact_spacing():
    html = Path("public/index.html").read_text(encoding="utf-8")

    deck = re.search(r"/\* Command deck v2 \*/(?P<body>.*?)</style>", html, re.S)
    assert deck
    css = deck.group("body")
    assert "font-size: 13px" in css
    assert "--command-gap: 8px" in css
    assert "--command-panel-padding: 10px" in css
    assert "minmax(520px, 1fr)" in css
    assert "minmax(320px, 1fr)" in css


def test_narrow_command_deck_uses_document_tracks_not_desktop_dimensions():
    html = Path("public/index.html").read_text(encoding="utf-8")
    narrow = re.search(
        r"@media \(max-width: 899px\)\s*\{(?P<body>.*?)\n\s*\}",
        html[html.index("/* Command deck v2 */"):],
        re.S,
    )
    assert narrow
    css = narrow.group("body")
    assert "--command-left-width" not in css
    assert "--command-right-width" not in css
    assert "--command-bottom-height" not in css
    assert "grid-template-columns: minmax(0, 1fr) minmax(0, 1fr)" in css
    assert "grid-template-rows: 44px minmax(320px, 1fr) 164px" in css
