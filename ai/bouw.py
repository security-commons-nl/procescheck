#!/usr/bin/env python3
"""Bouwt de AI-hulp van procescheck: een zelfstandig HTML-bestand uit ai/opdrachten.json en ai/bron/.

Zelfde recept als instrument/bouw.py: de opdrachten als JSON in dezelfde scripttag als kern.js en ai.js,
een stylesheet, en een Content-Security-Policy op de sha256 van beide. Het verschil met de tool zit in
connect-src: deze pagina bestaat om naar buiten te praten, naar de leverancier die de gebruiker kiest.
Alleen https, plus localhost voor een lokale Ollama.

Aanroep:
    python ai/bouw.py                 schrijft ai/dist/index.html
    python ai/bouw.py <doelmap>

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

CONNECT_SRC = "https: http://localhost:* http://127.0.0.1:*"


def sha256_csp(inhoud: str) -> str:
    return "sha256-" + base64.b64encode(hashlib.sha256(inhoud.encode("utf-8")).digest()).decode()


def vingerafdruk_tool() -> str:
    """De vingerafdruk van de bron van de tool, zodat een voorstel weet bij welke tool hij hoort."""
    # Niet 'import bouw': dat is de naam van dit bestand zelf. Laden op pad, onder een eigen naam.
    import importlib.util
    spec = importlib.util.spec_from_file_location("tool_bouw", REPO / "instrument" / "bouw.py")
    tool = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(tool)
    return tool.vingerafdruk(json.loads((REPO / "procescheck.json").read_text(encoding="utf-8")))


def bouw(doel: pathlib.Path) -> pathlib.Path:
    data = json.loads((HIER / "opdrachten.json").read_text(encoding="utf-8"))
    data["tool_vingerafdruk"] = vingerafdruk_tool()

    css = (BRON / "ai.css").read_text(encoding="utf-8").strip()
    kern = (BRON / "kern.js").read_text(encoding="utf-8").strip()
    ai = (BRON / "ai.js").read_text(encoding="utf-8").strip()
    sjabloon = (BRON / "index.html").read_text(encoding="utf-8")

    assert "fetch(" not in kern, "kern.js gaat mee in de tool en mag geen netwerk kennen"

    json_bron = json.dumps(data, ensure_ascii=False, separators=(",", ":")).replace("</", "<\\/")
    script = "window.__OPDRACHTEN__ = " + json_bron + ";\n" + kern + "\n" + ai

    html = (sjabloon
            .replace("__CSS__", css)
            .replace("__SCRIPT__", script)
            .replace("__SCRIPT_HASH__", sha256_csp(script).removeprefix("sha256-"))
            .replace("__STYLE_HASH__", sha256_csp(css).removeprefix("sha256-"))
            .replace("__CONNECT_SRC__", CONNECT_SRC))
    for rest in ("__CSS__", "__SCRIPT__", "__SCRIPT_HASH__", "__STYLE_HASH__", "__CONNECT_SRC__"):
        assert rest not in html, f"placeholder {rest} niet ingevuld"

    doel.mkdir(parents=True, exist_ok=True)
    uit = doel / "index.html"
    uit.write_bytes(html.encode("utf-8"))
    return uit


if __name__ == "__main__":
    doelmap = pathlib.Path(sys.argv[1]) if len(sys.argv) > 1 else HIER / "dist"
    bestand = bouw(doelmap)
    print(f"{bestand}: {bestand.stat().st_size / 1024:.0f} kB")
