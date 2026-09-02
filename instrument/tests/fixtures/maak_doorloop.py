#!/usr/bin/env python3
"""Bouwt de testfixtures: een ingevuld dossier, dezelfde landschapsdata als CSV, en een groot landschap.

Een fixture die met de hand is bijgehouden loopt vroeg of laat uit de pas met de rekenregels. Daarom
staat hier het recept: zes processen die samen elke volledigheidsband en elke prioriteitsregel raken,
vijf applicaties en zes componenten. `verwacht` wordt uit reken.py gehaald, maar de losse getallen zijn
met de hand nagelopen en staan in het bouwplan (hoofdstuk 11); wijkt de uitkomst af, dan is dat een
verandering in de regels en geen vergissing in de fixture.

Aanroep:
    python instrument/tests/fixtures/maak_doorloop.py

Alleen standaardbibliotheek.
"""
from __future__ import annotations

import json
import pathlib
import random
import sys

HIER = pathlib.Path(__file__).resolve().parent
REPO = HIER.parent.parent.parent
sys.path.insert(0, str(REPO / "instrument"))

import reken  # noqa: E402

VANDAAG = "2026-09-02"


def leeg_bia() -> dict:
    return {"b1": None, "b2": None, "b3": None, "b4": None, "i1": None, "v1": None,
            "onderbouwing": {k: "" for k in ("b1", "b2", "b3", "b4", "i1", "v1")},
            "interviewer": "", "interviewdatum": "", "beschrijving": "",
            "ketenafhankelijkheden": "", "afwijking_eigenaar": "", "notities": ""}


def gevuld_bia(scores: dict, interviewdatum: str) -> dict:
    uit = leeg_bia()
    uit.update(scores)
    uit["onderbouwing"] = {k: (f"Vastgesteld in het interview van {interviewdatum}." if scores.get(k) else "")
                           for k in ("b1", "b2", "b3", "b4", "i1", "v1")}
    uit["interviewer"] = "A. de Vries" if interviewdatum else ""
    uit["interviewdatum"] = interviewdatum
    uit["beschrijving"] = "Verzonnen data voor de test." if interviewdatum else ""
    return uit


def leeg_context() -> dict:
    uit = {veld: "" for veld in reken.CONTEXT_TEKSTVELDEN}
    uit["persoonsgegevens"] = False
    uit["bijzondere_persoonsgegevens"] = False
    return uit


def gevuld_context(reviewdatum: str, persoonsgegevens: bool, bijzonder: bool) -> dict:
    uit = leeg_context()
    for veld in reken.CONTEXT_TEKSTVELDEN:
        if veld not in ("reviewdatum", "notities"):
            uit[veld] = f"Verzonnen invulling voor {veld}."
    uit["reviewdatum"] = reviewdatum
    uit["persoonsgegevens"] = persoonsgegevens
    uit["bijzondere_persoonsgegevens"] = bijzonder
    return uit


def proces(code, naam, **velden) -> dict:
    basis = {"code": code, "naam": naam, "beschrijving": "", "doelstelling": "", "eigenaar": "",
             "afdeling": "", "kritiek": False, "reden_kritiek": "", "laatste_beoordeling": "",
             "notities": "", "applicaties": [], "bia": leeg_bia(),
             "rto_rpo": {"rto": "", "rto_eenheid": "", "rpo": "", "rpo_eenheid": "", "toelichting": ""},
             "context": leeg_context()}
    basis.update(velden)
    return basis


def dossier() -> dict:
    volledig = {"beschrijving": "Verzonnen procesbeschrijving.", "doelstelling": "Verzonnen doel.",
                "eigenaar": "J. Jansen", "afdeling": "Dienstverlening"}

    p01 = proces("P01", "Paspoort- en rijbewijsuitgifte", kritiek=True,
                 reden_kritiek="Wettelijke termijn, geen alternatief kanaal.",
                 laatste_beoordeling="2026-06-01", applicaties=["A01", "A02", "A03"],
                 bia=gevuld_bia({"b1": 3, "b2": 2, "b3": 5, "b4": 4, "i1": 4, "v1": 1}, "2026-06-01"),
                 rto_rpo={"rto": "8", "rto_eenheid": "uur", "rpo": "4", "rpo_eenheid": "uur",
                          "toelichting": "Handmatige overschrijving naast de klasselabels."},
                 context=gevuld_context("2026-06-01", True, True), **volledig)

    p02 = proces("P02", "Uitkeringen Werk en Inkomen", kritiek=True,
                 laatste_beoordeling="2026-02-01", applicaties=["A04"], **volledig)

    p03 = proces("P03", "Gemeentelijke belastinginning",
                 beschrijving="Verzonnen procesbeschrijving.", eigenaar="K. Bakker",
                 bia=gevuld_bia({"b1": 4, "b2": 4, "i1": 2}, ""))

    p04 = proces("P04", "Subsidieverstrekking", laatste_beoordeling="2024-01-01", applicaties=["A05"])

    p05 = proces("P05", "Vergunningverlening", laatste_beoordeling="2026-01-15", applicaties=["A05"],
                 reden_kritiek="", bia=gevuld_bia({"b1": 3, "b2": 3, "b3": 3, "b4": 3, "i1": 3, "v1": 3},
                                                  "2026-01-15"),
                 context=gevuld_context("2026-01-15", False, False), **volledig)

    p06 = dict(volledig)
    p06.pop("doelstelling")
    p06 = proces("P06", "Archiefbeheer", laatste_beoordeling="2026-05-01", applicaties=["A05"],
                 bia=gevuld_bia({"b1": 5, "b2": 5, "b3": 5, "b4": 5, "i1": 5, "v1": 5}, "2026-05-01"),
                 context=gevuld_context("2026-05-01", False, False), **p06)

    def app(code, naam, reviewdatum, soort="applicatie", csir=("", "")) -> dict:
        return {"code": code, "naam": naam, "beschrijving": f"Verzonnen omschrijving van {naam}.",
                "eigenaar_business": "J. Jansen", "eigenaar_technisch": "P. Pietersen",
                "soort": soort, "csir_dossier": {"bestand": csir[0], "vingerafdruk": csir[1]},
                "notities": "", "reviewdatum": reviewdatum}

    applicaties = [
        app("A01", "BRP (basisregistratie personen)", "2026-03-01"),
        app("A02", "Zaaksysteem", "2026-03-01"),
        app("A03", "Toegangscontrole publiekshal", "2025-01-01",
            soort="object met industriële automatisering",
            csir=("csir-dossier-toegangscontrole-2026-08-20.json", "b3f1c0a9d2e4")),
        app("A04", "Uitkeringsadministratie", ""),
        app("A05", "Documentmanagementsysteem", ""),
    ]

    componenten = [
        {"id": "ci-db1", "label": "db-burgerzaken01 (database)", "kritiek": True},
        {"id": "ci-net1", "label": "netwerk-core (kernswitch)", "kritiek": True},
        {"id": "ci-srv1", "label": "vm-toegang01 (appserver)", "kritiek": False},
        {"id": "ci-srv2", "label": "vm-toegang02 (appserver)", "kritiek": False},
        {"id": "ci-web1", "label": "vm-uitkering01 (appserver)", "kritiek": False},
        {"id": "ci-los", "label": "vm-test01 (losstaande testserver)", "kritiek": False},
    ]

    edges = [
        {"from": "ci-db1", "to": "A01", "relatie": "ondersteunt"},
        {"from": "ci-db1", "to": "A02", "relatie": "ondersteunt"},
        {"from": "ci-db1", "to": "A01", "relatie": "ondersteunt"},   # dubbel: moet samenvallen
        {"from": "ci-net1", "to": "ci-db1", "relatie": "ondersteunt"},
        {"from": "ci-srv1", "to": "A03", "relatie": "ondersteunt"},
        {"from": "ci-srv2", "to": "A03", "relatie": "ondersteunt"},
        {"from": "ci-web1", "to": "A04", "relatie": "ondersteunt"},
        {"from": "ci-net1", "to": "A99", "relatie": "ondersteunt"},  # onbekend doel: waarschuwing
    ]

    return {
        "formaat": "procescheck-dossier", "versie": 1, "bron_versie": "2026-09", "bron_sha256": "",
        "bijgewerkt": VANDAAG,
        "organisatie": {"naam": "Gemeente Voorbeeld", "peildatum": VANDAAG},
        "processen": [p01, p02, p03, p04, p05, p06],
        "applicaties": applicaties,
        "componenten": componenten,
        "component_edges": edges,
        "landschap_bron": {"bestand": "", "geimporteerd": ""},
    }


def landschap_csv(voorbeeld: dict) -> str:
    """Hetzelfde landschap als CSV, in het kolomformaat van blastradius/parsers.py."""
    per_id = {n["id"]: n for n in voorbeeld["nodes"]}
    regels = ["from,from_label,from_type,from_kritiek,to,to_label,to_type,to_kritiek,relatie"]
    for edge in voorbeeld["edges"]:
        bron, doel = per_id[edge["from"]], per_id[edge["to"]]
        regels.append(",".join([
            bron["id"], '"' + bron["label"] + '"', bron["type"], "ja" if bron.get("kritiek") else "nee",
            doel["id"], '"' + doel["label"] + '"', doel["type"], "ja" if doel.get("kritiek") else "nee",
            edge.get("relatie", "ondersteunt"),
        ]))
    return "\n".join(regels) + "\n"


def landschap_groot() -> dict:
    """200 nodes met een vaste zaaiwaarde, zodat het bestand reproduceerbaar is."""
    toeval = random.Random(20260902)
    nodes, edges = [], []
    for i in range(1, 21):
        nodes.append({"id": f"gp{i:02d}", "label": f"Groot proces {i:02d}", "type": "proces",
                      "kritiek": i <= 5})
    for i in range(1, 61):
        nodes.append({"id": f"ga{i:02d}", "label": f"Groot applicatie {i:02d}", "type": "app"})
    for i in range(1, 121):
        nodes.append({"id": f"gc{i:03d}", "label": f"Groot component {i:03d}", "type": "ci"})
    for i in range(1, 61):
        for doel in toeval.sample(range(1, 21), toeval.choice([1, 1, 2])):
            edges.append({"from": f"ga{i:02d}", "to": f"gp{doel:02d}", "relatie": "ondersteunt"})
    for i in range(1, 121):
        for doel in toeval.sample(range(1, 61), toeval.choice([1, 1, 2])):
            edges.append({"from": f"gc{i:03d}", "to": f"ga{doel:02d}", "relatie": "ondersteunt"})
    return {"naam": "Groot verzonnen landschap", "toelichting":
            "Gegenereerd door maak_doorloop.py met zaaiwaarde 20260902; alleen bedoeld om te toetsen "
            "dat de graaf boven bron['graaf_maximum'] terugvalt op de dragende nodes.",
            "nodes": nodes, "edges": edges}


def plat(waarde, pad="") -> dict:
    """Alle bladwaarden van het dashboard als platte sleutels, zodat een test ze los kan vergelijken."""
    uit = {}
    if isinstance(waarde, dict):
        for sleutel, deel in waarde.items():
            uit.update(plat(deel, f"{pad}.{sleutel}" if pad else str(sleutel)))
    elif isinstance(waarde, list):
        uit[pad] = len(waarde)
    else:
        uit[pad] = waarde
    return uit


def main() -> int:
    bron = json.loads((REPO / "procescheck.json").read_text(encoding="utf-8"))
    data = dossier()
    land = reken.landschap(data)
    verwacht = plat({k: v for k, v in reken.dashboard(bron, data, VANDAAG).items()
                     if k not in ("top", "prioriteiten", "kritiek_lijst")})
    verwacht.update({
        "prioriteiten": [{"code": r["code"], "prioriteit": r["prioriteit"], "reden": r["reden"],
                          "ontbrekend": r["ontbrekend"]}
                         for r in reken.dashboard(bron, data, VANDAAG)["prioriteiten"]],
        "ranglijst": [r["node_id"] for r in reken.ranglijst(land)],
        "single_points": reken.single_points(land),
        "dragende_nodes": reken.dragende_nodes(land),
        "bereik_ci_net1": sorted(reken.bereik(land, "ci:ci-net1")[0]),
        "landschap_nodes": len(land["nodes"]),
        "landschap_edges": len(land["edges"]),
        "waarschuwingen": land["waarschuwingen"],
        "vandaag": VANDAAG,
    })
    data["verwacht"] = verwacht

    (HIER / "doorloop-2026-09.json").write_bytes(
        (json.dumps(data, ensure_ascii=False, indent=1) + "\n").encode("utf-8"))

    voorbeeld = json.loads((REPO / "instrument" / "voorbeeld" / "landschap.json").read_text(encoding="utf-8"))
    (HIER / "landschap.csv").write_bytes(landschap_csv(voorbeeld).encode("utf-8"))
    (HIER / "landschap-groot.json").write_bytes(
        (json.dumps(landschap_groot(), ensure_ascii=False, indent=1) + "\n").encode("utf-8"))

    print(f"doorloop-2026-09.json: {len(data['processen'])} processen, {len(data['applicaties'])} "
          f"applicaties, {len(data['componenten'])} componenten")
    for sleutel in ("totaal", "kritiek", "compleet", "aandacht", "onvolledig", "hoog_risico"):
        print(f"  {sleutel:12} {verwacht[sleutel]}")
    for rij in verwacht["prioriteiten"]:
        print(f"  {rij['code']} {rij['prioriteit']:9} {rij['reden']}")
    print("  ranglijst:", ", ".join(verwacht["ranglijst"][:4]), "...")
    print("  single points:", verwacht["single_points"], "· waarschuwingen:", verwacht["waarschuwingen"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
