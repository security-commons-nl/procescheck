#!/usr/bin/env python3
"""Bouwt procescheck: een zelfstandig HTML-bestand uit procescheck.json en de bestanden in bron/.

Geen bundler, geen dependencies, geen externe verwijzingen. De bron gaat als JSON in dezelfde
scripttag als de app, zodat er precies een script en een stylesheet is en het Content-Security-Policy
hun sha256-hash kan vastleggen: default-src 'none' voor de rest. Zo is de offlinebelofte
controleerbaar in plaats van beloofd.

Aanroep:
    python instrument/bouw.py                 schrijft instrument/dist/index.html
    python instrument/bouw.py <doelmap>

Alleen standaardbibliotheek.
"""
from __future__ import annotations

import base64
import hashlib
import json
import pathlib
import sys

HIER = pathlib.Path(__file__).resolve().parent
REPO = HIER.parent
BRON = HIER / "bron"
# De kern van de AI-hulp (vergelijken en toepassen van een voorstel) gaat mee in de tool. Dat bestand
# kent geen netwerk; de aanroep van een leverancier zit alleen in ai/bron/ai.js, op de AI-pagina.
KERN_JS = REPO / "ai" / "bron" / "kern.js"

# De sleutels waarover de vingerafdruk gaat: de inhoud die het antwoord bepaalt. Herkomst, versie en
# het voorbeeldlandschap horen er niet bij; die mogen wijzigen zonder dat een dossier veroudert.
KERN = ("schaal", "vragen", "parameters", "volledigheid", "prioriteiten")


def sha256_csp(inhoud: str) -> str:
    """De hashvorm die het Content-Security-Policy verwacht."""
    return "sha256-" + base64.b64encode(hashlib.sha256(inhoud.encode("utf-8")).digest()).decode()


def vingerafdruk(bron: dict) -> str:
    """Sha256 over de inhoud, niet over de bytes: los van regeleindes en sleutelvolgorde."""
    kern = {sleutel: bron[sleutel] for sleutel in KERN}
    ruw = json.dumps(kern, ensure_ascii=False, sort_keys=True, separators=(",", ":"))
    return hashlib.sha256(ruw.encode("utf-8")).hexdigest()


def bouw(doel: pathlib.Path) -> pathlib.Path:
    data = json.loads((REPO / "procescheck.json").read_text(encoding="utf-8"))
    data["vingerafdruk"] = vingerafdruk(data)

    voorbeeld = json.loads((HIER / "voorbeeld" / "landschap.json").read_text(encoding="utf-8"))
    data["voorbeeld"] = voorbeeld

    css = (BRON / "app.css").read_text(encoding="utf-8").strip()
    js = (BRON / "app.js").read_text(encoding="utf-8").strip()
    kern = KERN_JS.read_text(encoding="utf-8").strip()
    assert "fetch(" not in kern and "fetch(" not in js, "de tool mag geen netwerk kennen"
    sjabloon = (BRON / "index.html").read_text(encoding="utf-8")

    # </script> in de data zou de scripttag vroegtijdig sluiten; JSON mag die slash escapen.
    json_bron = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    script = "window.__BRON__ = " + json_bron + ";\n" + kern + "\n" + js

    html = (sjabloon
            .replace("__CSS__", css)
            .replace("__SCRIPT__", script)
            .replace("__SCRIPT_HASH__", sha256_csp(script).removeprefix("sha256-"))
            .replace("__STYLE_HASH__", sha256_csp(css).removeprefix("sha256-")))

    for rest in ("__CSS__", "__SCRIPT__", "__SCRIPT_HASH__", "__STYLE_HASH__"):
        assert rest not in html, f"placeholder {rest} niet ingevuld"

    doel.mkdir(parents=True, exist_ok=True)
    uit = doel / "index.html"
    uit.write_bytes(html.encode("utf-8"))
    return uit


if __name__ == "__main__":
    doelmap = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HIER / "dist"
    bestand = bouw(doelmap)
    kb = bestand.stat().st_size / 1024
    print(f"{bestand}: {kb:.0f} kB, zelfstandig en offline")
