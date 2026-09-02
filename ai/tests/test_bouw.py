"""De gebouwde AI-pagina: zelfstandig, met precies de ruimte in het CSP die hij nodig heeft, en niets meer."""
from __future__ import annotations

import base64
import hashlib
import re

import pytest

from conftest import AI, ROOT


@pytest.fixture(scope="session")
def gebouwd(tmp_path_factory):
    import sys
    sys.path.insert(0, str(AI))
    import bouw as bouwer
    return bouwer.bouw(tmp_path_factory.mktemp("ai-dist"))


@pytest.fixture(scope="session")
def html(gebouwd) -> str:
    return gebouwd.read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def kern_js() -> str:
    return (AI / "bron" / "kern.js").read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def ai_js() -> str:
    return (AI / "bron" / "ai.js").read_text(encoding="utf-8")


def hash_van(inhoud: str) -> str:
    return base64.b64encode(hashlib.sha256(inhoud.encode("utf-8")).digest()).decode()


def test_csp(html):
    csp = re.search(r'Content-Security-Policy" content="([^"]+)"', html).group(1)
    assert "default-src 'none'" in csp
    assert "connect-src https: http://localhost:* http://127.0.0.1:*" in csp
    assert "form-action 'none'" in csp and "base-uri 'none'" in csp
    script = re.search(r"<script>(.*)</script>", html, re.S).group(1)
    css = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
    assert f"sha256-{hash_van(script)}" in csp
    assert f"sha256-{hash_van(css)}" in csp


def test_een_script_een_stylesheet_geen_externe(html):
    assert html.count("<script>") == 1 and html.count("<style>") == 1
    assert "<script src" not in html and ' style="' not in html
    verwijzingen = re.findall(r'(?:src|href)="([^"]+)"', html)
    extern = [v for v in verwijzingen if v.startswith("http") and "security-commons-nl" not in v]
    assert extern == [], extern


def test_kern_kent_geen_netwerk(kern_js):
    assert "fetch(" not in kern_js
    assert "new XMLHttpRequest" not in kern_js
    assert "sessionStorage" not in kern_js and "localStorage" not in kern_js


def test_ai_js_bewaart_de_sleutel_alleen_per_sessie(ai_js):
    assert "sessionStorage.setItem" in ai_js
    # localStorage alleen voor de leverancier-id, nooit voor de sleutel.
    for regel in ai_js.splitlines():
        if "localStorage.setItem" in regel:
            assert "LEVERANCIER_OPSLAG" in regel, regel
    assert "console.log" not in ai_js
    assert "apiKey" not in ai_js


def test_ai_js_bevat_geen_prompttekst(ai_js, opdrachten):
    for opdracht in opdrachten["opdrachten"]:
        assert opdracht["systeemprompt"][:40] not in ai_js
    assert opdrachten["vaste_regels"][:40] not in ai_js


def test_opdrachten_zitten_in_de_pagina(html, opdrachten):
    assert '"__OPDRACHTEN__"' not in html
    assert "window.__OPDRACHTEN__ = " in html
    for opdracht in opdrachten["opdrachten"]:
        assert opdracht["titel"] in html
    assert '"tool_vingerafdruk":"' in html


def test_stappen_en_ids(html):
    for stap in ("leverancier", "opdracht", "invoer", "toestemming", "uitvoeren", "voorstel", "verder"):
        assert f'id="stap-{stap}"' in html
    for id_ in ("lev-basis", "lev-model", "lev-sleutel", "knop-verbinding", "knop-sleutel-vergeten",
                "opdracht-keuze", "invoer-tekst", "invoer-bestand", "toestemming", "knop-uitvoeren",
                "knop-stoppen", "voortgang", "tabel-voorstel", "onzeker", "knop-voorstel-opslaan"):
        assert f'id="{id_}"' in html, id_
    assert 'type="password"' in html


def test_kern_js_is_hetzelfde_als_in_de_tool(kern_js):
    """De tool bouwt kern.js mee; het moet hetzelfde bestand zijn, niet een kopie die kan gaan schuiven."""
    import importlib.util
    spec = importlib.util.spec_from_file_location("tool_bouw", ROOT / "instrument" / "bouw.py")
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    assert tool.KERN_JS.resolve() == (AI / "bron" / "kern.js").resolve()
    assert tool.KERN_JS.read_text(encoding="utf-8") == kern_js


def test_herhaalbaar(tmp_path):
    import sys
    sys.path.insert(0, str(AI))
    import bouw as bouwer
    assert bouwer.bouw(tmp_path / "a").read_bytes() == bouwer.bouw(tmp_path / "b").read_bytes()


def test_grootte(gebouwd):
    kb = gebouwd.stat().st_size / 1024
    assert 40 < kb < 400, kb
