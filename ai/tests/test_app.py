"""De AI-pagina in een echte browser, met de leverancier nagespeeld: geen sleutel, geen netwerk.

Elke test onderschept /v1/models en /v1/chat/completions met page.route en geeft de vastgelegde
antwoorden terug. Een aanroep die niet onderschept wordt, loopt tegen het CSP aan en geeft een
consolefout, en daar valt de test op om.
"""
from __future__ import annotations

import json
import pathlib
import sys

import pytest

from conftest import AI, FIXTURES

sys.path.insert(0, str(AI))
import bouw as bouwer  # noqa: E402
import kern  # noqa: E402

sync_api = pytest.importorskip("playwright.sync_api", reason="playwright niet beschikbaar")

BASIS = "https://api.mistral.ai"


@pytest.fixture(scope="module")
def bestand(tmp_path_factory) -> str:
    return bouwer.bouw(tmp_path_factory.mktemp("ai-dist")).as_uri()


@pytest.fixture(scope="module")
def browser():
    with sync_api.sync_playwright() as pw:
        try:
            gestart = pw.chromium.launch()
        except Exception as fout:
            pytest.skip(f"chromium niet beschikbaar: {fout}")
        yield gestart
        gestart.close()


@pytest.fixture
def pagina(browser, bestand):
    context = browser.new_context()
    blad = context.new_page()
    fouten: list[str] = []
    blad.on("pageerror", lambda e: fouten.append(str(e)))
    # Een 400, 401 of 429 van de nagespeelde leverancier is de bedoeling van de test, geen fout.
    blad.on("console", lambda m: fouten.append(m.text)
            if m.type == "error" and not m.text.startswith("Failed to load resource: the server responded")
            else None)
    blad.goto(bestand)
    blad.evaluate("() => { window.localStorage.clear(); window.sessionStorage.clear(); }")
    blad.reload()
    yield blad
    assert not fouten, f"fouten in de browser: {fouten}"
    context.close()


class Leverancier:
    """Speelt de endpoint na en telt de aanroepen."""

    def __init__(self, blad, antwoorden):
        self.aanroepen: list[dict] = []
        self.antwoorden = list(antwoorden)   # per aanroep: dict (200 JSON), int (status) of str (ruwe tekst)
        blad.route(f"{BASIS}/v1/models", lambda route: route.fulfill(status=200, content_type="application/json",
                                                                       body='{"data": []}'))
        blad.route(f"{BASIS}/v1/chat/completions", self._chat)

    def _chat(self, route):
        verzoek = route.request
        self.aanroepen.append({"headers": verzoek.headers, "body": json.loads(verzoek.post_data)})
        volgende = self.antwoorden.pop(0) if self.antwoorden else self.antwoorden_standaard
        if isinstance(volgende, int):
            route.fulfill(status=volgende, content_type="application/json", body='{"message": "nee"}')
            return
        inhoud = volgende if isinstance(volgende, str) else json.dumps(volgende, ensure_ascii=False)
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"choices": [{"message": {"role": "assistant", "content": inhoud}}]}))

    antwoorden_standaard = {"items": [], "onzeker": []}


def antwoord(naam: str) -> dict:
    data = json.loads((FIXTURES / "antwoorden" / f"{naam}-voorbeeld.json").read_text(encoding="utf-8"))
    return {k: v for k, v in data.items() if k != "waarschuwingen"}


def verbind(blad, sleutel="test-sleutel"):
    blad.fill("#lev-sleutel", sleutel)
    blad.click("#knop-verbinding")
    blad.wait_for_selector("#lev-status.status-ok")


def kies(blad, opdracht: str, tekst: str | None = None, bestand: pathlib.Path | None = None):
    blad.select_option("#opdracht-keuze", opdracht)
    if bestand is not None:
        blad.set_input_files("#invoer-bestand", str(bestand))
        blad.wait_for_function("() => document.getElementById('invoer-tekst').value.length > 0")
    else:
        blad.fill("#invoer-tekst", tekst)
    blad.check("#toestemming")


def actief(blad, stap: str) -> bool:
    return blad.get_attribute(f"#stap-{stap}", "data-actief") == "ja"


# ---------------------------------------------------------------- de stappen

def test_start_zonder_sleutel(pagina):
    assert actief(pagina, "leverancier")
    for stap in ("opdracht", "invoer", "toestemming", "uitvoeren", "voorstel", "verder"):
        assert not actief(pagina, stap), stap
    assert pagina.is_disabled("#knop-verbinding")
    assert pagina.input_value("#lev-basis") == BASIS
    assert pagina.input_value("#lev-model") == "mistral-medium-latest"


def test_verbinding(pagina):
    Leverancier(pagina, [])
    verbind(pagina)
    assert actief(pagina, "opdracht")
    assert pagina.evaluate("() => window.sessionStorage.getItem('procescheck-ai-sleutel')") == "test-sleutel"
    assert pagina.evaluate("() => Object.keys(window.localStorage).some(k => (window.localStorage.getItem(k) || '').includes('test-sleutel'))") is False


def test_sleutel_geweigerd(pagina):
    pagina.route(f"{BASIS}/v1/models", lambda route: route.fulfill(status=401, body="{}"))
    pagina.fill("#lev-sleutel", "fout")
    pagina.click("#knop-verbinding")
    pagina.wait_for_selector("#lev-status.status-fout")
    assert "geweigerd" in pagina.text_content("#lev-status")
    assert not actief(pagina, "opdracht")


def test_sleutel_vergeten(pagina):
    Leverancier(pagina, [])
    verbind(pagina)
    pagina.click("#knop-sleutel-vergeten")
    assert pagina.evaluate("() => window.sessionStorage.getItem('procescheck-ai-sleutel')") is None
    assert pagina.input_value("#lev-sleutel") == ""
    assert not actief(pagina, "opdracht")


def test_zonder_toestemming_geen_aanroep(pagina):
    lev = Leverancier(pagina, [antwoord("processen")])
    verbind(pagina)
    pagina.select_option("#opdracht-keuze", "processen")
    pagina.fill("#invoer-tekst", "Een proces.")
    assert actief(pagina, "toestemming")
    assert not actief(pagina, "uitvoeren")
    assert pagina.is_disabled("#knop-uitvoeren")
    assert lev.aanroepen == []


def test_processen_uit_document(pagina, opdrachten):
    lev = Leverancier(pagina, [antwoord("processen")])
    verbind(pagina)
    kies(pagina, "processen", bestand=FIXTURES / "voorbeeld-processen.md")
    assert "Wat er verstuurd wordt" in pagina.text_content("#toestemming-tekst")
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_selector('#stap-voorstel[data-actief="ja"]')
    assert len(lev.aanroepen) == 1
    aanroep = lev.aanroepen[0]
    assert aanroep["headers"]["authorization"] == "Bearer test-sleutel"
    assert aanroep["body"]["response_format"]["type"] == "json_schema"
    assert aanroep["body"]["messages"][0]["role"] == "system"
    assert opdrachten["vaste_regels"] in aanroep["body"]["messages"][0]["content"]
    assert "dossier" not in aanroep["body"]["messages"][1]["content"].lower()

    verwacht = antwoord("processen")["items"]
    assert pagina.locator("#tabel-voorstel tbody tr").count() == len(verwacht)
    assert pagina.locator("#tabel-voorstel tr.niet-in-bron").count() == 0
    assert pagina.locator("#onzeker li").count() == len(antwoord("processen")["onzeker"])

    with pagina.expect_download() as download:
        pagina.click("#knop-voorstel-opslaan")
    naam = download.value.suggested_filename
    assert naam.startswith("procescheck-voorstel-processen-") and naam.endswith(".json")
    inhoud = json.loads(pathlib.Path(download.value.path()).read_text(encoding="utf-8"))
    assert inhoud["formaat"] == "procescheck-voorstel" and inhoud["tool"] == "procescheck"
    assert inhoud["opdracht"] == "processen" and inhoud["model"] == "mistral-medium-latest"
    assert len(inhoud["invoer"]["sha256"]) == 64 and inhoud["invoer"]["aanroepen"] == 1
    assert "test-sleutel" not in json.dumps(inhoud)
    schema = [o for o in opdrachten["opdrachten"] if o["id"] == "processen"][0]["schema"]
    assert kern.valideer(schema, {"items": inhoud["items"], "onzeker": inhoud["onzeker"]}) == []


def test_ongeldig_antwoord_wordt_herhaald(pagina):
    lev = Leverancier(pagina, ["Hier is de JSON: {", antwoord("processen")])
    verbind(pagina)
    kies(pagina, "processen", tekst="Een proces met tekst.")
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_selector('#stap-voorstel[data-actief="ja"]')
    assert len(lev.aanroepen) == 2
    assert "opnieuw" in lev.aanroepen[1]["body"]["messages"][-1]["content"].lower()
    assert "opnieuw" in pagina.text_content("#waarschuwingen")


def test_json_schema_valt_terug_op_json_object(pagina):
    lev = Leverancier(pagina, [400, antwoord("processen")])
    verbind(pagina)
    kies(pagina, "processen", tekst="Een proces met tekst.")
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_selector('#stap-voorstel[data-actief="ja"]')
    assert [a["body"]["response_format"]["type"] for a in lev.aanroepen] == ["json_schema", "json_object"]


def test_429_wacht_en_slaagt(pagina):
    lev = Leverancier(pagina, [429, 429, antwoord("processen")])
    verbind(pagina)
    kies(pagina, "processen", tekst="Een proces met tekst.")
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_selector('#stap-voorstel[data-actief="ja"]', timeout=30000)
    assert len(lev.aanroepen) == 3


def test_chunking(pagina):
    lang = ("Alinea over een proces.\n" * 30 + "\n") * 150      # ruim 100.000 tekens
    lev = Leverancier(pagina, [antwoord("processen"), {"items": [], "onzeker": []}, {"items": [], "onzeker": []},
                               {"items": [], "onzeker": []}, {"items": [], "onzeker": []}, {"items": [], "onzeker": []}])
    verbind(pagina)
    kies(pagina, "processen", tekst=lang)
    stukken = len(kern.chunk(lang, 24000))
    assert stukken >= 3
    assert f"{stukken} aanroepen" in pagina.text_content("#invoer-info")
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_selector('#stap-voorstel[data-actief="ja"]', timeout=30000)
    assert len(lev.aanroepen) == stukken


def test_xlsx_invoer_en_landschap(pagina):
    lev = Leverancier(pagina, [antwoord("landschap")])
    verbind(pagina)
    kies(pagina, "landschap", bestand=FIXTURES / "voorbeeld-cmdb.xlsx")
    tekst = pagina.input_value("#invoer-tekst")
    assert tekst.startswith("| id | naam | type |")
    assert tekst == kern.xlsx_naar_tekst((FIXTURES / "voorbeeld-cmdb.xlsx").read_bytes())
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_selector('#stap-voorstel[data-actief="ja"]')
    assert len(lev.aanroepen) == 1
    with pagina.expect_download() as download:
        pagina.click("#knop-voorstel-opslaan")
    inhoud = json.loads(pathlib.Path(download.value.path()).read_text(encoding="utf-8"))
    assert inhoud["opdracht"] == "landschap"
    assert len(inhoud["nodes"]) == len(antwoord("landschap")["nodes"])
    assert len(inhoud["edges"]) == len(antwoord("landschap")["edges"])


def test_csv_invoer(pagina):
    Leverancier(pagina, [])
    verbind(pagina)
    pagina.select_option("#opdracht-keuze", "applicaties")
    pagina.set_input_files("#invoer-bestand", str(FIXTURES / "voorbeeld-cmdb.csv"))
    pagina.wait_for_function("() => document.getElementById('invoer-tekst').value.length > 0")
    assert pagina.input_value("#invoer-tekst") == kern.csv_naar_tekst((FIXTURES / "voorbeeld-cmdb.csv").read_text(encoding="utf-8"))


def test_niet_in_bron_wordt_gemarkeerd(pagina):
    verzonnen = {"items": [{"code": "P01", "naam": "Kernreactor", "beschrijving": "", "doelstelling": "", "eigenaar": "",
                            "afdeling": "", "kritiek": False, "reden_kritiek": "",
                            "bronregel": "De gemeente exploiteert een kernreactor voor de stroomvoorziening."}],
                 "onzeker": []}
    Leverancier(pagina, [verzonnen])
    verbind(pagina)
    kies(pagina, "processen", tekst="Paspoortuitgifte. Inwoners vragen een paspoort aan.")
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_selector('#stap-voorstel[data-actief="ja"]')
    assert pagina.locator("#tabel-voorstel tr.niet-in-bron").count() == 1
    assert "niet in de bron" in pagina.text_content("#voorstel-samenvatting")


def test_stoppen(pagina):
    lang = ("Alinea over een proces.\n" * 30 + "\n") * 150
    aanroepen = []

    import time

    def traag(route):
        aanroepen.append(1)
        time.sleep(0.4)
        route.fulfill(status=200, content_type="application/json",
                      body=json.dumps({"choices": [{"message": {"content": json.dumps({"items": [], "onzeker": []})}}]}))
    pagina.route(f"{BASIS}/v1/models", lambda r: r.fulfill(status=200, body='{"data": []}'))
    pagina.route(f"{BASIS}/v1/chat/completions", traag)
    verbind(pagina)
    kies(pagina, "processen", tekst=lang)
    pagina.click("#knop-uitvoeren")
    pagina.wait_for_function("() => document.getElementById('voortgang').textContent.length > 0")
    if not pagina.is_disabled("#knop-stoppen"):
        pagina.click("#knop-stoppen")
    pagina.wait_for_function("() => document.getElementById('voortgang').textContent.includes('gestopt') || document.getElementById('voortgang').textContent.startsWith('klaar')")
    assert len(aanroepen) < len(kern.chunk(lang, 24000)) or "klaar" in pagina.text_content("#voortgang")
