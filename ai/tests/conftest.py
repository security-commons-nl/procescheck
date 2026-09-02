"""Gedeelde fixtures van de AI-hulp: de opdrachten, de kern, de voorbeeldinvoer en de vastgelegde antwoorden."""
from __future__ import annotations

import json
import pathlib
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
AI = ROOT / "ai"
FIXTURES = AI / "tests" / "fixtures"
sys.path.insert(0, str(AI))
sys.path.insert(0, str(ROOT / "instrument"))

import kern as kern_module  # noqa: E402


@pytest.fixture(scope="session")
def opdrachten() -> dict:
    return json.loads((AI / "opdrachten.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def kern():
    return kern_module


@pytest.fixture(scope="session")
def invoer() -> dict[str, str]:
    """De voorbeeldinvoer per opdracht, als tekst zoals het model hem kreeg."""
    return {
        "processen": (FIXTURES / "voorbeeld-processen.md").read_text(encoding="utf-8"),
        "applicaties": kern_module.csv_naar_tekst((FIXTURES / "voorbeeld-cmdb.csv").read_text(encoding="utf-8")),
        "landschap": kern_module.xlsx_naar_tekst((FIXTURES / "voorbeeld-cmdb.xlsx").read_bytes()),
    }


@pytest.fixture(scope="session")
def antwoorden() -> dict[str, dict]:
    uit = {}
    for pad in sorted((FIXTURES / "antwoorden").glob("*-voorbeeld.json")):
        uit[pad.name.split("-")[0]] = json.loads(pad.read_text(encoding="utf-8"))
    return uit


@pytest.fixture(scope="session")
def doorloop() -> dict:
    """Het dossier van de tool, om voorstellen tegenaan te leggen."""
    pad = ROOT / "instrument" / "tests" / "fixtures" / "doorloop-2026-09.json"
    return json.loads(pad.read_text(encoding="utf-8"))
