"""De rekenregels, los van de pagina. Wat hier staat, is wat de tool belooft uit te rekenen."""
from __future__ import annotations

import json
import pathlib
import re

from conftest import ROOT, FIXTURES

VANDAAG = "2026-09-02"


def maak_proces(reken, **velden) -> dict:
    basis = {"code": "P01", "naam": "Proces", "beschrijving": "", "doelstelling": "", "eigenaar": "",
             "afdeling": "", "kritiek": False, "reden_kritiek": "", "laatste_beoordeling": "",
             "applicaties": [], "bia": {}, "context": {},
             "rto_rpo": {"rto": "", "rto_eenheid": "", "rpo": "", "rpo_eenheid": "", "toelichting": ""}}
    basis.update(velden)
    return basis


def volledig_proces(reken, **velden) -> dict:
    context = {veld: "" for veld in reken.CONTEXT_TEKSTVELDEN}
    context["stakeholders"] = "Iemand"
    return maak_proces(reken, beschrijving="x", doelstelling="x", eigenaar="x", afdeling="x",
                       laatste_beoordeling="2026-06-01", applicaties=["A01"],
                       bia={"b1": 3, "b2": 3}, context=context, **velden)


def test_rond_half_omhoog(reken):
    assert reken.rond_half_omhoog(12.5) == 13
    assert reken.rond_half_omhoog(2.5) == 3
    assert reken.rond_half_omhoog(2.49) == 2
    assert reken.rond_half_omhoog(0) == 0
    # De valkuil zelf, vastgelegd: dit is precies waarom rond_half_omhoog bestaat.
    assert round(12.5) == 12


def test_klasse_score(reken):
    assert reken.klasse_score([3, None, 1]) == 1
    assert reken.klasse_score([None]) is None
    assert reken.klasse_score([]) is None
    assert reken.klasse_score([5, 4]) == 4


def test_bia(reken):
    uit = reken.bia({"b1": 3, "b2": 2, "b3": 5, "b4": 4, "i1": 4, "v1": 1})
    assert uit == {"B": 2, "I": 4, "V": 1, "proces": 1}
    assert reken.bia({}) == {"B": None, "I": None, "V": None, "proces": None}
    assert reken.bia({"i1": 3}) == {"B": None, "I": 3, "V": None, "proces": 3}


def test_parameterlabel(reken, bron):
    assert reken.parameterlabel(bron, "rto", 2) == "Maximaal 8 uur"
    assert reken.parameterlabel(bron, "mtpd", 5) == "Meer dan een week"
    assert reken.parameterlabel(bron, "rto", None) is None


def test_label_van_score(reken, bron):
    assert reken.label_van_score(bron, 1) == "Catastrofaal"
    assert reken.label_van_score(bron, 5) == "Verwaarloosbaar"
    assert reken.label_van_score(bron, None) is None


def test_heeft_rto_rpo(reken):
    assert reken.heeft_rto_rpo(maak_proces(reken, bia={"b1": 3, "b2": 3}))
    assert not reken.heeft_rto_rpo(maak_proces(reken, bia={"b1": 3}))
    # De handmatige overschrijving telt bewust niet mee; zie werkwijze.md.
    los = maak_proces(reken, bia={}, rto_rpo={"rto": "4", "rto_eenheid": "uur", "rpo": "1",
                                              "rpo_eenheid": "uur", "toelichting": ""})
    assert not reken.heeft_rto_rpo(los)


def test_context_leeg(reken):
    leeg = {veld: "" for veld in reken.CONTEXT_TEKSTVELDEN}
    leeg["persoonsgegevens"] = False
    leeg["bijzondere_persoonsgegevens"] = False
    assert reken.context_leeg(leeg)
    assert reken.context_leeg({})
    met_datum = dict(leeg, reviewdatum="2026-01-01")
    assert not reken.context_leeg(met_datum)
    met_vinkje = dict(leeg, persoonsgegevens=True)
    assert not reken.context_leeg(met_vinkje)


def test_ontbrekend_volgorde_en_kritiek(reken, bron):
    leeg = maak_proces(reken)
    labels = [c["label"] for c in bron["volledigheid"] if not c.get("alleen_als_kritiek")]
    assert reken.ontbrekend(bron, leeg) == labels
    assert len(labels) == 9

    kritiek = maak_proces(reken, kritiek=True)
    assert reken.ontbrekend(bron, kritiek) == [c["label"] for c in bron["volledigheid"]]
    assert len(reken.ontbrekend(bron, kritiek)) == 10

    assert reken.ontbrekend(bron, volledig_proces(reken)) == []


def test_hoog_risico(reken):
    assert reken.hoog_risico(maak_proces(reken, bia={"v1": 2}))
    assert not reken.hoog_risico(maak_proces(reken, bia={"b1": 3, "i1": 3, "v1": 3}))
    assert not reken.hoog_risico(maak_proces(reken, bia={}))


def test_prioriteit_volgorde(reken, bron):
    kritiek_zonder_bia = maak_proces(reken, kritiek=True, bia={})
    assert reken.prioriteit(bron, kritiek_zonder_bia)["prioriteit"] == "critical"
    assert reken.prioriteit(bron, kritiek_zonder_bia)["reden"] == "Informatie ontbreekt"

    hoog = maak_proces(reken, bia={"i1": 2})
    uit = reken.prioriteit(bron, hoog)
    assert uit["prioriteit"] == "high"
    assert uit["reden"] == "Hoog risico: geen RTO/RPO gedefinieerd"

    kritiek_onvolledig = volledig_proces(reken, kritiek=True, reden_kritiek="omdat", notities="")
    kritiek_onvolledig["afdeling"] = ""
    uit = reken.prioriteit(bron, kritiek_onvolledig)
    assert uit["prioriteit"] == "high"
    assert uit["reden"] == "Kritisch proces, onvolledig gedocumenteerd"

    vier = maak_proces(reken, beschrijving="x", doelstelling="x", eigenaar="x",
                       bia={"b1": 3, "b2": 3})
    uit = reken.prioriteit(bron, vier)
    assert uit["prioriteit"] == "medium"
    assert uit["reden"] == "4 velden ontbreken"
    assert len(uit["ontbrekend"]) == 4

    een = volledig_proces(reken)
    een["afdeling"] = ""
    uit = reken.prioriteit(bron, een)
    assert uit["prioriteit"] == "low"
    assert uit["reden"] == "1 veld(en) ontbreken"

    assert reken.prioriteit(bron, volledig_proces(reken)) is None


def test_op_tijd(reken):
    assert reken.cutoff("2026-09-02") == "2025-09-02"
    assert reken.op_tijd("2025-09-02", "2026-09-02")
    assert not reken.op_tijd("2025-09-01", "2026-09-02")
    assert not reken.op_tijd("", "2026-09-02")
    assert not reken.op_tijd(None, "2026-09-02")
    # 29 februari bestaat niet in elk jaar.
    assert reken.cutoff("2028-02-29") == "2027-02-28"


def test_procent(reken):
    assert reken.procent(1, 8) == 13
    assert reken.procent(0, 0) == 0
    assert reken.procent(3, 6) == 50
    assert reken.procent(2, 3) == 67


def test_slug_en_bestandsnaam(reken):
    assert reken.slug("Gemeente Voorbeeld") == "gemeente-voorbeeld"
    assert reken.slug("") == "organisatie"
    assert reken.slug("  ---  ") == "organisatie"
    assert reken.slug("Waterschap Hollandse Delta, afdeling ICT en informatiebeheer") == \
        "waterschap-hollandse-delta-afdeling-ict"
    assert reken.bestandsnaam({"organisatie": {"naam": ""}}, "2026-09-02") == \
        "procescheck-dossier-organisatie-2026-09-02.json"
    assert reken.bestandsnaam({"organisatie": {"naam": "Gemeente Voorbeeld"}}, "2026-09-02") == \
        "procescheck-dossier-gemeente-voorbeeld-2026-09-02.json"


def plat(waarde, pad=""):
    uit = {}
    if isinstance(waarde, dict):
        for sleutel, deel in waarde.items():
            uit.update(plat(deel, f"{pad}.{sleutel}" if pad else str(sleutel)))
    elif isinstance(waarde, list):
        uit[pad] = len(waarde)
    else:
        uit[pad] = waarde
    return uit


def test_dashboard_gelijk_aan_doorloop(reken, bron, doorloop):
    stand = reken.dashboard(bron, doorloop, doorloop["verwacht"]["vandaag"])
    berekend = plat({k: v for k, v in stand.items()
                     if k not in ("top", "prioriteiten", "kritiek_lijst")})
    for sleutel, waarde in berekend.items():
        assert doorloop["verwacht"][sleutel] == waarde, f"{sleutel} wijkt af"
    assert [{"code": r["code"], "prioriteit": r["prioriteit"], "reden": r["reden"],
             "ontbrekend": r["ontbrekend"]} for r in stand["prioriteiten"]] == \
        doorloop["verwacht"]["prioriteiten"]


def test_dashboard_kerngetallen(reken, bron, doorloop):
    """De getallen die met de hand zijn nagelopen (bouwplan hoofdstuk 11)."""
    stand = reken.dashboard(bron, doorloop, VANDAAG)
    assert (stand["totaal"], stand["kritiek"]) == (6, 2)
    assert (stand["compleet"], stand["aandacht"], stand["onvolledig"]) == (2, 1, 3)
    assert stand["hoog_risico"] == 2
    assert stand["verdeling"]["V"]["1"] == 1
    assert stand["review"]["processen"] == {"on_time": 4, "total": 6, "pct": 67}
    assert stand["review"]["bia"] == {"on_time": 3, "total": 6, "pct": 50}
    assert stand["review"]["context"] == {"on_time": 3, "total": 6, "pct": 50}
    assert stand["review"]["applicaties"] == {"on_time": 2, "total": 5, "pct": 40}
    assert stand["privacy"] == {"persoonsgegevens": 1, "bijzonder": 1}
    assert [r["code"] for r in stand["kritiek_lijst"]] == ["P01", "P02"]


def test_landschap_uit_dossier(reken, doorloop):
    land = reken.landschap(doorloop)
    assert len(land["nodes"]) == 17
    assert {n["id"] for n in land["nodes"] if n["type"] == "proces"} == \
        {"proces:P01", "proces:P02", "proces:P03", "proces:P04", "proces:P05", "proces:P06"}
    assert "app:A01" in {n["id"] for n in land["nodes"]}
    assert "ci:ci-db1" in {n["id"] for n in land["nodes"]}
    assert len(land["edges"]) == 13
    assert land["waarschuwingen"] == ["edge ci-net1 naar A99: onbekend doel"]
    assert not [e for e in land["edges"] if e["to"] == "A99" or e["to"] == "app:A99"]


def test_landschap_dedupliceert(reken, doorloop):
    """Het dossier bevat ci-db1 naar A01 twee keer; in de graaf staat hij een keer."""
    land = reken.landschap(doorloop)
    paren = [(e["from"], e["to"]) for e in land["edges"]]
    assert len(paren) == len(set(paren))
    assert paren.count(("ci:ci-db1", "app:A01")) == 1


def test_landschap_edge_resolutie(reken):
    """Een doel dat zowel applicatiecode als component-id is, is een applicatie."""
    dossier = {"processen": [], "applicaties": [{"code": "X1", "naam": "App X1"}],
               "componenten": [{"id": "X1", "label": "Component X1"},
                               {"id": "bron", "label": "Bron"}],
               "component_edges": [{"from": "bron", "to": "X1"}]}
    land = reken.landschap(dossier)
    assert [e["to"] for e in land["edges"]] == ["app:X1"]
    assert land["waarschuwingen"] == []


def test_landschap_onbekende_bron(reken):
    dossier = {"processen": [], "applicaties": [], "componenten": [],
               "component_edges": [{"from": "weg", "to": "ook-weg"}]}
    land = reken.landschap(dossier)
    assert land["edges"] == []
    assert land["waarschuwingen"] == ["edge weg naar ook-weg: onbekende bron"]


def test_bereik_en_cyclus(reken):
    dossier = {"processen": [{"code": "z", "naam": "Z", "kritiek": True, "applicaties": ["y"]}],
               "applicaties": [{"code": "y", "naam": "Y"}],
               "componenten": [{"id": "x", "label": "X"}],
               "component_edges": [{"from": "x", "to": "y"}]}
    land = reken.landschap(dossier)
    geraakt, cyclus = reken.bereik(land, "ci:x")
    assert geraakt == {"app:y", "proces:z"}
    assert not cyclus

    land["edges"].append({"from": "proces:z", "to": "ci:x", "relatie": "ondersteunt"})
    geraakt, cyclus = reken.bereik(land, "ci:x")
    assert cyclus
    assert reken.cyclus_waarschuwingen(land)


def test_bereik_met_voorvoegsel(reken, doorloop):
    land = reken.landschap(doorloop)
    geraakt, _ = reken.bereik(land, "ci:ci-net1")
    assert geraakt == {"ci:ci-db1", "app:A01", "app:A02", "proces:P01"}
    assert sorted(geraakt) == doorloop["verwacht"]["bereik_ci_net1"]


def test_impact_ranglijst_spof(reken, doorloop):
    land = reken.landschap(doorloop)
    assert [r["node_id"] for r in reken.ranglijst(land)] == doorloop["verwacht"]["ranglijst"]
    assert reken.ranglijst(land)[0]["node_id"] == "ci:ci-net1"
    eerste = reken.ranglijst(land)[0]
    assert (len(eerste["kritieke"]), len(eerste["processen"]), len(eerste["geraakt"])) == (1, 1, 4)
    assert reken.single_points(land) == ["proces:P02"] == doorloop["verwacht"]["single_points"]
    assert reken.cyclus_waarschuwingen(land) == []


def test_ranglijst_gelijk_aan_blast_radius(reken, voorbeeld):
    """Dezelfde volgorde als de CLI waar deze analyse uit komt, als die repo ernaast staat."""
    dossier = {"processen": [], "applicaties": [], "componenten": [], "component_edges": []}
    per_id = {n["id"]: n for n in voorbeeld["nodes"]}
    for node in voorbeeld["nodes"]:
        if node["type"] == "proces":
            dossier["processen"].append({"code": node["id"], "naam": node["label"],
                                         "kritiek": node.get("kritiek", False), "applicaties": []})
        elif node["type"] == "app":
            dossier["applicaties"].append({"code": node["id"], "naam": node["label"]})
        else:
            dossier["componenten"].append({"id": node["id"], "label": node["label"],
                                           "kritiek": node.get("kritiek", False)})
    for edge in voorbeeld["edges"]:
        if per_id[edge["from"]]["type"] == "app" and per_id[edge["to"]]["type"] == "proces":
            for proces in dossier["processen"]:
                if proces["code"] == edge["to"]:
                    proces["applicaties"].append(edge["from"])
        else:
            dossier["component_edges"].append({"from": edge["from"], "to": edge["to"]})
    land = reken.landschap(dossier)
    assert len(land["nodes"]) == 14
    assert len(land["edges"]) == 19

    buur = ROOT.parent / "blast-radius"
    if not (buur / "blastradius").is_dir():
        return
    import sys
    sys.path.insert(0, str(buur))
    from blastradius import analysis, parsers  # noqa: E402
    origineel = parsers.from_json((buur / "testdata" / "landschap.json").read_text(encoding="utf-8"))
    analyse = analysis.analyze(origineel)
    verwacht = [nid for nid, _ in analysis.ranglijst(analyse)]
    gekregen = [r["node_id"].split(":", 1)[1] for r in reken.ranglijst(land)]
    assert gekregen == verwacht
    assert [i.split(":", 1)[1] for i in reken.single_points(land)] == analysis.single_points(analyse)


def test_dekking(reken):
    dossier = {"processen": [{"code": "P1", "naam": "P1", "kritiek": True, "applicaties": ["A", "B"]},
                             {"code": "P2", "naam": "P2", "kritiek": True, "applicaties": []}],
               "applicaties": [{"code": "A", "naam": "A"}, {"code": "B", "naam": "B"}],
               "componenten": [], "component_edges": []}
    land = reken.landschap(dossier)
    assert reken.dekking(land, "proces:P1") == 2
    assert reken.dekking(land, "proces:P2") == 0
    assert reken.single_points(land) == ["proces:P2"]


def test_dragende_nodes(reken, doorloop):
    land = reken.landschap(doorloop)
    dragend = reken.dragende_nodes(land)
    assert dragend == doorloop["verwacht"]["dragende_nodes"]
    assert "ci:ci-los" not in dragend
    assert "app:A05" not in dragend
    assert "proces:P01" in dragend and "proces:P02" in dragend


def test_dragende_nodes_op_groot_landschap(reken, bron):
    groot = json.loads((FIXTURES / "landschap-groot.json").read_text(encoding="utf-8"))
    assert len(groot["nodes"]) == 200
    land = {"nodes": [{"id": n["type"] + ":" + n["id"], "label": n["label"], "type": n["type"],
                       "kritiek": bool(n.get("kritiek"))} for n in groot["nodes"]],
            "edges": [], "waarschuwingen": []}
    per_id = {n["id"]: n for n in groot["nodes"]}
    for edge in groot["edges"]:
        land["edges"].append({"from": per_id[edge["from"]]["type"] + ":" + edge["from"],
                              "to": per_id[edge["to"]]["type"] + ":" + edge["to"],
                              "relatie": "ondersteunt"})
    dragend = reken.dragende_nodes(land)
    assert len(groot["nodes"]) > bron["graaf_maximum"]
    assert 5 <= len(dragend) < len(land["nodes"])
    for node_id in dragend:
        if node_id.startswith("proces:"):
            continue
        assert reken.impact(land, node_id)["kritieke"], f"{node_id} draagt geen kritiek proces"


def test_kroonjuwelen(reken, bron, doorloop):
    juwelen = reken.kroonjuwelen(bron, doorloop)
    assert [j["code"] for j in juwelen] == ["P01", "P02"]
    assert juwelen[0]["klasse"] == 1
    assert juwelen[0]["klasse_label"] == "Catastrofaal"
    assert juwelen[0]["systemen"] == ["BRP (basisregistratie personen)", "Zaaksysteem",
                                      "Toegangscontrole publiekshal"]
    assert juwelen[1]["klasse"] is None


def test_reken_en_app_hebben_dezelfde_functies(app_js):
    py = (ROOT / "instrument" / "reken.py").read_text(encoding="utf-8")
    namen = [naam for naam in re.findall(r"^def (\w+)\(", py, re.M) if not naam.startswith("_")]
    assert len(namen) >= 25
    ontbreekt = [naam for naam in namen if f"reken.{naam} = " not in app_js]
    assert ontbreekt == [], f"app.js mist: {ontbreekt}"


def test_fixtures_zijn_reproduceerbaar():
    """maak_doorloop.py opnieuw draaien hoort dezelfde bestanden op te leveren."""
    import subprocess
    import sys as _sys
    voor = {naam: (FIXTURES / naam).read_bytes() for naam in
            ("doorloop-2026-09.json", "landschap.csv", "landschap-groot.json")}
    uit = subprocess.run([_sys.executable, str(FIXTURES / "maak_doorloop.py")], cwd=ROOT,
                         capture_output=True)
    assert uit.returncode == 0, uit.stderr.decode("utf-8", "replace")
    for naam, inhoud in voor.items():
        assert (FIXTURES / naam).read_bytes() == inhoud, f"{naam} veranderde bij opnieuw genereren"
