#!/usr/bin/env python3
"""Neemt de voorbeeldantwoorden op: een keer echt de leverancier aanroepen, daarna staan ze in git.

De tests spelen deze antwoorden af en hebben geen sleutel nodig. Draai dit alleen als een opdracht of
een fixture verandert. De sleutel komt uit de omgevingsvariabele MISTRAL_API_KEY en komt nergens in een
bestand.

Aanroep:
    MISTRAL_API_KEY=... python ai/tests/fixtures/neem_op.py            alle opdrachten
    MISTRAL_API_KEY=... python ai/tests/fixtures/neem_op.py processen  een opdracht

Alleen standaardbibliotheek.
"""
from __future__ import annotations

import json
import os
import pathlib
import sys
import time
import urllib.error
import urllib.request

HIER = pathlib.Path(__file__).resolve().parent
AI = HIER.parent.parent
sys.path.insert(0, str(AI))
import kern  # noqa: E402


def lees_invoer(pad: pathlib.Path) -> str:
    if pad.suffix == ".xlsx":
        return kern.xlsx_naar_tekst(pad.read_bytes())
    if pad.suffix == ".csv":
        return kern.csv_naar_tekst(pad.read_text(encoding="utf-8"))
    return pad.read_text(encoding="utf-8")


def roep_aan(basis: str, sleutel: str, model: str, berichten: list[dict], schema: dict) -> str:
    """Eerst json_schema; bij een 400 daarover terugvallen op json_object. Zelfde gedrag als ai.js."""
    for vorm in ({"type": "json_schema", "json_schema": {"name": "voorstel", "schema": schema, "strict": True}},
                 {"type": "json_object"}):
        body = json.dumps({"model": model, "messages": berichten, "temperature": 0,
                           "response_format": vorm}).encode("utf-8")
        verzoek = urllib.request.Request(f"{basis}/v1/chat/completions", data=body, method="POST", headers={
            "Content-Type": "application/json", "Authorization": f"Bearer {sleutel}"})
        for poging in range(4):
            try:
                with urllib.request.urlopen(verzoek, timeout=120) as antwoord:
                    data = json.loads(antwoord.read().decode("utf-8"))
                    return data["choices"][0]["message"]["content"]
            except urllib.error.HTTPError as fout:
                tekst = fout.read().decode("utf-8", "replace")
                if fout.code == 400 and vorm["type"] == "json_schema":
                    print("  json_schema niet geaccepteerd, terug naar json_object:", tekst[:120])
                    break
                if fout.code == 429 and poging < 3:
                    wacht = [2, 4, 8][poging]
                    print(f"  429, wacht {wacht}s")
                    time.sleep(wacht)
                    continue
                raise SystemExit(f"HTTP {fout.code}: {tekst[:400]}")
    raise SystemExit("geen antwoord")


def main(argv: list[str]) -> int:
    sleutel = os.environ.get("MISTRAL_API_KEY", "")
    if not sleutel:
        return print("MISTRAL_API_KEY ontbreekt") or 1
    bron = json.loads((AI / "opdrachten.json").read_text(encoding="utf-8"))
    leverancier = dict(bron["leveranciers"][0])
    # Een ander model dan de standaard (bijvoorbeeld omdat het abonnement mistral-large niet toelaat):
    leverancier["model"] = os.environ.get("MISTRAL_MODEL", leverancier["model"])
    print("model:", leverancier["model"])
    gevraagd = set(argv) or {o["id"] for o in bron["opdrachten"]}
    for opdracht in bron["opdrachten"]:
        if opdracht["id"] not in gevraagd:
            continue
        invoerpad = HIER / opdracht["voorbeeld"]["invoer"].split("/", 1)[1]
        invoer = lees_invoer(invoerpad)
        stukken = kern.chunk(invoer, bron["grenzen"]["max_tekens_per_aanroep"])
        print(f"{opdracht['id']}: {invoerpad.name}, {len(invoer)} tekens, {len(stukken)} aanroep(en)")
        delen = []
        for i, stuk in enumerate(stukken, start=1):
            berichten = [{"role": "system", "content": opdracht["systeemprompt"] + "\n\n" + bron["vaste_regels"]},
                         {"role": "user", "content": stuk}]
            ruw = roep_aan(leverancier["basis"], sleutel, leverancier["model"], berichten, opdracht["schema"])
            data, fouten = kern.parse_antwoord(opdracht["schema"], ruw)
            if fouten:
                print(f"  stuk {i}: antwoord voldoet niet aan het schema, een keer opnieuw: {fouten[:3]}")
                berichten.append({"role": "assistant", "content": ruw})
                berichten.append({"role": "user", "content": "Je antwoord voldeed niet aan het schema: " +
                                  "; ".join(fouten[:5]) + ". Antwoord opnieuw, alleen JSON."})
                ruw = roep_aan(leverancier["basis"], sleutel, leverancier["model"], berichten, opdracht["schema"])
                data, fouten = kern.parse_antwoord(opdracht["schema"], ruw)
                if fouten:
                    raise SystemExit(f"  stuk {i} blijft ongeldig: {fouten[:3]}")
            delen.append(data)
        samen = kern.voeg_stukken_samen(opdracht, delen)
        doel = HIER / "antwoorden" / f"{opdracht['id']}-voorbeeld.json"
        doel.write_bytes((json.dumps(samen, ensure_ascii=False, indent=1) + "\n").encode("utf-8"))
        aantal = len(samen.get("items", samen.get("nodes", [])))
        niet = [r for r in (samen.get("items") or samen.get("nodes") or []) if not kern.bronregel_klopt(r, invoer)]
        print(f"  {doel.name}: {aantal} items, {len(samen.get('edges', []))} edges, "
              f"{len(samen['onzeker'])} onzeker, {len(niet)} met een citaat dat niet in de bron staat")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
