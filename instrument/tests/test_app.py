"""De pagina in een echte browser: invullen, rekenen, importeren, opslaan, terugladen, afdrukken.

Deze tests bewijzen wat een unit-test niet kan: dat wat op het scherm staat exact gelijk is aan
instrument/reken.py. Loopt de app weg van de referentie, dan valt dat hier om.

Overslaan als Playwright of de browser ontbreekt; CI installeert beide.
"""
from __future__ import annotations

import json
import pathlib
import sys

import pytest

HIER = pathlib.Path(__file__).resolve().parent
ROOT = HIER.parent.parent
FIXTURES = HIER / "fixtures"
sys.path.insert(0, str(ROOT / "instrument"))

import bouw as bouwer  # noqa: E402
import reken  # noqa: E402

sync_api = pytest.importorskip("playwright.sync_api", reason="playwright niet beschikbaar")


@pytest.fixture(scope="module")
def bestand(tmp_path_factory) -> str:
    return bouwer.bouw(tmp_path_factory.mktemp("dist")).as_uri()


@pytest.fixture(scope="module")
def data() -> dict:
    return json.loads((ROOT / "procescheck.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def doorloop_data() -> dict:
    return json.loads((FIXTURES / "doorloop-2026-09.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="module")
def browser():
    with sync_api.sync_playwright() as pw:
        try:
            gestart = pw.chromium.launch()
        except Exception as fout:                       # geen browser geinstalleerd
            pytest.skip(f"chromium niet beschikbaar: {fout}")
        yield gestart
        gestart.close()


@pytest.fixture
def pagina(browser, bestand):
    context = browser.new_context()
    blad = context.new_page()
    fouten: list[str] = []
    blad.on("pageerror", lambda e: fouten.append(str(e)))
    blad.on("console", lambda m: fouten.append(m.text) if m.type == "error" else None)
    blad.goto(bestand)
    blad.evaluate("() => window.localStorage.clear()")
    blad.reload()
    yield blad
    assert not fouten, f"fouten in de browser: {fouten}"
    context.close()


def naar(blad, tab: str) -> None:
    blad.click(f"#tab-{tab}")


def nieuw_proces(blad, code, naam="Proces", kritiek=False, **velden) -> None:
    naar(blad, "processen")
    blad.click("#knop-proces-nieuw")
    blad.fill("#p-code", code)
    blad.fill("#p-naam", naam)
    if kritiek:
        blad.check("#p-kritiek")
    for veld, waarde in velden.items():
        blad.fill("#p-" + veld.replace("_", "-"), waarde)
    blad.click("#p-opslaan")


def nieuwe_app(blad, code, naam="Applicatie") -> None:
    naar(blad, "applicaties")
    blad.click("#knop-app-nieuw")
    blad.fill("#a-code", code)
    blad.fill("#a-naam", naam)
    blad.click("#a-opslaan")


def tellers(blad) -> dict[str, str]:
    return blad.evaluate(
        "() => Object.fromEntries(Array.from(document.querySelectorAll('[data-teller]'))"
        ".map(e => [e.getAttribute('data-teller'), e.textContent]))")


def dossier_uit(blad) -> dict:
    return json.loads(blad.evaluate("() => window.localStorage.getItem('procescheck-dossier')"))


def laad_dossier(blad, dossier: dict) -> None:
    """Zet een dossier in de opslag en herlaad, alsof de gebruiker het bestand had geladen."""
    blad.evaluate("(tekst) => window.localStorage.setItem('procescheck-dossier', tekst)",
                  json.dumps(dossier))
    blad.reload()


# ---------------------------------------------------------------- de schermen

def test_startscherm(pagina):
    assert pagina.is_visible("#scherm-processen")
    assert pagina.locator('[role="tab"]').count() == 7
    assert "0 processen" in pagina.text_content("#dossier-status")


def test_proces_aanmaken_wijzigen_verwijderen(pagina):
    nieuw_proces(pagina, "P01", "Paspoortuitgifte")
    assert pagina.locator('tr[data-proces="P01"]').count() == 1
    assert "Paspoortuitgifte" in pagina.text_content('tr[data-proces="P01"]')

    pagina.click('tr[data-proces="P01"] .bewerk')
    pagina.fill("#p-naam", "Paspoort- en rijbewijsuitgifte")
    pagina.click("#p-opslaan")
    assert "rijbewijs" in pagina.text_content('tr[data-proces="P01"]')

    pagina.click("#knop-proces-nieuw")
    pagina.fill("#p-code", "P01")
    pagina.click("#p-opslaan")
    assert "bestaat al" in pagina.text_content("#p-melding")
    assert pagina.locator("tr[data-proces]").count() == 1

    pagina.click("#p-annuleren")
    pagina.on("dialog", lambda d: d.accept())
    pagina.click('tr[data-proces="P01"] .verwijder')
    assert pagina.locator("tr[data-proces]").count() == 0


def test_applicatie_koppelen_en_verwijderen(pagina):
    nieuwe_app(pagina, "A01", "Zaaksysteem")
    nieuw_proces(pagina, "P01", "Paspoortuitgifte")
    pagina.click('tr[data-proces="P01"] .bewerk')
    pagina.select_option("#p-applicaties", ["A01"])
    pagina.click("#p-opslaan")
    assert dossier_uit(pagina)["processen"][0]["applicaties"] == ["A01"]
    naar(pagina, "applicaties")
    assert "1" in pagina.text_content('tr[data-app="A01"]')

    pagina.on("dialog", lambda d: d.accept())
    pagina.click('tr[data-app="A01"] .verwijder')
    assert dossier_uit(pagina)["processen"][0]["applicaties"] == []


def test_bia_rekent(pagina, data):
    nieuw_proces(pagina, "P01", "Paspoortuitgifte")
    naar(pagina, "bia")
    pagina.select_option("#bia-proces", "P01")
    for vraag, score in (("b1", 3), ("b2", 2), ("b3", 5), ("b4", 4), ("i1", 4), ("v1", 1)):
        pagina.select_option(f'[data-score="{vraag}"]', str(score))
    assert pagina.text_content("#bia-b") == "2"
    assert pagina.text_content("#bia-i") == "4"
    assert pagina.text_content("#bia-v") == "1"
    assert "Catastrofaal" in pagina.text_content("#bia-klasse")
    assert pagina.text_content("#bia-rto") == "Maximaal 2 werkdagen"
    assert pagina.text_content("#bia-rpo") == "4 tot 8 uur"
    assert pagina.text_content("#bia-wrt") == "Meer dan een week"
    assert pagina.text_content("#bia-mtpd") == "1 week"
    assert "Geheim" in pagina.text_content('[data-info="v1"]')


def test_bia_incompleet(pagina):
    nieuw_proces(pagina, "P01")
    naar(pagina, "bia")
    pagina.select_option("#bia-proces", "P01")
    pagina.select_option('[data-score="i1"]', "3")
    assert pagina.text_content("#bia-b") == "-"
    assert pagina.text_content("#bia-i") == "3"
    assert "Gemiddeld" in pagina.text_content("#bia-klasse")


def test_bia_leeg_is_null(pagina):
    nieuw_proces(pagina, "P01")
    naar(pagina, "bia")
    pagina.select_option("#bia-proces", "P01")
    pagina.select_option('[data-score="b1"]', "3")
    assert dossier_uit(pagina)["processen"][0]["bia"]["b1"] == 3
    pagina.select_option('[data-score="b1"]', "")
    assert dossier_uit(pagina)["processen"][0]["bia"]["b1"] is None


def test_context_bewaart(pagina):
    nieuw_proces(pagina, "P01")
    naar(pagina, "context")
    pagina.select_option("#context-proces", "P01")
    pagina.fill('[data-context="partners"]', "Ketenpartners in de regio")
    pagina.check("#context-persoonsgegevens")
    context = dossier_uit(pagina)["processen"][0]["context"]
    assert context["partners"] == "Ketenpartners in de regio"
    assert context["persoonsgegevens"] is True


def test_dashboard_gelijk_aan_referentie(pagina, data, doorloop_data):
    laad_dossier(pagina, doorloop_data)
    naar(pagina, "dashboard")
    stand = reken.dashboard(data, doorloop_data, doorloop_data["verwacht"]["vandaag"])
    gekregen = tellers(pagina)

    for sleutel in ("totaal", "kritiek", "compleet", "aandacht", "onvolledig", "hoog_risico"):
        assert gekregen[sleutel] == str(stand[sleutel]), sleutel
    for dim in ("B", "I", "V"):
        for score in ("1", "2", "3", "4", "5", "leeg"):
            assert gekregen[f"verdeling.{dim}.{score}"] == str(stand["verdeling"][dim][score])
    for naam in ("bia", "rto_rpo", "context", "applicaties"):
        assert gekregen[f"dekking.{naam}.done"] == str(stand["dekking"][naam]["done"])
        assert gekregen[f"dekking.{naam}.total"] == str(stand["dekking"][naam]["total"])
        assert gekregen[f"dekking.{naam}.pct"] == f'{stand["dekking"][naam]["pct"]}%'
    for naam in ("processen", "bia", "context", "applicaties"):
        assert gekregen[f"review.{naam}.on_time"] == str(stand["review"][naam]["on_time"])
        assert gekregen[f"review.{naam}.pct"] == f'{stand["review"][naam]["pct"]}%'
    assert gekregen["privacy.persoonsgegevens"] == str(stand["privacy"]["persoonsgegevens"])
    assert gekregen["privacy.bijzonder"] == str(stand["privacy"]["bijzonder"])

    codes = pagina.eval_on_selector_all(
        "tr[data-prioriteit]", "rijen => rijen.map(r => r.getAttribute('data-prioriteit'))")
    assert codes == [r["code"] for r in stand["prioriteiten"]]
    for regel in stand["prioriteiten"]:
        rij = pagina.text_content(f'tr[data-prioriteit="{regel["code"]}"]')
        assert regel["prioriteit"] in rij
        assert regel["reden"] in rij


def test_dashboard_percentages_ronden_half_omhoog(pagina, data):
    """1 van 8 is 12,5 procent; dat hoort 13 te worden, aan beide kanten."""
    for i in range(1, 9):
        nieuw_proces(pagina, f"P{i:02d}")
    naar(pagina, "bia")
    pagina.select_option("#bia-proces", "P01")
    pagina.select_option('[data-score="b1"]', "3")
    naar(pagina, "dashboard")
    assert tellers(pagina)["dekking.bia.pct"] == "13%"
    assert reken.procent(1, 8) == 13


def test_prioriteit_op_scherm(pagina):
    nieuw_proces(pagina, "P01", "Kritiek proces", kritiek=True)
    assert "critical" in pagina.text_content('tr[data-proces="P01"] .prioriteit')
    naar(pagina, "dashboard")
    rij = pagina.text_content('tr[data-prioriteit="P01"]')
    assert "critical" in rij and "Informatie ontbreekt" in rij
    assert pagina.locator('tr[data-kritiek="P01"]').count() == 1


def test_landschap_import_json(pagina, data):
    naar(pagina, "blast")
    pagina.click("#knop-landschap-voorbeeld")
    dossier = dossier_uit(pagina)
    assert len(dossier["componenten"]) == 7
    assert len(dossier["processen"]) == 3
    assert len(dossier["applicaties"]) == 4
    assert pagina.locator("tr[data-blast]").count() == 11

    land = reken.landschap(dossier)
    assert pagina.locator("li[data-spof]").count() == len(reken.single_points(land))
    # In dit voorbeeld dragen twee applicaties elk kritiek proces; de lijst zegt dat met zoveel woorden.
    assert reken.single_points(land) == []
    assert "Geen kritiek proces" in pagina.text_content("#blast-spof")
    verwacht = [r["node_id"] for r in reken.ranglijst(land)]
    gekregen = pagina.eval_on_selector_all(
        "tr[data-blast]", "rijen => rijen.map(r => r.getAttribute('data-blast'))")
    assert gekregen == verwacht


def test_landschap_import_csv(pagina):
    naar(pagina, "blast")
    pagina.set_input_files("#bestand-landschap", str(FIXTURES / "landschap.csv"))
    pagina.wait_for_function("() => document.querySelectorAll('tr[data-component]').length === 7")
    dossier = dossier_uit(pagina)
    assert len(dossier["componenten"]) == 7
    assert len(dossier["processen"]) == 3
    assert len(dossier["applicaties"]) == 4
    assert any(p["kritiek"] for p in dossier["processen"])


def test_landschap_import_twee_keer(pagina):
    naar(pagina, "blast")
    pagina.click("#knop-landschap-voorbeeld")
    eerst = dossier_uit(pagina)
    pagina.click("#knop-landschap-voorbeeld")
    nogmaals = dossier_uit(pagina)
    assert len(nogmaals["componenten"]) == len(eerst["componenten"])
    assert len(nogmaals["component_edges"]) == len(eerst["component_edges"])
    assert len(nogmaals["processen"]) == len(eerst["processen"])
    assert [p["applicaties"] for p in nogmaals["processen"]] == \
        [p["applicaties"] for p in eerst["processen"]]


def test_landschap_match_op_bestaand(pagina):
    nieuw_proces(pagina, "P01", "Paspoort- en rijbewijsuitgifte")
    naar(pagina, "blast")
    pagina.click("#knop-landschap-voorbeeld")
    dossier = dossier_uit(pagina)
    namen = [p["naam"] for p in dossier["processen"]]
    assert namen.count("Paspoort- en rijbewijsuitgifte") == 1
    proces = [p for p in dossier["processen"] if p["code"] == "P01"][0]
    assert sorted(proces["applicaties"]) == ["app-brp", "app-zaak"]
    assert "herkend" in pagina.text_content("#landschap-melding")


def test_blast_graaf(pagina):
    naar(pagina, "blast")
    pagina.click("#knop-landschap-voorbeeld")
    dossier = dossier_uit(pagina)
    land = reken.landschap(dossier)
    assert pagina.locator("#blast-graaf [data-node]").count() == len(land["nodes"])

    # De relatie binnen een kolom (ci naar ci) is een gebogen pad, geen rechte lijn.
    binnen = pagina.locator('#blast-graaf path[data-edge="ci:ci-netwerk|ci:ci-db-brp"]')
    assert binnen.count() == 1
    tussen = pagina.locator('#blast-graaf line[data-edge="ci:ci-db-brp|app:app-brp"]')
    assert tussen.count() == 1

    pagina.click('#blast-graaf [data-node="ci:ci-netwerk"]')
    geraakt, _ = reken.bereik(land, "ci:ci-netwerk")
    for node_id in sorted(geraakt):
        klasse = pagina.get_attribute(f'#blast-graaf [data-node="{node_id}"]', "class")
        assert "geraakt" in klasse, f"{node_id} hoort geraakt te zijn"
    assert "gekozen" in pagina.get_attribute('#blast-graaf [data-node="ci:ci-netwerk"]', "class")


def test_blast_graaf_groot(pagina, data):
    groot = json.loads((FIXTURES / "landschap-groot.json").read_text(encoding="utf-8"))
    naar(pagina, "blast")
    pagina.set_input_files("#bestand-landschap", str(FIXTURES / "landschap-groot.json"))
    pagina.wait_for_function("() => document.querySelectorAll('tr[data-blast]').length > 100",
                             timeout=15000)
    dossier = dossier_uit(pagina)
    land = reken.landschap(dossier)
    assert len(land["nodes"]) == len(groot["nodes"])
    assert pagina.locator("tr[data-blast]").count() == 180
    getekend = pagina.locator("#blast-graaf [data-node]").count()
    assert getekend == len(reken.dragende_nodes(land))
    assert getekend < len(land["nodes"])
    assert str(data["graaf_maximum"]) in pagina.text_content("#graaf-melding")


def test_opslaan_laden_wissen_herladen(pagina, tmp_path):
    pagina.fill("#org-naam", "Gemeente Voorbeeld")
    nieuw_proces(pagina, "P01", "Paspoortuitgifte", kritiek=True)
    nieuwe_app(pagina, "A01", "Zaaksysteem")

    with pagina.expect_download() as download:
        pagina.click("#knop-opslaan")
    bestand = download.value
    assert bestand.suggested_filename.startswith("procescheck-dossier-gemeente-voorbeeld-")
    doel = tmp_path / "dossier.json"
    bestand.save_as(str(doel))
    opgeslagen = json.loads(doel.read_text(encoding="utf-8"))
    assert opgeslagen["formaat"] == "procescheck-dossier"
    assert opgeslagen["processen"][0]["code"] == "P01"

    pagina.on("dialog", lambda d: d.accept())
    pagina.click("#knop-wissen")
    assert pagina.locator("tr[data-proces]").count() == 0

    pagina.set_input_files("#bestand-laden", str(doel))
    pagina.wait_for_selector('tr[data-proces="P01"]', state="attached")
    naar(pagina, "processen")
    assert pagina.is_visible('tr[data-proces="P01"]')
    assert pagina.input_value("#org-naam") == "Gemeente Voorbeeld"

    pagina.reload()
    assert pagina.locator('tr[data-proces="P01"]').count() == 1


def test_bestandsnaam_zonder_organisatie(pagina):
    nieuw_proces(pagina, "P01")
    with pagina.expect_download() as download:
        pagina.click("#knop-opslaan")
    assert download.value.suggested_filename.startswith("procescheck-dossier-organisatie-")
    assert download.value.suggested_filename.endswith(".json")


def test_laden_weigert_verkeerd_bestand(pagina, tmp_path):
    verkeerd = tmp_path / "verkeerd.json"
    verkeerd.write_text('{"formaat": "iets anders"}', encoding="utf-8")
    pagina.set_input_files("#bestand-laden", str(verkeerd))
    pagina.wait_for_selector("#dossier-status.let-op")
    assert "geen procescheck-dossier" in pagina.text_content("#dossier-status")


def test_laden_meldt_andere_bronversie(pagina, tmp_path, doorloop_data):
    ander = dict(doorloop_data)
    ander["bron_sha256"] = "a" * 64
    bestand = tmp_path / "ander.json"
    bestand.write_text(json.dumps(ander), encoding="utf-8")
    pagina.set_input_files("#bestand-laden", str(bestand))
    pagina.wait_for_selector("#dossier-status.let-op")
    assert "andere versie van de bron" in pagina.text_content("#dossier-status")


def test_uitdraai_kroonjuwelen(pagina):
    nieuw_proces(pagina, "P01", "Zwaar proces", kritiek=True)
    nieuw_proces(pagina, "P02", "Minder zwaar proces", kritiek=True)
    nieuw_proces(pagina, "P03", "Gewoon proces")
    naar(pagina, "bia")
    pagina.select_option("#bia-proces", "P01")
    pagina.select_option('[data-score="i1"]', "1")
    pagina.select_option("#bia-proces", "P02")
    pagina.select_option('[data-score="i1"]', "2")
    naar(pagina, "uitdraai")
    tekst = pagina.text_content("#uitdraai-inhoud")
    kop = tekst.index("3 Kroonjuwelen")
    stuk = tekst[kop:tekst.index("4 Processen")]
    assert "Zwaar proces" in stuk
    assert "Minder zwaar proces" in stuk
    assert "Gewoon proces" not in stuk
    assert stuk.index("Zwaar proces") < stuk.index("Minder zwaar proces")


def test_uitdraai_bevat_alles(pagina, doorloop_data):
    laad_dossier(pagina, doorloop_data)
    naar(pagina, "uitdraai")
    tekst = pagina.text_content("#uitdraai-inhoud")
    assert "Gemeente Voorbeeld" in tekst
    for proces in doorloop_data["processen"]:
        assert proces["code"] in tekst
    for app in doorloop_data["applicaties"]:
        assert app["naam"] in tekst
    assert "Informatie ontbreekt" in tekst
    assert "netwerk-core (kernswitch)" in tekst
    vinger = pagina.evaluate("() => window.__BRON__.vingerafdruk")
    assert vinger in tekst
    for kop in ("1 Organisatie", "2 Dashboard", "3 Kroonjuwelen", "4 Processen",
                "5 BIA en BIV per proces", "6 Businesscontext per proces", "7 Applicaties",
                "8 Blast radius", "9 Verantwoording"):
        assert kop in tekst


def test_voorstel_laden_in_de_tool(pagina, tmp_path, doorloop_data):
    laad_dossier(pagina, doorloop_data)
    antwoord = json.loads((ROOT / "ai" / "tests" / "fixtures" / "antwoorden" / "processen-voorbeeld.json").read_text(encoding="utf-8"))
    voorstel = {"formaat": "procescheck-voorstel", "versie": 1, "tool": "procescheck", "opdrachten_versie": "2026-09",
                "opdracht": "processen", "gemaakt": "2026-09-03", "leverancier": "mistral", "model": "mistral-medium-latest",
                "invoer": {"naam": "voorbeeld-processen.md", "sha256": "a" * 64, "tekens": 100, "aanroepen": 1},
                "items": antwoord["items"], "onzeker": antwoord["onzeker"], "waarschuwingen": []}
    # Een item dat botst met het dossier: P01 bestaat daar met een andere naam.
    voorstel["items"][0]["code"] = "P02"
    voorstel["items"][0]["naam"] = "Heel iets anders"
    bestand = tmp_path / "voorstel.json"
    bestand.write_text(json.dumps(voorstel, ensure_ascii=False), encoding="utf-8")
    pagina.set_input_files("#bestand-voorstel", str(bestand))
    pagina.wait_for_selector("#scherm-voorstel:not([hidden])")
    assert pagina.locator("tr[data-voorstel]").count() == len(voorstel["items"])
    assert "conflict" in pagina.text_content('tr[data-voorstel="P02"] td.status')
    assert pagina.input_value('select[data-keuze="P02"]') == "overslaan"
    sys.path.insert(0, str(ROOT / "ai"))
    import kern as ai_kern
    vergelijking = ai_kern.vergelijk(doorloop_data, voorstel)
    nieuw = [r["sleutel"] for r in vergelijking if r["status"] == "nieuw"]
    assert nieuw, "de fixture hoort minstens een nieuw proces te bevatten"
    for regel in vergelijking:
        assert pagina.input_value(f'select[data-keuze="{regel["sleutel"]}"]') == ai_kern.standaardkeuze(regel["status"])

    pagina.click("#knop-overnemen")
    pagina.wait_for_selector("#scherm-processen:not([hidden])")
    dossier = dossier_uit(pagina)
    codes = {p["code"] for p in dossier["processen"]}
    assert set(nieuw) <= codes
    assert [p for p in dossier["processen"] if p["code"] == "P02"][0]["naam"] == "Uitkeringen Werk en Inkomen"
    assert len(dossier["herkomst_ai"]) == 1
    assert dossier["herkomst_ai"][0]["opdracht"] == "processen"
    assert dossier["herkomst_ai"][0]["overgenomen"] == len(nieuw)
    assert "overgenomen" in pagina.text_content("#dossier-status")
    naar(pagina, "uitdraai")
    assert "Overgenomen uit de AI-hulp" in pagina.text_content("#uitdraai-inhoud")


def test_voorstel_weigert_andere_tool(pagina, tmp_path):
    bestand = tmp_path / "ander.json"
    bestand.write_text(json.dumps({"formaat": "procescheck-voorstel", "versie": 1, "tool": "csir", "opdracht": "processen",
                                   "items": []}), encoding="utf-8")
    pagina.set_input_files("#bestand-voorstel", str(bestand))
    pagina.wait_for_selector("#dossier-status.let-op")
    assert "andere tool" in pagina.text_content("#dossier-status")
    assert pagina.is_hidden("#scherm-voorstel")


def test_tool_doet_geen_netwerk(pagina, doorloop_data):
    verzoeken = []
    pagina.on("request", lambda r: verzoeken.append(r.url) if not r.url.startswith("file:") and not r.url.startswith("data:") else None)
    laad_dossier(pagina, doorloop_data)
    for tab in ("processen", "applicaties", "bia", "context", "blast", "dashboard", "uitdraai"):
        naar(pagina, tab)
    naar(pagina, "blast")
    pagina.click("#knop-landschap-voorbeeld")
    assert verzoeken == [], verzoeken
    assert pagina.get_attribute("#knop-ai", "href") == "ai/"


def test_afdrukken_toont_uitdraai(pagina):
    nieuw_proces(pagina, "P01")
    naar(pagina, "processen")
    pagina.emulate_media(media="print")
    assert pagina.is_visible("#scherm-uitdraai")
    assert not pagina.is_visible("#scherm-processen")
    pagina.emulate_media(media="screen")
