#!/usr/bin/env python3
"""Haalt de vragen, labels en regels uit de applicatie op tag v0-applicatie en schrijft procescheck.json.

De applicatie was de bron van waarheid; dit script maakt daar een leesbare, versievaste kopie van, zodat
het instrument in de browser dezelfde vragen stelt en dezelfde parameters toont als de React-app deed.
De tag `v0-applicatie` staat vast: wie hem verplaatst, verandert de bron onder het instrument vandaan.
Daarom leest dit script niet de werkkopie maar `git show v0-applicatie:<pad>`.

Aanroep:
    python instrument/haal_bron.py            schrijft procescheck.json
    python instrument/haal_bron.py --check    faalt als procescheck.json niet meer bij de tag past (CI)

Alleen standaardbibliotheek.
"""
from __future__ import annotations

import json
import pathlib
import re
import subprocess
import sys

HIER = pathlib.Path(__file__).resolve().parent
REPO = HIER.parent
TAG = "v0-applicatie"
DOEL = REPO / "procescheck.json"

BIA_PAGE = "frontend/src/pages/Bia/BiaPage.tsx"
BIA_SHARED = "frontend/src/pages/Bia/biaShared.tsx"
DASHBOARD = "backend/app/routers/dashboard.py"
EXPORT = "backend/app/routers/export.py"
PARAMETERTABEL = "Docs/MTPD-RTO-WRT-RPO-classificatie.md"

VERSIE = "2026-09"

# De vier beschikbaarheidsvragen leiden elk een continuiteitsparameter af; integriteit en
# vertrouwelijkheid leveren alleen een score. De koppeling staat als commentaar in biaShared.tsx
# ("b1 -> RTO, b2 -> RPO, b3 -> WRT, b4 -> MTPD/MTD") en wordt hier vastgelegd.
PARAMETER_PER_VRAAG = {"b1": "rto", "b2": "rpo", "b3": "wrt", "b4": "mtpd"}
DIMENSIE_PER_ARRAY = {"B_QUESTIONS": "B", "I_QUESTIONS": "I", "V_QUESTIONS": "V"}

# De tien volledigheidscontroles uit _check_completeness in dashboard.py, in dezelfde volgorde.
# `alleen_als_kritiek` hoort bij `if p.is_critical and not p.critical_reason`.
VOLLEDIGHEID = [
    {"id": "beschrijving", "label": "Beschrijving"},
    {"id": "doelstelling", "label": "Doelstelling"},
    {"id": "eigenaar", "label": "Eigenaar"},
    {"id": "afdeling", "label": "Afdeling"},
    {"id": "laatste_beoordeling", "label": "Laatste beoordelingsdatum"},
    {"id": "reden_kritiek", "label": "Reden kritiek", "alleen_als_kritiek": True},
    {"id": "applicaties", "label": "Gekoppelde applicaties"},
    {"id": "bia", "label": "BIA / BIV"},
    {"id": "rto_rpo", "label": "RTO / RPO"},
    {"id": "context", "label": "Business context"},
]

# De prioriteitsregels uit get_risk_overview in dashboard.py, in dezelfde volgorde van beoordelen.
# Twee dingen wijken bewust af van de applicatie; beide staan in verantwoording.md:
#  - het gedachtestreepje in "Kritisch proces - onvolledig gedocumenteerd" wordt een komma;
#  - de laatste twee regels heetten allebei `medium`; hier heet de lichte variant `low`, zodat de
#    prioriteit overeenkomt met de bandbreedtes van de volledigheid (0 compleet, 1 tot 3 aandacht,
#    4 of meer onvolledig). De redenteksten zijn wel letterlijk die van de applicatie.
PRIORITEITEN = [
    {"id": "critical", "regel": "kritiek_zonder_bia", "reden": "Informatie ontbreekt"},
    {"id": "high", "regel": "hoog_risico_zonder_rto_rpo", "reden": "Hoog risico: geen RTO/RPO gedefinieerd"},
    {"id": "high", "regel": "kritiek_onvolledig", "reden": "Kritisch proces, onvolledig gedocumenteerd"},
    {"id": "medium", "regel": "vier_of_meer_ontbrekend", "reden": "{n} velden ontbreken"},
    {"id": "low", "regel": "anders", "reden": "{n} veld(en) ontbreken"},
]

KEUZES = {
    "soort_applicatie": ["applicatie", "object met industriële automatisering"],
    "nodetypes": ["ci", "app", "proces"],
    "relatie_standaard": "ondersteunt",
    "kritiek_waar": ["ja", "true", "1", "yes"],
}

GRAAF_MAXIMUM = 60


def uit_tag(pad: str) -> str:
    """De inhoud van een bestand op de tag, met genormaliseerde regeleindes.

    Op Windows kan git \r\n teruggeven; zonder normaliseren staan er \r's in de tooltips en verschilt
    de bron per machine. Eerst normaliseren, dan pas parsen.
    """
    try:
        ruw = subprocess.run(["git", "show", f"{TAG}:{pad}"], cwd=REPO, check=True,
                             capture_output=True).stdout.decode("utf-8")
    except subprocess.CalledProcessError as fout:
        melding = fout.stderr.decode("utf-8", "replace").strip()
        sys.exit(f"kan {pad} niet lezen op tag {TAG}: {melding}\n"
                 f"Haal de tag op met 'git fetch --tags' (CI: checkout met fetch-depth: 0).")
    return ruw.replace("\r\n", "\n").replace("\r", "\n")


def ontsnap(tekst: str) -> str:
    r"""Lost de ontsnappingen van een TypeScript-string in enkele aanhalingstekens op: \' en \n."""
    return tekst.replace("\\'", "'").replace("\\n", "\n").replace('\\"', '"').replace("\\\\", "\\")


def ontsnap_terug(tekst: str) -> str:
    """De omgekeerde weg: van leesbare tekst naar hoe hij in de TypeScript-bron staat.

    Alleen voor de tests, die de bron woordelijk naast de code leggen. Dubbele aanhalingstekens gaan
    niet mee: die staan in een string met enkele aanhalingstekens gewoon zichzelf te zijn.
    """
    return tekst.replace("'", chr(92) + "'").replace(chr(10), chr(92) + "n")


# Een string tussen enkele aanhalingstekens, met ontsnapte tekens erin (risico\'s, zo\'n).
STRING = r"'((?:[^'\\]|\\.)*)'"


def blok(bron: str, kop: str) -> str:
    """De tekst van een array-literal: vanaf de kop tot de eerste regel die alleen `]` bevat."""
    start = bron.index(kop)
    einde = bron.index("\n]", start)
    return bron[start:einde]


def vragen(bia_page: str, labels: list[str]) -> list[dict]:
    uit: list[dict] = []
    for kop, dimensie in DIMENSIE_PER_ARRAY.items():
        tekst = blok(bia_page, f"const {kop}: BiaQuestion[] = [")
        stukken = tekst.split("key: ")[1:]
        for stuk in stukken:
            sleutel = re.match(STRING, stuk)
            label = re.search(r"label: " + STRING, stuk)
            tooltip = re.search(r"tooltip: " + STRING, stuk)
            infos = re.findall(r"info: " + STRING, stuk)
            if not sleutel or not label:
                sys.exit(f"vraag zonder key of label in {kop}")
            if len(infos) != 5:
                sys.exit(f"vraag {sleutel.group(1)} heeft {len(infos)} antwoorden, verwacht 5")
            uit.append({
                "id": sleutel.group(1),
                "dimensie": dimensie,
                "parameter": PARAMETER_PER_VRAAG.get(sleutel.group(1)),
                "vraag": ontsnap(label.group(1)),
                "toelichting": ontsnap(tooltip.group(1)) if tooltip else "",
                "antwoorden": [{"score": i + 1, "label": labels[i], "info": ontsnap(info)}
                               for i, info in enumerate(infos)],
            })
    if len(uit) != 6:
        sys.exit(f"{len(uit)} vragen gevonden, verwacht 6")
    return uit


def antwoordlabels(bia_page: str, bia_shared: str) -> list[str]:
    regel = re.search(r"const ANSWER_LABELS = \[(.*?)\]", bia_page, re.S)
    if not regel:
        sys.exit("ANSWER_LABELS niet gevonden")
    labels = [ontsnap(m) for m in re.findall(STRING, regel.group(1))]
    if len(labels) != 5:
        sys.exit(f"{len(labels)} antwoordlabels, verwacht 5")

    kaart = re.search(r"const SCORE_LABELS: Record<number, string> = \{(.*?)\}", bia_shared, re.S)
    if not kaart:
        sys.exit("SCORE_LABELS niet gevonden in biaShared.tsx")
    uit_kaart = [ontsnap(m) for m in re.findall(STRING, kaart.group(1))]
    if uit_kaart != labels:
        sys.exit("SCORE_LABELS en ANSWER_LABELS zijn niet gelijk; de bron spreekt zichzelf tegen")
    return labels


def parameters(bia_shared: str) -> dict[str, dict[str, str]]:
    tekst = re.search(r"export const PARAM_MAP = \{(.*?)\n\} as const", bia_shared, re.S)
    if not tekst:
        sys.exit("PARAM_MAP niet gevonden")
    uit: dict[str, dict[str, str]] = {}
    for regel in tekst.group(1).strip().splitlines():
        naam = re.match(r"\s*(\w+): \{", regel)
        if not naam:
            continue
        waarden = [ontsnap(m) for m in re.findall(STRING, regel)]
        if len(waarden) != 5:
            sys.exit(f"parameter {naam.group(1)} heeft {len(waarden)} waarden, verwacht 5")
        # `mtd` in de code heet in de documentatie MTPD; de tool gebruikt de documentatieterm.
        sleutel = "mtpd" if naam.group(1) == "mtd" else naam.group(1)
        uit[sleutel] = {str(i + 1): waarde for i, waarde in enumerate(waarden)}
    if sorted(uit) != ["mtpd", "rpo", "rto", "wrt"]:
        sys.exit(f"onverwachte parameters: {sorted(uit)}")
    return uit


def parametertabel(markdown: str) -> list[dict]:
    """De eerste markdowntabel uit Docs/MTPD-RTO-WRT-RPO-classificatie.md, vijf rijen."""
    rijen = []
    for regel in markdown.splitlines():
        if not regel.startswith("|") or set(regel) <= set("|- "):
            continue
        cellen = [c.strip() for c in regel.strip().strip("|").split("|")]
        if cellen[0] in ("Klasse", ""):
            continue
        if len(cellen) != 5:
            sys.exit(f"rij met {len(cellen)} kolommen in de parametertabel: {regel}")
        rijen.append({"klasse": cellen[0], "mtpd": cellen[1], "rto": cellen[2],
                      "wrt": cellen[3], "rpo": cellen[4]})
    if len(rijen) != 5:
        sys.exit(f"{len(rijen)} rijen in de parametertabel, verwacht 5")
    return rijen


# De commit van blast-radius waar de rekenregels vandaan komen, vastgelegd op het moment van
# overnemen (02-09-2026). Bewust een constante en geen `git log` in de buurmap: de herkomst is een
# feit van toen, en `--check` moet op elke machine hetzelfde antwoord geven, ook in CI waar die repo
# er niet is.
BLAST_RADIUS_COMMIT = "21d4f3405ad4dc71f9d3ca00701050dba16acca3"


def bouw_bron() -> dict:
    bia_page = uit_tag(BIA_PAGE)
    bia_shared = uit_tag(BIA_SHARED)
    labels = antwoordlabels(bia_page, bia_shared)
    return {
        "versie": VERSIE,
        "bron": {
            "vragen": f"{BIA_PAGE} op tag {TAG} (B_QUESTIONS, I_QUESTIONS, V_QUESTIONS, ANSWER_LABELS)",
            "labels": f"{BIA_SHARED} op tag {TAG} (SCORE_LABELS, PARAM_MAP)",
            "parametertabel": PARAMETERTABEL,
            "regels": f"{DASHBOARD} op tag {TAG}",
            "sjabloon": "Template BIA & BIV-Classificatie.xlsx, genoemd in de code als herkomst van de vragen",
            "blast_radius": "security-commons-nl/blast-radius, blastradius/analysis.py en parsers.py, "
                            "commit " + BLAST_RADIUS_COMMIT,
            "gegenereerd_door": "instrument/haal_bron.py; wijzig de bron niet met de hand",
        },
        "schaal": [{"score": i + 1, "label": label} for i, label in enumerate(labels)],
        "vragen": vragen(bia_page, labels),
        "parameters": parameters(bia_shared),
        "parametertabel": parametertabel(uit_tag(PARAMETERTABEL)),
        "volledigheid": VOLLEDIGHEID,
        "prioriteiten": PRIORITEITEN,
        "keuzes": KEUZES,
        "graaf_maximum": GRAAF_MAXIMUM,
    }


def als_json(data: dict) -> str:
    return json.dumps(data, ensure_ascii=False, indent=1) + "\n"


def main(argv: list[str]) -> int:
    data = bouw_bron()
    tekst = als_json(data)
    if "--check" in argv:
        if not DOEL.is_file():
            print("procescheck.json ontbreekt; draai instrument/haal_bron.py")
            return 1
        huidig = DOEL.read_text(encoding="utf-8")
        if huidig != tekst:
            oud, nieuw = huidig.splitlines(), tekst.splitlines()
            verschillen = [f"  regel {i + 1}: {a[:90]!r} != {b[:90]!r}"
                           for i, (a, b) in enumerate(zip(oud, nieuw)) if a != b][:3]
            print("procescheck.json past niet meer bij de tag; draai instrument/haal_bron.py")
            print("\n".join(verschillen) or f"  lengte {len(oud)} tegen {len(nieuw)} regels")
            return 1
        print(f"procescheck.json klopt met {TAG} ({len(data['vragen'])} vragen)")
        return 0

    DOEL.write_bytes(tekst.encode("utf-8"))
    print(f"{DOEL.name}: {len(data['vragen'])} vragen, {len(data['schaal'])} klassen, "
          f"{len(data['parameters'])} parameters, {len(data['volledigheid'])} volledigheidsvelden")
    return 0


if __name__ == "__main__":
    raise SystemExit(main(sys.argv[1:]))
