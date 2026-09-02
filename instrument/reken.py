#!/usr/bin/env python3
"""De rekenregels van procescheck: BIA/BIV, volledigheid, prioriteit, review en blast radius.

Dit is de referentie. `instrument/bron/app.js` heeft dezelfde functies onder dezelfde namen in het
object `reken`, zodat de browser en dit bestand hetzelfde uitrekenen en een test dat kan vergelijken.
Alle functies zijn puur: erin een dossier, eruit een uitkomst, geen bestanden en geen toestand.

Twee dingen om nooit uit het oog te verliezen:
  1. De schaal loopt andersom dan je gewend bent. 1 is Catastrofaal, 5 is Verwaarloosbaar, en de
     aggregatie is dus `min` en niet `max`.
  2. Afronden gaat met `rond_half_omhoog`, nooit met `round()`. Python rondt 12.5 naar 12 (banker's
     rounding), JavaScript naar 13. Eén ronde regel voor beide kanten.

Alleen standaardbibliotheek.
"""
from __future__ import annotations

import math

# ── Schaal en afronden ────────────────────────────────────────────────────────


def rond_half_omhoog(x: float) -> int:
    """Half omhoog, zoals Math.round in JavaScript. Zie de kop voor het waarom."""
    return int(math.floor(x + 0.5))


def procent(done: int, total: int) -> int:
    return 0 if total <= 0 else rond_half_omhoog(done / total * 100)


def klasse_score(scores) -> int | None:
    """De zwaarste klasse van een reeks: het laagste getal. Lege waarden tellen niet mee."""
    geldig = [s for s in scores if isinstance(s, int) and 1 <= s <= 5]
    return min(geldig) if geldig else None


def bia(antwoorden: dict) -> dict:
    """B uit b1..b4, I uit i1, V uit v1, en de procesklasse uit die drie."""
    b = klasse_score([antwoorden.get(k) for k in ("b1", "b2", "b3", "b4")])
    i = klasse_score([antwoorden.get("i1")])
    v = klasse_score([antwoorden.get("v1")])
    return {"B": b, "I": i, "V": v, "proces": klasse_score([b, i, v])}


def parameterlabel(bron: dict, parameter: str, score) -> str | None:
    if score is None or parameter not in bron["parameters"]:
        return None
    return bron["parameters"][parameter].get(str(score))


def label_van_score(bron: dict, score) -> str | None:
    for stap in bron["schaal"]:
        if stap["score"] == score:
            return stap["label"]
    return None


# ── Volledigheid, risico en prioriteit ────────────────────────────────────────

CONTEXT_TEKSTVELDEN = (
    "partners", "activiteiten", "middelen", "propositie", "klantrelaties", "kanalen", "segmenten",
    "kosten", "opbrengsten", "wettelijke_basis", "stakeholders", "ketenpositie", "kernaspecten",
    "continuiteitseisen", "reviewdatum", "notities",
)


def _leeg(waarde) -> bool:
    return not str(waarde or "").strip()


def heeft_bia(proces: dict) -> bool:
    """Waar zodra een van de zes vragen is beantwoord; de applicatie kende hier een BIA-record."""
    antwoorden = (proces.get("bia") or {})
    return any(antwoorden.get(k) is not None for k in ("b1", "b2", "b3", "b4", "i1", "v1"))


def heeft_rto_rpo(proces: dict) -> bool:
    """Trouw aan _has_rto_rpo in dashboard.py: b1 en b2 beide beantwoord.

    De handmatige velden in `rto_rpo` zijn een toelichting naast de klasselabels en tellen bewust
    niet mee; werkwijze.md legt uit waarom dat contra-intuïtief is en toch zo blijft.
    """
    antwoorden = (proces.get("bia") or {})
    return antwoorden.get("b1") is not None and antwoorden.get("b2") is not None


def context_leeg(context: dict) -> bool:
    """Leeg is: geen enkel tekstveld ingevuld en beide vinkjes uit. Eén datum maakt hem al gevuld."""
    context = context or {}
    if any(not _leeg(context.get(veld)) for veld in CONTEXT_TEKSTVELDEN):
        return False
    return not context.get("persoonsgegevens") and not context.get("bijzondere_persoonsgegevens")


def ontbrekend(bron: dict, proces: dict) -> list[str]:
    """De labels van de controles die niet slagen, in de volgorde van bron['volledigheid']."""
    kritiek = bool(proces.get("kritiek"))
    gevuld = {
        "beschrijving": not _leeg(proces.get("beschrijving")),
        "doelstelling": not _leeg(proces.get("doelstelling")),
        "eigenaar": not _leeg(proces.get("eigenaar")),
        "afdeling": not _leeg(proces.get("afdeling")),
        "laatste_beoordeling": not _leeg(proces.get("laatste_beoordeling")),
        "reden_kritiek": not _leeg(proces.get("reden_kritiek")),
        "applicaties": bool(proces.get("applicaties")),
        "bia": heeft_bia(proces),
        "rto_rpo": heeft_rto_rpo(proces),
        "context": not context_leeg(proces.get("context")),
    }
    uit = []
    for controle in bron["volledigheid"]:
        if controle.get("alleen_als_kritiek") and not kritiek:
            continue
        if not gevuld[controle["id"]]:
            uit.append(controle["label"])
    return uit


def hoog_risico(proces: dict) -> bool:
    """Een van B, I, V is 1 of 2."""
    scores = bia(proces.get("bia") or {})
    return any(scores[dim] is not None and scores[dim] <= 2 for dim in ("B", "I", "V"))


def _reden(sjabloon: str, n: int) -> str:
    return sjabloon.replace("{n}", str(n))


def prioriteit(bron: dict, proces: dict) -> dict | None:
    """De eerste regel die past, of niets als het proces compleet is."""
    mist = ontbrekend(bron, proces)
    if not mist:
        return None
    kritiek = bool(proces.get("kritiek"))
    per_regel = {p["regel"]: p for p in bron["prioriteiten"]}

    if kritiek and not heeft_bia(proces):
        regel = per_regel["kritiek_zonder_bia"]
    elif hoog_risico(proces) and not heeft_rto_rpo(proces):
        regel = per_regel["hoog_risico_zonder_rto_rpo"]
    elif kritiek:
        regel = per_regel["kritiek_onvolledig"]
    elif len(mist) >= 4:
        regel = per_regel["vier_of_meer_ontbrekend"]
    else:
        regel = per_regel["anders"]
    return {"prioriteit": regel["id"], "reden": _reden(regel["reden"], len(mist)), "ontbrekend": mist}


# ── Review ────────────────────────────────────────────────────────────────────


def cutoff(vandaag: str) -> str:
    """Een jaar terug, als tekst. 29 februari bestaat niet in elk jaar; dan 28 februari."""
    jaar, maand, dag = (int(deel) for deel in vandaag.split("-"))
    if (maand, dag) == (2, 29):
        dag = 28
    return f"{jaar - 1:04d}-{maand:02d}-{dag:02d}"


def op_tijd(datum, vandaag: str) -> bool:
    """Datums als JJJJ-MM-DD vergelijken lexicografisch; dat scheelt een datumbibliotheek."""
    return bool(datum) and str(datum) >= cutoff(vandaag)


# ── Dossierhulp ───────────────────────────────────────────────────────────────


def slug(tekst: str) -> str:
    schoon = []
    for teken in str(tekst or "").lower():
        schoon.append(teken if ("a" <= teken <= "z" or "0" <= teken <= "9") else "-")
    uit = "-".join(deel for deel in "".join(schoon).split("-") if deel)[:40].strip("-")
    return uit or "organisatie"


def bestandsnaam(dossier: dict, vandaag: str) -> str:
    naam = slug(((dossier.get("organisatie") or {}).get("naam")))
    return f"procescheck-dossier-{naam}-{vandaag}.json"


# ── Dashboard ─────────────────────────────────────────────────────────────────


def dashboard(bron: dict, dossier: dict, vandaag: str) -> dict:
    processen = dossier.get("processen") or []
    applicaties = dossier.get("applicaties") or []
    totaal = len(processen)

    compleet = aandacht = onvolledig = 0
    for proces in processen:
        n = len(ontbrekend(bron, proces))
        if n == 0:
            compleet += 1
        elif n <= 3:
            aandacht += 1
        else:
            onvolledig += 1

    scores = {p["code"]: bia(p.get("bia") or {}) for p in processen}

    verdeling: dict[str, dict[str, int]] = {}
    top: dict[str, list[dict]] = {}
    for dim in ("B", "I", "V"):
        tel = {"1": 0, "2": 0, "3": 0, "4": 0, "5": 0, "leeg": 0}
        rijen = []
        for proces in processen:
            score = scores[proces["code"]][dim]
            tel["leeg" if score is None else str(score)] += 1
            if score is not None:
                rijen.append({"code": proces["code"], "naam": proces.get("naam", ""), "score": score})
        verdeling[dim] = tel
        top[dim] = sorted(rijen, key=lambda r: (r["score"], r["code"]))[:5]

    def dek(test) -> dict:
        done = sum(1 for proces in processen if test(proces))
        return {"done": done, "total": totaal, "pct": procent(done, totaal)}

    dekking_uit = {
        "bia": dek(heeft_bia),
        "rto_rpo": dek(heeft_rto_rpo),
        "context": dek(lambda p: not context_leeg(p.get("context"))),
        "applicaties": dek(lambda p: bool(p.get("applicaties"))),
    }

    privacy = {
        "persoonsgegevens": sum(1 for p in processen if (p.get("context") or {}).get("persoonsgegevens")),
        "bijzonder": sum(1 for p in processen if (p.get("context") or {}).get("bijzondere_persoonsgegevens")),
    }

    def review_item(waarden, totaal_items) -> dict:
        done = sum(1 for waarde in waarden if op_tijd(waarde, vandaag))
        return {"on_time": done, "total": totaal_items, "pct": procent(done, totaal_items)}

    review = {
        "processen": review_item([p.get("laatste_beoordeling") for p in processen], totaal),
        "bia": review_item([(p.get("bia") or {}).get("interviewdatum") if heeft_bia(p) else None
                            for p in processen], totaal),
        "context": review_item([(p.get("context") or {}).get("reviewdatum")
                                if not context_leeg(p.get("context")) else None
                                for p in processen], totaal),
        "applicaties": review_item([a.get("reviewdatum") for a in applicaties], len(applicaties)),
    }

    volgorde = {"critical": 0, "high": 1, "medium": 2, "low": 3}
    prioriteiten = []
    for proces in processen:
        uitkomst = prioriteit(bron, proces)
        if uitkomst:
            prioriteiten.append({"code": proces["code"], "naam": proces.get("naam", ""), **uitkomst})
    prioriteiten.sort(key=lambda r: (volgorde[r["prioriteit"]], r["code"]))

    kritiek_lijst = [{
        "code": p["code"], "naam": p.get("naam", ""),
        "B": scores[p["code"]]["B"], "I": scores[p["code"]]["I"], "V": scores[p["code"]]["V"],
        "klasse": scores[p["code"]]["proces"],
        "heeft_bia": heeft_bia(p), "heeft_rto_rpo": heeft_rto_rpo(p),
        "ontbrekend": ontbrekend(bron, p),
    } for p in sorted(processen, key=lambda p: ((scores[p["code"]]["proces"] or 9), p["code"]))
        if p.get("kritiek")]

    return {
        "totaal": totaal,
        "kritiek": sum(1 for p in processen if p.get("kritiek")),
        "compleet": compleet,
        "aandacht": aandacht,
        "onvolledig": onvolledig,
        "hoog_risico": sum(1 for p in processen if hoog_risico(p)),
        "verdeling": verdeling,
        "top": top,
        "dekking": dekking_uit,
        "privacy": privacy,
        "review": review,
        "prioriteiten": prioriteiten,
        "kritiek_lijst": kritiek_lijst,
    }


# ── Landschap en blast radius ─────────────────────────────────────────────────
#
# Overgenomen uit security-commons-nl/blast-radius (blastradius/analysis.py): bereik is de transitieve
# closure over de uitgaande edges, dekking telt de dragende applicaties per proces, en de ranglijst
# sorteert op kritieke processen, dan processen, dan omvang. Node-ids krijgen hier een voorvoegsel
# (`proces:`, `app:`, `ci:`), zodat een proces P01 en een applicatie P01 elkaar niet overschrijven.


def landschap(dossier: dict) -> dict:
    nodes: list[dict] = []
    edges: list[dict] = []
    waarschuwingen: list[str] = []
    gezien: set[tuple[str, str]] = set()

    app_codes = {a["code"] for a in dossier.get("applicaties") or []}
    ci_ids = {c["id"] for c in dossier.get("componenten") or []}

    for proces in dossier.get("processen") or []:
        nodes.append({"id": "proces:" + proces["code"], "label": proces.get("naam") or proces["code"],
                      "type": "proces", "kritiek": bool(proces.get("kritiek"))})
    for app in dossier.get("applicaties") or []:
        nodes.append({"id": "app:" + app["code"], "label": app.get("naam") or app["code"],
                      "type": "app", "kritiek": False})
    for component in dossier.get("componenten") or []:
        nodes.append({"id": "ci:" + component["id"], "label": component.get("label") or component["id"],
                      "type": "ci", "kritiek": bool(component.get("kritiek"))})

    def voeg_toe(van: str, naar: str, relatie: str) -> None:
        if (van, naar) in gezien:
            return
        gezien.add((van, naar))
        edges.append({"from": van, "to": naar, "relatie": relatie})

    for proces in dossier.get("processen") or []:
        for code in proces.get("applicaties") or []:
            if code not in app_codes:
                waarschuwingen.append(f"proces {proces['code']} verwijst naar onbekende applicatie {code}")
                continue
            voeg_toe("app:" + code, "proces:" + proces["code"], "ondersteunt")

    for edge in dossier.get("component_edges") or []:
        van, naar = edge.get("from"), edge.get("to")
        if van not in ci_ids:
            waarschuwingen.append(f"edge {van} naar {naar}: onbekende bron")
            continue
        # Volgorde van oplossen: eerst applicatie, dan component. Een code die beide is, is een
        # applicatie; anders zou een import een applicatie stil in een component veranderen.
        if naar in app_codes:
            doel = "app:" + naar
        elif naar in ci_ids:
            doel = "ci:" + naar
        else:
            waarschuwingen.append(f"edge {van} naar {naar}: onbekend doel")
            continue
        voeg_toe("ci:" + van, doel, edge.get("relatie") or "ondersteunt")

    return {"nodes": nodes, "edges": edges, "waarschuwingen": waarschuwingen}


def uitgaand(land: dict, node_id: str) -> list[str]:
    return [e["to"] for e in land["edges"] if e["from"] == node_id]


def inkomend(land: dict, node_id: str) -> list[str]:
    return [e["from"] for e in land["edges"] if e["to"] == node_id]


def bereik(land: dict, start: str) -> tuple[set[str], bool]:
    """Alles wat omvalt als start uitvalt, plus of het landschap vanaf hier een cyclus kent."""
    gezien: set[str] = set()
    cyclus = False
    stapel = list(uitgaand(land, start))
    while stapel:
        node = stapel.pop()
        if node == start:
            cyclus = True
            continue
        if node in gezien:
            continue
        gezien.add(node)
        stapel.extend(uitgaand(land, node))
    return gezien, cyclus


def impact(land: dict, node_id: str) -> dict:
    geraakt, _ = bereik(land, node_id)
    per_id = {n["id"]: n for n in land["nodes"]}
    processen = sorted(i for i in geraakt if per_id.get(i, {}).get("type") == "proces")
    kritieke = sorted(i for i in processen if per_id[i]["kritiek"])
    return {"node_id": node_id, "geraakt": sorted(geraakt), "processen": processen,
            "kritieke": kritieke}


def dekking(land: dict, proces_id: str) -> int:
    """Hoeveel applicaties een proces direct dragen. 1 betekent geen redundantie."""
    per_id = {n["id"]: n for n in land["nodes"]}
    return sum(1 for bron_id in inkomend(land, proces_id)
               if per_id.get(bron_id, {}).get("type") == "app")


def ranglijst(land: dict) -> list[dict]:
    rijen = [impact(land, n["id"]) for n in land["nodes"] if n["type"] != "proces"]
    return sorted(rijen, key=lambda r: (-len(r["kritieke"]), -len(r["processen"]),
                                        -len(r["geraakt"]), r["node_id"]))


def single_points(land: dict) -> list[str]:
    return sorted(n["id"] for n in land["nodes"]
                  if n["type"] == "proces" and n["kritiek"] and dekking(land, n["id"]) <= 1)


def cyclus_waarschuwingen(land: dict) -> list[str]:
    uit = []
    for node in land["nodes"]:
        _, cyclus = bereik(land, node["id"])
        if cyclus:
            uit.append(f"Cyclus geraakt vanaf {node['id']!r}; de blast radius is berekend maar het "
                       "landschap hoort acyclisch te zijn.")
    return uit


def dragende_nodes(land: dict) -> list[str]:
    """De nodes die een kritiek proces dragen, plus die processen zelf.

    Dit is de deelgraaf die de pagina tekent zodra het landschap groter wordt dan
    bron['graaf_maximum']: alles wat er niet toe doet valt weg, de tabel blijft volledig.
    """
    uit = {n["id"] for n in land["nodes"] if n["type"] == "proces" and n["kritiek"]}
    for node in land["nodes"]:
        if node["type"] != "proces" and impact(land, node["id"])["kritieke"]:
            uit.add(node["id"])
    return sorted(uit)


def kroonjuwelen(bron: dict, dossier: dict) -> list[dict]:
    """Stap 1 van de risicoanalyse: de kritieke processen, zwaarste klasse eerst, met wat ze draagt."""
    per_code = {a["code"]: a for a in dossier.get("applicaties") or []}
    rijen = []
    for proces in dossier.get("processen") or []:
        if not proces.get("kritiek"):
            continue
        klasse = bia(proces.get("bia") or {})["proces"]
        rijen.append({
            "code": proces["code"],
            "naam": proces.get("naam", ""),
            "eigenaar": proces.get("eigenaar", ""),
            "klasse": klasse,
            "klasse_label": label_van_score(bron, klasse),
            "systemen": [per_code.get(c, {}).get("naam") or c for c in proces.get("applicaties") or []],
        })
    return sorted(rijen, key=lambda r: ((r["klasse"] or 9), r["code"]))
