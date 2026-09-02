"""De opdrachten zijn data; deze tests bewaken dat die data doet wat het plan belooft."""
from __future__ import annotations

from conftest import FIXTURES


def test_aantallen(opdrachten):
    assert opdrachten["tool"] == "procescheck"
    assert opdrachten["voorstel_formaat"] == "procescheck-voorstel"
    assert [o["id"] for o in opdrachten["opdrachten"]] == ["processen", "applicaties", "landschap"]
    assert [l["id"] for l in opdrachten["leveranciers"]] == ["mistral", "ollama", "anders"]
    assert opdrachten["leveranciers"][0]["basis"] == "https://api.mistral.ai"
    assert opdrachten["grenzen"]["max_tekens_per_aanroep"] == 24000


def test_schemas_zijn_streng(opdrachten):
    """additionalProperties overal false, bronregel op elk item, onzeker op elke uitkomst."""
    def loop(schema, pad):
        if not isinstance(schema, dict):
            return
        if schema.get("type") == "object":
            assert schema.get("additionalProperties") is False, f"{pad}: additionalProperties niet false"
            assert set(schema.get("required", [])) == set(schema.get("properties", {})), \
                f"{pad}: required en properties verschillen"
            for naam, deel in schema.get("properties", {}).items():
                loop(deel, f"{pad}.{naam}")
        if schema.get("type") == "array":
            loop(schema.get("items"), f"{pad}[]")

    for opdracht in opdrachten["opdrachten"]:
        loop(opdracht["schema"], opdracht["id"])
        eigenschappen = opdracht["schema"]["properties"]
        assert "onzeker" in eigenschappen
        for lijst in ("items", "nodes", "edges"):
            if lijst in eigenschappen:
                assert "bronregel" in eigenschappen[lijst]["items"]["properties"], f"{opdracht['id']}.{lijst} mist bronregel"


def test_prompts_vragen_geen_oordeel(opdrachten):
    for opdracht in opdrachten["opdrachten"]:
        tekst = opdracht["systeemprompt"].lower()
        assert "verzin" in tekst or "verzin" in opdrachten["vaste_regels"].lower()
        for verboden in ("geef een score", "bepaal de klasse", "bepaal de prioriteit", "classificeer"):
            assert verboden not in tekst, f"{opdracht['id']}: de prompt vraagt om een oordeel"
    vast = opdrachten["vaste_regels"].lower()
    assert "verzin niets" in vast
    assert "uitsluitend met json" in vast
    assert "bronregel" in vast
    assert "geen scores" in vast


def test_voorbeelden_bestaan_en_valideren(opdrachten, kern, antwoorden, invoer):
    for opdracht in opdrachten["opdrachten"]:
        assert (FIXTURES.parent / opdracht["voorbeeld"]["invoer"]).is_file() or \
            (FIXTURES / opdracht["voorbeeld"]["invoer"].split("/", 1)[1]).is_file()
        antwoord = antwoorden[opdracht["id"]]
        fouten = kern.valideer(opdracht["schema"], {k: v for k, v in antwoord.items() if k != "waarschuwingen"})
        assert fouten == [], f"{opdracht['id']}: {fouten[:3]}"


def test_voorbeeldantwoorden_zijn_bruikbaar(antwoorden, invoer, kern):
    """Wat het model op de voorbeelden vond, en dat de citaten echt in de bron staan."""
    processen = antwoorden["processen"]["items"]
    assert 6 <= len(processen) <= 10, [p["naam"] for p in processen]
    assert any("Paspoort" in p["naam"] for p in processen)
    assert any(p["kritiek"] for p in processen)
    assert all(kern.bronregel_klopt(p, invoer["processen"]) for p in processen)

    apps = antwoorden["applicaties"]["items"]
    namen = {a["naam"] for a in apps}
    assert "Zaaksysteem" in namen
    assert not any("licentie" in a["naam"].lower() or "contract" in a["naam"].lower() for a in apps)
    assert any(a["soort"] == "object met industriële automatisering" for a in apps)
    assert all(kern.bronregel_klopt(a, invoer["applicaties"]) for a in apps)

    land = antwoorden["landschap"]
    typen = {n["type"] for n in land["nodes"]}
    assert "ci" in typen and "app" in typen
    ids = {n["id"] for n in land["nodes"]}
    for edge in land["edges"]:
        assert edge["from"] in ids and edge["to"] in ids, edge
    assert len(land["edges"]) >= 8
