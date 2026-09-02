"""De deterministische kern van de AI-hulp, los van elke leverancier."""
from __future__ import annotations

import copy
import json
import re
import subprocess
import sys

from conftest import AI, FIXTURES, ROOT


def schema_van(opdrachten, naam):
    return [o for o in opdrachten["opdrachten"] if o["id"] == naam][0]["schema"]


def goed_item(**velden):
    basis = {"code": "P01", "naam": "Paspoortuitgifte", "beschrijving": "", "doelstelling": "", "eigenaar": "",
             "afdeling": "", "kritiek": False, "reden_kritiek": "", "bronregel": "Paspoort- en rijbewijsuitgifte."}
    basis.update(velden)
    return basis


def test_valideer(kern, opdrachten):
    schema = schema_van(opdrachten, "processen")
    assert kern.valideer(schema, {"items": [goed_item()], "onzeker": []}) == []
    zonder = goed_item(); del zonder["bronregel"]
    fouten = kern.valideer(schema, {"items": [zonder], "onzeker": []})
    assert fouten == ["items[0]: veld 'bronregel' ontbreekt"]
    extra = kern.valideer(schema, {"items": [goed_item(extra=1)], "onzeker": []})
    assert extra == ["items[0]: onbekend veld 'extra'"]
    assert "verwacht boolean" in kern.valideer(schema, {"items": [goed_item(kritiek="ja")], "onzeker": []})[0]
    assert "verwacht array" in kern.valideer(schema, {"items": [], "onzeker": "nee"})[0]
    app = schema_van(opdrachten, "applicaties")
    fout = kern.valideer(app, {"items": [{"code": "A01", "naam": "x", "beschrijving": "", "eigenaar_business": "",
                                          "eigenaar_technisch": "", "soort": "server", "bronregel": "x"}], "onzeker": []})
    assert "niet uit" in fout[0]


def test_strip_hekken_en_parse(kern, opdrachten):
    schema = schema_van(opdrachten, "processen")
    data = {"items": [goed_item()], "onzeker": []}
    assert kern.strip_hekken("```json\n" + json.dumps(data) + "\n```") == json.dumps(data)
    assert kern.strip_hekken("```\n{}\n```") == "{}"
    uit, fouten = kern.parse_antwoord(schema, "```json\n" + json.dumps(data) + "\n```")
    assert fouten == [] and uit == data
    uit, fouten = kern.parse_antwoord(schema, "Hier is de JSON: " + json.dumps(data))
    assert uit is None and fouten[0].startswith("geen geldige JSON")


def test_chunk(kern):
    alinea = "Dit is een alinea met wat tekst erin.\n" * 20
    tekst = "\n\n".join(f"Kop {i}\n" + alinea for i in range(60))
    stukken = kern.chunk(tekst, 24000)
    assert len(stukken) > 1
    assert all(len(s) <= 24000 for s in stukken)
    for stuk in stukken:
        assert "Dit is een alinea met wat tekst erin." in stuk
        assert not stuk.endswith("Dit is een alinea met wat")   # nooit midden in een regel
    assert kern.chunk("klein", 24000) == ["klein"]
    assert kern.chunk("   \n", 24000) == []
    lange_alinea = "\n".join("regel %d" % i for i in range(8000))
    assert all(len(s) <= 24000 for s in kern.chunk(lange_alinea, 24000))
    assert len(kern.chunk(lange_alinea, 24000)) > 1


def test_voeg_stukken_samen(kern, opdrachten):
    opdracht = [o for o in opdrachten["opdrachten"] if o["id"] == "processen"][0]
    a = {"items": [goed_item(code="P01"), goed_item(code="P03")], "onzeker": ["x"]}
    b = {"items": [goed_item(code="P03", naam="Ander")], "onzeker": ["x", "y"]}
    samen = kern.voeg_stukken_samen(opdracht, [a, b])
    assert [i["code"] for i in samen["items"]] == ["P01", "P03", "P03-2"]
    assert samen["onzeker"] == ["x", "y"]
    assert samen["waarschuwingen"] and "P03" in samen["waarschuwingen"][0]


def test_csv_en_xlsx_naar_tekst(kern):
    csv = kern.csv_naar_tekst((FIXTURES / "voorbeeld-cmdb.csv").read_text(encoding="utf-8"))
    xlsx = kern.xlsx_naar_tekst((FIXTURES / "voorbeeld-cmdb.xlsx").read_bytes())
    assert csv == xlsx
    assert csv.startswith("| id | naam | type |")
    assert "Zaaksysteem" in csv and "|---|" in csv
    assert kern.csv_naar_tekst('a,b\n"x, y","z ""q"""\n') == "| a | b |\n|---|---|\n| x, y | z \"q\" |\n"


def test_xlsx_met_gedeelde_strings(kern, tmp_path):
    """Echte exports gebruiken sharedStrings; de lezer moet die ook aankunnen."""
    openpyxl = __import__("pytest").importorskip("openpyxl")
    wb = openpyxl.Workbook(); ws = wb.active
    ws.append(["id", "naam"]); ws.append(["A01", "Zaaksysteem"]); ws.append(["A02", "BRP"])
    pad = tmp_path / "t.xlsx"; wb.save(pad)
    assert kern.xlsx_naar_rijen(pad.read_bytes()) == [["id", "naam"], ["A01", "Zaaksysteem"], ["A02", "BRP"]]


def test_bronregel_klopt(kern):
    invoer = "## Afdeling\n\n**Paspoort- en rijbewijsuitgifte.** Inwoners vragen aan de balie\neen paspoort aan.\n| a | b |\n"
    assert kern.bronregel_klopt({"bronregel": "Paspoort- en rijbewijsuitgifte."}, invoer)
    assert kern.bronregel_klopt({"bronregel": "Inwoners vragen aan de balie een paspoort aan."}, invoer)  # over een regeleinde
    assert kern.bronregel_klopt({"bronregel": "a b"}, invoer)   # tabelcellen zonder de strepen
    assert not kern.bronregel_klopt({"bronregel": "Dit staat er niet."}, invoer)
    # Een citaat dat stukken overslaat mag; een citaat met een verzonnen zin erin niet.
    assert kern.bronregel_klopt({"bronregel": "Paspoort- en rijbewijsuitgifte. een paspoort aan."}, invoer)
    assert not kern.bronregel_klopt({"bronregel": "Inwoners vragen aan de balie. Dit is verzonnen tekst."}, invoer)
    assert not kern.bronregel_klopt({"bronregel": ""}, invoer)


def test_vergelijk(kern, doorloop):
    voorstel = {"opdracht": "processen", "items": [
        goed_item(code="P01", naam="Paspoort- en rijbewijsuitgifte"),      # code en naam bestaan
        goed_item(code="P99", naam="Vergunningverlening"),                 # naam bestaat onder P05
        goed_item(code="P02", naam="Iets heel anders"),                    # code bestaat, andere naam
        goed_item(code="P42", naam="Nieuw proces"),                         # nieuw
    ]}
    uit = kern.vergelijk(doorloop, voorstel)
    assert [(r["sleutel"], r["status"], r["huidig_code"]) for r in uit] == [
        ("P01", "bestaand", "P01"), ("P99", "bestaand", "P05"), ("P02", "conflict", "P02"), ("P42", "nieuw", None)]
    met_bron = kern.vergelijk(doorloop, voorstel, invoer="Nergens dit citaat.")
    assert all(r["status"] == "niet_in_bron" for r in met_bron)


def test_pas_toe_processen(kern, doorloop):
    voorstel = {"opdracht": "processen", "leverancier": "mistral", "model": "m", "gemaakt": "2026-09-03",
                "invoer": {"sha256": "abc"}, "items": [
                    goed_item(code="P42", naam="Nieuw proces", eigenaar="X"),
                    goed_item(code="P03", naam="Gemeentelijke belastinginning", doelstelling="Inning", eigenaar="ANDER"),
                    goed_item(code="P02", naam="Iets heel anders")]}
    origineel = copy.deepcopy(doorloop)
    nieuw, telling = kern.pas_toe(doorloop, voorstel, {})
    assert doorloop == origineel, "het oude dossier is aangeraakt"
    assert telling == {"overgenomen": 1, "samengevoegd": 1, "overgeslagen": 1}
    codes = [p["code"] for p in nieuw["processen"]]
    assert "P42" in codes and len(codes) == 7
    p03 = [p for p in nieuw["processen"] if p["code"] == "P03"][0]
    assert p03["doelstelling"] == "Inning"          # leeg veld gevuld
    assert p03["eigenaar"] == "K. Bakker"            # gevuld veld blijft staan
    p02 = [p for p in nieuw["processen"] if p["code"] == "P02"][0]
    assert p02["naam"] == "Uitkeringen Werk en Inkomen"   # conflict overgeslagen
    assert nieuw["herkomst_ai"][0]["overgenomen"] == 1 and nieuw["herkomst_ai"][0]["invoer_sha256"] == "abc"
    alles, telling = kern.pas_toe(doorloop, voorstel, {"P02": "overnemen", "P03": "overslaan", "P42": "overslaan"})
    assert telling == {"overgenomen": 1, "samengevoegd": 0, "overgeslagen": 2}
    assert [p for p in alles["processen"] if p["code"] == "P02"][0]["naam"] == "Iets heel anders"


def test_pas_toe_landschap(kern, doorloop, antwoorden):
    voorstel = dict(antwoorden["landschap"], opdracht="landschap", leverancier="mistral", model="m",
                    gemaakt="2026-09-03", invoer={"sha256": "x"})
    nieuw, telling = kern.pas_toe(doorloop, voorstel, {})
    assert telling["overgenomen"] > 0
    ci = {c["id"] for c in nieuw["componenten"]}
    assert len(ci) >= len(doorloop["componenten"])
    # De doorloop bevat zelf al een dubbele edge (bewust); wat erbij komt mag niet dubbel zijn.
    oud_aantal = len(doorloop["component_edges"])
    nieuwe = [(e["from"], e["to"]) for e in nieuw["component_edges"][oud_aantal:]]
    assert len(nieuwe) == len(set(nieuwe)), "dubbele edges toegevoegd"
    assert not any(p in {(e["from"], e["to"]) for e in doorloop["component_edges"]} for p in nieuwe)
    # Twee keer toepassen voegt niets meer toe.
    nogmaals, telling2 = kern.pas_toe(nieuw, voorstel, {})
    assert telling2["overgenomen"] == 0


def test_kern_en_js_zelfde_functies():
    py = (AI / "kern.py").read_text(encoding="utf-8")
    js = (AI / "bron" / "kern.js").read_text(encoding="utf-8")
    namen = [n for n in re.findall(r"^def (\w+)\(", py, re.M) if not n.startswith("_")]
    assert len(namen) >= 12
    ontbreekt = [n for n in namen if f"kern.{n} = " not in js]
    assert ontbreekt == [], f"kern.js mist: {ontbreekt}"
    assert "fetch(" not in js, "kern.js gaat mee in de tool en mag geen netwerk kennen"


def test_fixtures_zijn_reproduceerbaar():
    voor = {n: (FIXTURES / n).read_bytes() for n in ("voorbeeld-processen.md", "voorbeeld-cmdb.csv", "voorbeeld-cmdb.xlsx")}
    uit = subprocess.run([sys.executable, str(FIXTURES / "maak_fixtures.py")], cwd=ROOT, capture_output=True)
    assert uit.returncode == 0, uit.stderr.decode("utf-8", "replace")
    for n, inhoud in voor.items():
        assert (FIXTURES / n).read_bytes() == inhoud, f"{n} veranderde"
