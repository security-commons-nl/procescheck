"""Legt procescheck.json naast de applicatie op tag v0-applicatie.

De bron is een kopie, en een kopie die niemand nakijkt gaat schuiven. Deze tests lezen de code op de
tag zelf en vergelijken woordelijk: dezelfde vragen, dezelfde antwoordteksten, dezelfde labels.
"""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

from conftest import ROOT, code_op_tag

sys.path.insert(0, str(ROOT / "instrument"))
import haal_bron as haler  # noqa: E402


def test_aantallen(bron):
    assert len(bron["schaal"]) == 5
    assert len(bron["vragen"]) == 6
    assert [v["dimensie"] for v in bron["vragen"]] == ["B", "B", "B", "B", "I", "V"]
    assert all(len(v["antwoorden"]) == 5 for v in bron["vragen"])
    assert sorted(bron["parameters"]) == ["mtpd", "rpo", "rto", "wrt"]
    assert all(len(waarden) == 5 for waarden in bron["parameters"].values())
    assert len(bron["parametertabel"]) == 5
    assert len(bron["volledigheid"]) == 10
    assert len(bron["prioriteiten"]) == 5
    assert bron["graaf_maximum"] == 60


def test_vragen_woordelijk(bron):
    code = code_op_tag(haler.BIA_PAGE)
    for vraag in bron["vragen"]:
        assert f"key: '{vraag['id']}'" in code, f"vraag {vraag['id']} staat niet in de code"
        assert haler.ontsnap_terug(vraag["vraag"]) in code, f"label van {vraag['id']} wijkt af"
        if vraag["toelichting"]:
            assert haler.ontsnap_terug(vraag["toelichting"]) in code
        for antwoord in vraag["antwoorden"]:
            assert haler.ontsnap_terug(antwoord["info"]) in code, \
                f"antwoord {antwoord['score']} van {vraag['id']} wijkt af"


def test_b1_en_b2_hebben_dezelfde_antwoordteksten(bron):
    """Zo staat het in de applicatie: het sjabloon herhaalde de alinea. Geen fout in het script."""
    per_id = {v["id"]: v for v in bron["vragen"]}
    b1 = [a["info"] for a in per_id["b1"]["antwoorden"]]
    b2 = [a["info"] for a in per_id["b2"]["antwoorden"]]
    assert b1 == b2


def test_regeleindes(bron):
    ruw = json.dumps(bron, ensure_ascii=False)
    assert "\r" not in ruw, "de bron bevat een wagenterugloop; normaliseer in haal_bron.py"
    per_id = {v["id"]: v for v in bron["vragen"]}
    assert "\n" in per_id["b1"]["toelichting"], "de tooltip hoort regeleindes te houden"


def test_schaal_woordelijk(bron):
    page = code_op_tag(haler.BIA_PAGE)
    shared = code_op_tag(haler.BIA_SHARED)
    labels = [stap["label"] for stap in bron["schaal"]]
    assert [stap["score"] for stap in bron["schaal"]] == [1, 2, 3, 4, 5]
    for label in labels:
        assert f"'{label}'" in page
        assert f"'{label}'" in shared
    for vraag in bron["vragen"]:
        assert [a["label"] for a in vraag["antwoorden"]] == labels


def test_parameters_woordelijk(bron):
    shared = code_op_tag(haler.BIA_SHARED)
    export = code_op_tag(haler.EXPORT)
    for parameter, waarden in bron["parameters"].items():
        for waarde in waarden.values():
            assert f"'{waarde}'" in shared, f"{parameter}: {waarde} staat niet in PARAM_MAP"
    for score, waarde in bron["parameters"]["rto"].items():
        assert f'{score}: "{waarde}"' in export, "rto wijkt af van RTO_LABELS in export.py"


def test_parametertabel_woordelijk(bron):
    markdown = (ROOT / haler.PARAMETERTABEL).read_text(encoding="utf-8")
    for rij in bron["parametertabel"]:
        for waarde in rij.values():
            assert waarde in markdown
    # De vragenlijst en de tabel lopen voor WRT tegen elkaar in; beide zijn overgenomen zoals ze zijn.
    # Deze test legt dat vast, zodat niemand het later stilzwijgend "rechtzet".
    assert bron["parameters"]["wrt"]["1"] == "Enkele uren"
    assert bron["parametertabel"][0]["wrt"] == "meerdere werkdagen"
    assert bron["parametertabel"][4]["wrt"] == "minder dan 1 uur"


def test_volledigheid_labels(bron):
    dashboard = code_op_tag(haler.DASHBOARD)
    for controle in bron["volledigheid"]:
        assert f'missing.append("{controle["label"]}")' in dashboard, \
            f"{controle['label']} komt niet uit _check_completeness"
    kritiek = [c for c in bron["volledigheid"] if c.get("alleen_als_kritiek")]
    assert [c["id"] for c in kritiek] == ["reden_kritiek"]


def test_prioriteit_redenen(bron):
    dashboard = code_op_tag(haler.DASHBOARD)
    per_regel = {p["regel"]: p for p in bron["prioriteiten"]}
    assert f'reason = "{per_regel["kritiek_zonder_bia"]["reden"]}"' in dashboard
    assert f'reason = "{per_regel["hoog_risico_zonder_rto_rpo"]["reden"]}"' in dashboard
    assert 'f"{len(missing)} velden ontbreken"' in dashboard
    assert 'f"{len(missing)} veld(en) ontbreken"' in dashboard
    assert per_regel["vier_of_meer_ontbrekend"]["reden"] == "{n} velden ontbreken"
    assert per_regel["anders"]["reden"] == "{n} veld(en) ontbreken"
    # In de code staat een gedachtestreepje; de bron maakt er een komma van (zie verantwoording.md).
    assert "Kritisch proces" in dashboard
    assert per_regel["kritiek_onvolledig"]["reden"] == "Kritisch proces, onvolledig gedocumenteerd"


def test_voorbeeld_landschap(voorbeeld):
    typen = {"proces": 0, "app": 0, "ci": 0}
    for node in voorbeeld["nodes"]:
        typen[node["type"]] += 1
    assert typen == {"proces": 3, "app": 4, "ci": 7}
    assert len(voorbeeld["edges"]) == 19
    per_id = {n["id"]: n for n in voorbeeld["nodes"]}
    binnen_kolom = [e for e in voorbeeld["edges"]
                    if per_id[e["from"]]["type"] == per_id[e["to"]]["type"]]
    assert binnen_kolom, "het voorbeeld hoort een relatie binnen een kolom te hebben (ci naar ci)"
    assert voorbeeld["herkomst"].startswith("Kopie van testdata/landschap.json")

    origineel = ROOT.parent / "blast-radius" / "testdata" / "landschap.json"
    if origineel.is_file():
        bron_data = json.loads(origineel.read_text(encoding="utf-8"))
        assert voorbeeld["nodes"] == bron_data["nodes"]
        assert voorbeeld["edges"] == bron_data["edges"]


def test_haal_bron_check_slaagt():
    uit = subprocess.run([sys.executable, "instrument/haal_bron.py", "--check"], cwd=ROOT,
                         capture_output=True)
    melding = uit.stdout.decode("utf-8", "replace") + uit.stderr.decode("utf-8", "replace")
    if "ontbreekt in deze checkout" in melding or f"tag {haler.TAG}" in melding and uit.returncode == 1 \
            and "git fetch" in melding:
        import pytest
        pytest.skip("tag v0-applicatie ontbreekt in deze checkout")
    assert uit.returncode == 0, melding


def test_bestandslijst_bestaat():
    for pad in ("procescheck.json", "instrument/reken.py", "instrument/bouw.py",
                "instrument/bron/index.html", "instrument/bron/app.css", "instrument/bron/app.js",
                "instrument/voorbeeld/landschap.json"):
        assert (ROOT / pathlib.Path(pad)).is_file(), f"{pad} ontbreekt"
