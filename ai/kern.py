#!/usr/bin/env python3
"""De deterministische kern van de AI-hulp: schema-controle, chunking, samenvoegen, xlsx lezen, vergelijken.

Dit is de referentie. `ai/bron/kern.js` heeft dezelfde functies onder dezelfde namen in het object
`kern`, zodat een test beide kanten kan vergelijken. Wat hier NIET staat: de aanroep van de leverancier.
Die zit alleen in `ai/bron/ai.js`, want `kern.js` gaat ook mee in de tool zelf en de tool mag geen
netwerk kennen (zie het plan, hoofdstuk 7).

Alleen standaardbibliotheek.
"""
from __future__ import annotations

import io
import json
import re
import zipfile
# ElementTree uit de standaardbibliotheek: geen dependencies, en de xlsx-lezer draait alleen in tests en
# bij het opnemen van fixtures, op bestanden die de bouwer zelf aanlevert. Expat in Python 3 lost geen
# externe entiteiten op; in de browser leest kern.js de XML met DOMParser, zonder entiteiten.
from xml.etree import ElementTree

# ── Schema-controle ───────────────────────────────────────────────────────────
#
# Een eigen, kleine implementatie van precies de deelverzameling van JSON Schema die de opdrachten
# gebruiken: type, required, properties, additionalProperties, items, enum. Geen bibliotheek, zodat
# Python en JavaScript regel voor regel hetzelfde doen.

_TYPEN = {
    "object": lambda w: isinstance(w, dict),
    "array": lambda w: isinstance(w, list),
    "string": lambda w: isinstance(w, str),
    "boolean": lambda w: isinstance(w, bool),
    "number": lambda w: isinstance(w, (int, float)) and not isinstance(w, bool),
    "integer": lambda w: isinstance(w, int) and not isinstance(w, bool),
    "null": lambda w: w is None,
}


def valideer(schema: dict, data, pad: str = "") -> list[str]:
    """Lijst met fouten als 'pad: reden'; leeg als de data aan het schema voldoet."""
    fouten: list[str] = []
    hier = pad or "(wortel)"
    soort = schema.get("type")
    if soort and not _TYPEN[soort](data):
        return [f"{hier}: verwacht {soort}, kreeg {type(data).__name__ if data is not None else 'null'}"]
    if "enum" in schema and data not in schema["enum"]:
        return [f"{hier}: waarde {data!r} niet uit {schema['enum']}"]
    if soort == "object":
        for veld in schema.get("required", []):
            if veld not in data:
                fouten.append(f"{hier}: veld '{veld}' ontbreekt")
        eigenschappen = schema.get("properties", {})
        if schema.get("additionalProperties") is False:
            for veld in data:
                if veld not in eigenschappen:
                    fouten.append(f"{hier}: onbekend veld '{veld}'")
        for veld, deel in eigenschappen.items():
            if veld in data:
                fouten += valideer(deel, data[veld], f"{pad}.{veld}" if pad else veld)
    elif soort == "array" and "items" in schema:
        for i, item in enumerate(data):
            fouten += valideer(schema["items"], item, f"{pad}[{i}]")
    return fouten


def strip_hekken(tekst: str) -> str:
    """Haalt ```json ... ``` (of losse ```) om een antwoord weg; sommige modellen zetten die er toch omheen."""
    t = tekst.strip()
    m = re.match(r"^```[a-zA-Z]*\s*\n(.*?)\n?```\s*$", t, re.S)
    return m.group(1).strip() if m else t


def parse_antwoord(schema: dict, tekst: str) -> tuple[dict | None, list[str]]:
    """Van ruwe modeltekst naar gevalideerde data; retour (data, fouten)."""
    schoon = strip_hekken(tekst)
    try:
        data = json.loads(schoon)
    except (json.JSONDecodeError, TypeError) as fout:
        return None, [f"geen geldige JSON: {fout}"]
    fouten = valideer(schema, data)
    return (data if not fouten else None), fouten


# ── Chunking en samenvoegen ───────────────────────────────────────────────────


def chunk(tekst: str, max_tekens: int) -> list[str]:
    """Knipt op alinea's (lege regel), daarbinnen op regels; nooit midden in een regel."""
    tekst = tekst.replace("\r\n", "\n").replace("\r", "\n")
    if len(tekst) <= max_tekens:
        return [tekst] if tekst.strip() else []
    stukken: list[str] = []
    huidig = ""

    def sluit_af() -> None:
        nonlocal huidig
        if huidig.strip():
            stukken.append(huidig.rstrip("\n"))
        huidig = ""

    for alinea in tekst.split("\n\n"):
        blok = alinea + "\n\n"
        if len(blok) > max_tekens:
            # Een alinea die op zichzelf te groot is: regel voor regel.
            for regel in alinea.split("\n"):
                r = regel + "\n"
                if len(huidig) + len(r) > max_tekens:
                    sluit_af()
                huidig += r
            huidig += "\n"
            continue
        if len(huidig) + len(blok) > max_tekens:
            sluit_af()
        huidig += blok
    sluit_af()
    return stukken


def voeg_stukken_samen(opdracht: dict, delen: list[dict]) -> dict:
    """Items van alle stukken achter elkaar; dubbele codes krijgen een achtervoegsel en een waarschuwing."""
    uit: dict = {"onzeker": [], "waarschuwingen": []}
    sleutels = [k for k in ("items", "nodes", "edges") if k in opdracht["schema"]["properties"]]
    for k in sleutels:
        uit[k] = []
    gezien: dict[str, set[str]] = {"items": set(), "nodes": set()}
    for i, deel in enumerate(delen, start=1):
        for k in sleutels:
            for record in deel.get(k, []):
                record = dict(record)
                sleutelveld = "code" if k == "items" else ("id" if k == "nodes" else None)
                if sleutelveld:
                    basis = record.get(sleutelveld, "")
                    waarde, n = basis, 1
                    while waarde in gezien[k]:
                        n += 1
                        waarde = f"{basis}-{n}"
                    if waarde != basis:
                        uit["waarschuwingen"].append(
                            f"{sleutelveld} {basis} kwam vaker voor (stuk {i}); hernoemd naar {waarde}")
                    record[sleutelveld] = waarde
                    gezien[k].add(waarde)
                uit[k].append(record)
        for regel in deel.get("onzeker", []):
            if regel not in uit["onzeker"]:
                uit["onzeker"].append(regel)
    return uit


# ── Invoer lezen ──────────────────────────────────────────────────────────────


def _splits_csv_regel(regel: str) -> list[str]:
    uit, huidig, in_aanhaling = [], "", False
    i = 0
    while i < len(regel):
        teken = regel[i]
        if in_aanhaling:
            if teken == '"' and i + 1 < len(regel) and regel[i + 1] == '"':
                huidig += '"'
                i += 1
            elif teken == '"':
                in_aanhaling = False
            else:
                huidig += teken
        elif teken == '"':
            in_aanhaling = True
        elif teken == ",":
            uit.append(huidig)
            huidig = ""
        else:
            huidig += teken
        i += 1
    uit.append(huidig)
    return uit


def rijen_naar_tekst(rijen: list[list[str]]) -> str:
    """Een tabel als markdown, zodat het model kolomkoppen ziet. Lege rijen vallen weg."""
    rijen = [r for r in rijen if any(str(c).strip() for c in r)]
    if not rijen:
        return ""
    breedte = max(len(r) for r in rijen)
    rijen = [list(r) + [""] * (breedte - len(r)) for r in rijen]
    kop = "| " + " | ".join(str(c).strip().replace("|", "/") for c in rijen[0]) + " |"
    lijn = "|" + "---|" * breedte
    lijf = ["| " + " | ".join(str(c).strip().replace("|", "/") for c in r) + " |" for r in rijen[1:]]
    return "\n".join([kop, lijn] + lijf) + "\n"


def csv_naar_tekst(tekst: str) -> str:
    regels = [r for r in tekst.replace("\r\n", "\n").replace("\r", "\n").split("\n") if r.strip()]
    return rijen_naar_tekst([_splits_csv_regel(r) for r in regels])


def xlsx_naar_rijen(inhoud: bytes) -> list[list[str]]:
    """Het eerste werkblad als rijen. Inline strings, gedeelde strings en getallen; geen formules of opmaak."""
    ns = {"m": "http://schemas.openxmlformats.org/spreadsheetml/2006/main"}
    with zipfile.ZipFile(io.BytesIO(inhoud)) as z:
        namen = z.namelist()
        gedeeld: list[str] = []
        if "xl/sharedStrings.xml" in namen:
            wortel = ElementTree.fromstring(z.read("xl/sharedStrings.xml"))
            for si in wortel.findall("m:si", ns):
                gedeeld.append("".join(t.text or "" for t in si.iter("{%s}t" % ns["m"])))
        bladen = sorted(n for n in namen if re.match(r"xl/worksheets/sheet\d+\.xml$", n))
        if not bladen:
            return []
        wortel = ElementTree.fromstring(z.read(bladen[0]))
    rijen: list[list[str]] = []
    for rij in wortel.iter("{%s}row" % ns["m"]):
        cellen: dict[int, str] = {}
        for c in rij.findall("m:c", ns):
            ref = c.get("r", "")
            letters = re.match(r"[A-Z]+", ref)
            kolom = 0
            for letter in (letters.group(0) if letters else "A"):
                kolom = kolom * 26 + (ord(letter) - 64)
            soort = c.get("t", "")
            waarde = ""
            if soort == "inlineStr":
                waarde = "".join(t.text or "" for t in c.iter("{%s}t" % ns["m"]))
            else:
                v = c.find("m:v", ns)
                if v is not None and v.text is not None:
                    waarde = gedeeld[int(v.text)] if soort == "s" and v.text.isdigit() else v.text
            cellen[kolom - 1] = waarde
        if cellen:
            breedte = max(cellen) + 1
            rijen.append([cellen.get(i, "") for i in range(breedte)])
    return rijen


def xlsx_naar_tekst(inhoud: bytes) -> str:
    return rijen_naar_tekst(xlsx_naar_rijen(inhoud))


# ── Vergelijken en toepassen ──────────────────────────────────────────────────


def _norm(tekst) -> str:
    """Kleine letters, opmaaktekens weg, witruimte samengevouwen: markdown en tabelstrepen tellen niet mee."""
    schoon = re.sub(r"[*#`|_>]", " ", str(tekst or ""))
    return " ".join(schoon.split()).lower()


def bronregel_klopt(item: dict, invoer: str) -> bool:
    """De goedkoopste hallucinatiecheck: elk stuk van het citaat moet woordelijk in de invoer staan.

    Modellen citeren zelden een aaneengesloten stuk: ze laten een zin of een tabelkolom weg en plakken
    de rest aan elkaar. Daarom wordt het citaat geknipt op zinseinden, tabelstrepen en "...", en moet
    elk stuk van minstens twaalf tekens ergens in de invoer voorkomen. Opmaak (vet, koppen, strepen) en
    regeleinden tellen niet mee. Een verzonnen item valt hier nog steeds doorheen: een zin die nergens
    staat, staat nergens.
    """
    tekst = _norm(invoer)
    citaat = str(item.get("bronregel") or "")
    stukken = [_norm(s) for s in re.split(r"(?<=[.;:!?])\s+|\s*\|\s*|\.\.\.|\u2026", citaat)]
    lang = [s for s in stukken if len(s) >= 12]
    if not lang:
        heel = _norm(citaat)
        return bool(heel) and heel in tekst
    return all(s in tekst for s in lang)


def vergelijk(dossier: dict, voorstel: dict, invoer: str | None = None) -> list[dict]:
    """Per item van het voorstel de status ten opzichte van het dossier.

    nieuw: code en naam onbekend · bestaand: code bestaat, of de naam komt overeen · conflict: de code
    bestaat met een andere naam · niet_in_bron: het citaat staat niet in de invoer (alleen als de
    invoer wordt meegegeven). Voor landschap: nodes op id, edges op (from, to).
    """
    opdracht = voorstel.get("opdracht")
    uit: list[dict] = []
    if opdracht in ("processen", "applicaties"):
        bestaand = dossier.get(opdracht) or []
        per_code = {p["code"]: p for p in bestaand}
        per_naam = {_norm(p.get("naam")): p for p in bestaand if _norm(p.get("naam"))}
        for item in voorstel.get("items", []):
            status, huidig = "nieuw", None
            if item.get("code") in per_code:
                huidig = per_code[item["code"]]
                status = "bestaand" if _norm(huidig.get("naam")) == _norm(item.get("naam")) or not _norm(huidig.get("naam")) else "conflict"
            elif _norm(item.get("naam")) in per_naam:
                huidig = per_naam[_norm(item.get("naam"))]
                status = "bestaand"
            if invoer is not None and not bronregel_klopt(item, invoer):
                status = "niet_in_bron"
            uit.append({"sleutel": item.get("code"), "status": status, "item": item,
                        "huidig_code": huidig["code"] if huidig else None})
    elif opdracht == "landschap":
        ci = {c["id"] for c in dossier.get("componenten") or []}
        apps = {a["code"] for a in dossier.get("applicaties") or []}
        procs = {p["code"] for p in dossier.get("processen") or []}
        for node in voorstel.get("nodes", []):
            bekend = node["id"] in (ci if node["type"] == "ci" else apps if node["type"] == "app" else procs)
            status = "bestaand" if bekend else "nieuw"
            if invoer is not None and not bronregel_klopt(node, invoer):
                status = "niet_in_bron"
            uit.append({"sleutel": node["id"], "status": status, "item": node, "huidig_code": node["id"] if bekend else None})
        paren = {(e["from"], e["to"]) for e in dossier.get("component_edges") or []}
        for p in dossier.get("processen") or []:
            for a in p.get("applicaties") or []:
                paren.add((a, p["code"]))
        for edge in voorstel.get("edges", []):
            status = "bestaand" if (edge["from"], edge["to"]) in paren else "nieuw"
            if invoer is not None and not bronregel_klopt(edge, invoer):
                status = "niet_in_bron"
            uit.append({"sleutel": edge["from"] + "|" + edge["to"], "status": status, "item": edge, "huidig_code": None})
    return uit


def standaardkeuze(status: str) -> str:
    return {"nieuw": "overnemen", "bestaand": "samenvoegen", "conflict": "overslaan",
            "niet_in_bron": "overslaan"}[status]


_PROCESVELDEN = ("naam", "beschrijving", "doelstelling", "eigenaar", "afdeling", "reden_kritiek")
_APPVELDEN = ("naam", "beschrijving", "eigenaar_business", "eigenaar_technisch", "soort")


def _leeg_proces(code: str) -> dict:
    return {"code": code, "naam": "", "beschrijving": "", "doelstelling": "", "eigenaar": "", "afdeling": "",
            "kritiek": False, "reden_kritiek": "", "laatste_beoordeling": "", "notities": "", "applicaties": [],
            "bia": {"b1": None, "b2": None, "b3": None, "b4": None, "i1": None, "v1": None,
                    "onderbouwing": {k: "" for k in ("b1", "b2", "b3", "b4", "i1", "v1")},
                    "interviewer": "", "interviewdatum": "", "beschrijving": "", "ketenafhankelijkheden": "",
                    "afwijking_eigenaar": "", "notities": ""},
            "rto_rpo": {"rto": "", "rto_eenheid": "", "rpo": "", "rpo_eenheid": "", "toelichting": ""},
            "context": {**{v: "" for v in ("partners", "activiteiten", "middelen", "propositie", "klantrelaties",
                                            "kanalen", "segmenten", "kosten", "opbrengsten", "wettelijke_basis",
                                            "stakeholders", "ketenpositie", "kernaspecten", "continuiteitseisen",
                                            "reviewdatum", "notities")},
                        "persoonsgegevens": False, "bijzondere_persoonsgegevens": False}}


def _lege_app(code: str) -> dict:
    return {"code": code, "naam": "", "beschrijving": "", "eigenaar_business": "", "eigenaar_technisch": "",
            "soort": "applicatie", "csir_dossier": {"bestand": "", "vingerafdruk": ""}, "notities": "",
            "reviewdatum": ""}


def pas_toe(dossier: dict, voorstel: dict, keuzes: dict[str, str]) -> tuple[dict, dict]:
    """Een nieuw dossier met de gekozen items erin; het oude blijft onaangeraakt. Nooit verwijderen.

    keuzes: per sleutel 'overnemen' | 'overslaan' | 'samenvoegen'. Samenvoegen vult alleen lege velden.
    Retour (nieuw dossier, telling).
    """
    nieuw = json.loads(json.dumps(dossier))
    telling = {"overgenomen": 0, "samengevoegd": 0, "overgeslagen": 0}
    opdracht = voorstel.get("opdracht")
    vergelijking = vergelijk(dossier, voorstel)

    if opdracht in ("processen", "applicaties"):
        lijst = nieuw.setdefault(opdracht, [])
        per_code = {p["code"]: p for p in lijst}
        velden = _PROCESVELDEN if opdracht == "processen" else _APPVELDEN
        maak = _leeg_proces if opdracht == "processen" else _lege_app
        for regel in vergelijking:
            keuze = keuzes.get(regel["sleutel"], standaardkeuze(regel["status"]))
            item = regel["item"]
            if keuze == "overslaan" or (keuze == "samenvoegen" and not regel["huidig_code"]):
                if keuze == "samenvoegen":
                    keuze = "overnemen"
                else:
                    telling["overgeslagen"] += 1
                    continue
            if keuze == "overnemen":
                doel = per_code.get(item["code"])
                if doel is None:
                    doel = maak(item["code"])
                    lijst.append(doel)
                    per_code[item["code"]] = doel
                for veld in velden:
                    doel[veld] = item.get(veld, doel.get(veld, ""))
                if opdracht == "processen":
                    doel["kritiek"] = bool(item.get("kritiek"))
                telling["overgenomen"] += 1
            else:  # samenvoegen
                doel = per_code[regel["huidig_code"]]
                for veld in velden:
                    if not str(doel.get(veld) or "").strip() and item.get(veld):
                        doel[veld] = item[veld]
                if opdracht == "processen" and item.get("kritiek") and not doel.get("kritiek"):
                    doel["kritiek"] = True
                telling["samengevoegd"] += 1

    elif opdracht == "landschap":
        apps = {a["code"] for a in nieuw.get("applicaties") or []}
        procs = {p["code"]: p for p in nieuw.get("processen") or []}
        ci = {c["id"]: c for c in nieuw.setdefault("componenten", [])}
        typen: dict[str, str] = {}
        for regel in vergelijking:
            item = regel["item"]
            if "type" in item:
                typen[item["id"]] = item["type"]
            keuze = keuzes.get(regel["sleutel"], standaardkeuze(regel["status"]))
            if keuze == "overslaan":
                telling["overgeslagen"] += 1
                continue
            if "type" in item:  # node
                if item["type"] == "ci":
                    if item["id"] not in ci:
                        ci[item["id"]] = {"id": item["id"], "label": item.get("label") or item["id"],
                                          "kritiek": bool(item.get("kritiek"))}
                        nieuw["componenten"].append(ci[item["id"]])
                        telling["overgenomen"] += 1
                    else:
                        if item.get("kritiek"):
                            ci[item["id"]]["kritiek"] = True
                        telling["samengevoegd"] += 1
                elif item["type"] == "app":
                    if item["id"] not in apps:
                        app = _lege_app(item["id"])
                        app["naam"] = item.get("label") or item["id"]
                        nieuw.setdefault("applicaties", []).append(app)
                        apps.add(item["id"])
                        telling["overgenomen"] += 1
                    else:
                        telling["samengevoegd"] += 1
                else:
                    if item["id"] not in procs:
                        proces = _leeg_proces(item["id"])
                        proces["naam"] = item.get("label") or item["id"]
                        proces["kritiek"] = bool(item.get("kritiek"))
                        nieuw.setdefault("processen", []).append(proces)
                        procs[item["id"]] = proces
                        telling["overgenomen"] += 1
                    else:
                        if item.get("kritiek"):
                            procs[item["id"]]["kritiek"] = True
                        telling["samengevoegd"] += 1
            else:  # edge
                van, naar = item["from"], item["to"]
                van_type = typen.get(van, "ci" if van in ci else "app" if van in apps else None)
                naar_type = typen.get(naar, "proces" if naar in procs else "app" if naar in apps else "ci" if naar in ci else None)
                if van_type == "app" and naar_type == "proces" and naar in procs:
                    lijst = procs[naar].setdefault("applicaties", [])
                    if van not in lijst:
                        lijst.append(van)
                        telling["overgenomen"] += 1
                    else:
                        telling["samengevoegd"] += 1
                elif van_type == "ci" and naar_type in ("app", "ci"):
                    edges = nieuw.setdefault("component_edges", [])
                    if not any(e["from"] == van and e["to"] == naar for e in edges):
                        edges.append({"from": van, "to": naar, "relatie": item.get("relatie") or "ondersteunt"})
                        telling["overgenomen"] += 1
                    else:
                        telling["samengevoegd"] += 1
                else:
                    telling["overgeslagen"] += 1

    herkomst = nieuw.setdefault("herkomst_ai", [])
    herkomst.append({
        "opdracht": opdracht, "leverancier": voorstel.get("leverancier", ""), "model": voorstel.get("model", ""),
        "gemaakt": voorstel.get("gemaakt", ""), "invoer_sha256": (voorstel.get("invoer") or {}).get("sha256", ""),
        "overgenomen": telling["overgenomen"], "samengevoegd": telling["samengevoegd"],
        "overgeslagen": telling["overgeslagen"],
    })
    return nieuw, telling
