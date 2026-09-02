"""Gedeelde fixtures: de bron, de gebouwde pagina, de doorloop en de code op tag v0-applicatie."""
from __future__ import annotations

import json
import pathlib
import subprocess
import sys

import pytest

ROOT = pathlib.Path(__file__).resolve().parent.parent.parent
sys.path.insert(0, str(ROOT / "instrument"))

import bouw as bouwer  # noqa: E402
import haal_bron as haler  # noqa: E402
import reken as rekenaar  # noqa: E402

FIXTURES = pathlib.Path(__file__).parent / "fixtures"


@pytest.fixture(scope="session")
def bron() -> dict:
    return json.loads((ROOT / "procescheck.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def reken():
    return rekenaar


@pytest.fixture(scope="session")
def gebouwd(tmp_path_factory) -> pathlib.Path:
    """De pagina een keer bouwen per testsessie; alle tests lezen dezelfde uitvoer."""
    return bouwer.bouw(tmp_path_factory.mktemp("dist"))


@pytest.fixture(scope="session")
def html(gebouwd: pathlib.Path) -> str:
    return gebouwd.read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def app_js() -> str:
    return (ROOT / "instrument" / "bron" / "app.js").read_text(encoding="utf-8")


@pytest.fixture(scope="session")
def doorloop() -> dict:
    return json.loads((FIXTURES / "doorloop-2026-09.json").read_text(encoding="utf-8"))


@pytest.fixture(scope="session")
def voorbeeld() -> dict:
    return json.loads((ROOT / "instrument" / "voorbeeld" / "landschap.json").read_text(encoding="utf-8"))


def code_op_tag(pad: str) -> str:
    """De inhoud van een bestand op de tag; slaat de test over als de tag er niet is."""
    uit = subprocess.run(["git", "show", f"{haler.TAG}:{pad}"], cwd=ROOT, capture_output=True)
    if uit.returncode != 0:
        pytest.skip(f"tag {haler.TAG} ontbreekt in deze checkout (git fetch --tags)")
    return uit.stdout.decode("utf-8").replace("\r\n", "\n").replace("\r", "\n")
