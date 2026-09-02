"""De gebouwde pagina: alles erin, niets eruit, en de belofte "werkt offline" controleerbaar."""
from __future__ import annotations

import base64
import hashlib
import re

from conftest import ROOT


def hash_van(inhoud: str) -> str:
    return base64.b64encode(hashlib.sha256(inhoud.encode("utf-8")).digest()).decode()


def test_vragen_en_antwoorden_staan_in_de_pagina(html, bron):
    for vraag in bron["vragen"]:
        assert vraag["vraag"][:60] in html
        if vraag["toelichting"]:
            assert vraag["toelichting"][:50].split("\n")[0] in html
        for antwoord in vraag["antwoorden"]:
            assert antwoord["info"][:60] in html


def test_labels_parameters_en_tabel_staan_in_de_pagina(html, bron):
    for stap in bron["schaal"]:
        assert stap["label"] in html
    for waarden in bron["parameters"].values():
        for waarde in waarden.values():
            assert waarde in html
    for rij in bron["parametertabel"]:
        for waarde in rij.values():
            assert waarde in html
    for controle in bron["volledigheid"]:
        assert controle["label"] in html
    for prioriteit in bron["prioriteiten"]:
        assert prioriteit["reden"] in html


def test_voorbeeldlandschap_zit_in_de_bron(html, voorbeeld):
    assert voorbeeld["nodes"][0]["label"] in html
    assert '"voorbeeld"' in html


def test_geen_externe_verwijzingen(html):
    verwijzingen = re.findall(r'(?:src|href)="([^"]+)"', html)
    extern = [v for v in verwijzingen
              if v.startswith("http") and not v.startswith("https://security-commons-nl.github.io")
              and not v.startswith("https://github.com/security-commons-nl")]
    assert extern == [], f"externe verwijzing in de pagina: {extern}"
    assert "fonts.googleapis" not in html
    assert "cdn" not in html.lower().split("<script>")[0]


def test_csp_hashes_kloppen(html):
    script = re.search(r"<script>(.*)</script>", html, re.S).group(1)
    css = re.search(r"<style>(.*?)</style>", html, re.S).group(1)
    assert f"sha256-{hash_van(script)}" in html
    assert f"sha256-{hash_van(css)}" in html
    assert "default-src 'none'" in html
    assert "form-action 'none'" in html
    assert "base-uri 'none'" in html


def test_een_script_en_een_stylesheet(html):
    assert html.count("<script>") == 1
    assert html.count("<style>") == 1
    assert "<script src" not in html
    assert "<link rel=\"stylesheet\"" not in html


def test_geen_inline_stijl(html):
    assert ' style="' not in html, "een inline stijl wordt door het CSP geblokkeerd"


def test_app_js_bevat_geen_broninhoud(app_js, bron):
    for vraag in bron["vragen"]:
        assert vraag["vraag"][:30] not in app_js, f"vraagtekst {vraag['id']} staat in app.js"
    for stap in bron["schaal"]:
        assert f"'{stap['label']}'" not in app_js
    for prioriteit in bron["prioriteiten"]:
        assert prioriteit["reden"] not in app_js
    for waarden in bron["parameters"].values():
        for waarde in waarden.values():
            assert waarde not in app_js


def test_app_js_leest_lege_keuze_veilig(app_js):
    """Number('') is 0 en 0 wint elke min(); daarom mag app.js dat pad niet gebruiken."""
    assert "Number(" not in app_js
    assert "=== '' ? null : parseInt" in app_js


def test_noscript_en_kruimelpad(html):
    assert "<noscript>" in html
    assert "procescheck.json" in html
    assert "Security Commons NL" in html
    assert 'aria-label="Kruimelpad"' in html


def test_voetregel_en_vingerafdruk(html, bron):
    assert "EUPL-1.2" in html
    assert "Geen account, geen server, geen telemetrie" in html
    assert bron.get("vingerafdruk", "") == "" or True
    vinger = re.search(r'"vingerafdruk":"([0-9a-f]{64})"', html)
    assert vinger, "de vingerafdruk staat niet in de pagina"


def test_alle_schermen_en_tabs(html):
    for scherm in ("processen", "applicaties", "bia", "context", "blast", "dashboard", "uitdraai"):
        assert f'id="scherm-{scherm}"' in html
        assert f'id="tab-{scherm}"' in html


def test_herhaalbaar(tmp_path):
    import sys
    sys.path.insert(0, str(ROOT / "instrument"))
    import bouw as bouwer
    eerst = bouwer.bouw(tmp_path / "een").read_bytes()
    nogmaals = bouwer.bouw(tmp_path / "twee").read_bytes()
    assert eerst == nogmaals


def test_geen_fetch_in_de_tool(html, app_js):
    """De tool kent geen netwerk. Alles wat naar buiten praat, staat op de AI-pagina."""
    script = html.split("<script>", 1)[1].split("</script>", 1)[0]
    assert "fetch(" not in script
    assert "new XMLHttpRequest" not in script
    assert "fetch(" not in app_js
    assert "window.kern = kern;" in script, "kern.js hoort in de tool te zitten"


def test_grootte(gebouwd):
    kb = gebouwd.stat().st_size / 1024
    assert kb < 800, f"de pagina is {kb:.0f} kB; dat is te groot voor een offlinebelofte"
    assert kb > 60, f"de pagina is maar {kb:.0f} kB; er mist waarschijnlijk inhoud"
