#!/usr/bin/env python3
"""Maakt de invoerfixtures van de AI-hulp: een procesdocument, een CMDB-export als CSV en als xlsx.

Alles verzonnen: Gemeente Voorbeeld, met namen die geen bestaande persoon aanduiden. De xlsx wordt
zonder openpyxl geschreven (zipfile plus de kale XML die een werkblad nodig heeft), zodat de fixture
reproduceerbaar is en de xlsx-lezer in kern.py precies dit soort minimale bestanden aankan.

Aanroep:
    python ai/tests/fixtures/maak_fixtures.py
"""
from __future__ import annotations

import pathlib
import zipfile

HIER = pathlib.Path(__file__).resolve().parent

PROCESSEN_MD = """# Gemeente Voorbeeld: overzicht van de dienstverlening

Dit overzicht beschrijft de belangrijkste werkprocessen van de gemeente, per afdeling, met de
verantwoordelijke en het doel. Het is opgesteld voor de jaarlijkse actualisatie van het
continuiteitsplan.

## Afdeling Burgerzaken

**Paspoort- en rijbewijsuitgifte.** Inwoners vragen aan de balie of online een paspoort,
identiteitskaart of rijbewijs aan; de afdeling controleert de identiteit, verwerkt de aanvraag in de
basisregistratie en reikt het document uit. Doel: elke inwoner binnen de wettelijke termijn van een
geldig reisdocument of rijbewijs voorzien. Verantwoordelijke: teamleider Burgerzaken. Dit proces mag
niet langer dan een werkdag stilliggen: zonder documenten kunnen inwoners niet reizen en niet stemmen,
en de wettelijke leveringstermijn wordt overschreden.

**Verhuizingen en inschrijvingen.** Het verwerken van aangiften van verhuizing, vestiging vanuit het
buitenland en emigratie in de basisregistratie personen. Doel: een actuele en juiste registratie van
alle inwoners. Verantwoordelijke: teamleider Burgerzaken.

## Afdeling Werk en Inkomen

**Uitkeringsverstrekking.** Het beoordelen van aanvragen voor bijstand en het maandelijks uitbetalen
van uitkeringen aan ongeveer 1.400 huishoudens. Doel: inwoners zonder inkomen tijdig van een
bestaansminimum voorzien. Verantwoordelijke: afdelingshoofd Werk en Inkomen. Een verstoring van de
maandelijkse betaalrun heeft direct gevolgen voor huishoudens die van deze uitkering afhankelijk zijn;
dit proces is daarom aangemerkt als vitaal.

**Re-integratie en begeleiding.** Het begeleiden van werkzoekenden naar werk of participatie, in
samenwerking met het regionale werkbedrijf. Doel: zoveel mogelijk inwoners duurzaam aan het werk.
Verantwoordelijke: afdelingshoofd Werk en Inkomen.

## Afdeling Vergunningen, Toezicht en Handhaving

**Vergunningverlening.** Het behandelen van aanvragen voor omgevingsvergunningen, evenementen en
horeca, inclusief de wettelijke publicatie en de bezwaartermijn. Doel: aanvragen binnen de termijn van
de Omgevingswet afhandelen. Verantwoordelijke: teamleider Vergunningen.

**Toezicht en handhaving.** Het controleren van naleving van vergunningen en regels in de openbare
ruimte en het optreden bij overtredingen. Verantwoordelijke: teamleider Toezicht.

## Bedrijfsvoering

**Financiele administratie en betalingen.** Het verwerken van inkomende facturen, het uitvoeren van
betalingen aan leveranciers en het innen van gemeentelijke belastingen. Doel: een rechtmatige en tijdige
financiele afwikkeling. Verantwoordelijke: concerncontroller, afdeling Financien.

**Archiefbeheer.** Het bewaren en op termijn vernietigen of overbrengen van archiefbescheiden volgens de
Archiefwet. Verantwoordelijke: gemeentearchivaris.

De afdeling Communicatie verzorgt de website en de sociale media van de gemeente; het team ICT beheert
de werkplekken en het netwerk. Beide zijn ondersteunend aan de processen hierboven.
"""

CMDB_RIJEN = [
    ["id", "naam", "type", "omschrijving", "functioneel_beheer", "technisch_beheer", "draait_op", "ondersteunt", "kritiek"],
    ["APP-001", "Zaaksysteem", "applicatie", "Zaakgericht werken voor vergunningen en meldingen", "coordinator dienstverlening", "leverancier ZaakSoft", "srv-zaak01", "Vergunningverlening; Toezicht en handhaving", "ja"],
    ["APP-002", "BRP-applicatie", "applicatie", "Bijhouding basisregistratie personen", "teamleider Burgerzaken", "applicatiebeheerder BRP", "srv-brp01", "Paspoort- en rijbewijsuitgifte; Verhuizingen en inschrijvingen", "ja"],
    ["APP-003", "Uitkeringsadministratie", "applicatie", "Berekening en betaling van uitkeringen", "afdelingshoofd Werk en Inkomen", "leverancier SocialeZaken BV", "srv-wi01", "Uitkeringsverstrekking", "ja"],
    ["APP-004", "Financieel systeem", "applicatie", "Grootboek, crediteuren, debiteuren en belastingen", "concerncontroller", "applicatiebeheerder Financien", "srv-fin01", "Financiele administratie en betalingen", "ja"],
    ["APP-005", "Documentmanagementsysteem", "applicatie", "Opslag en archivering van documenten", "gemeentearchivaris", "team ICT", "srv-dms01", "Archiefbeheer", "nee"],
    ["APP-006", "Toegangscontrole stadhuis", "installatie", "Elektronische deuren en pasjes van het stadhuis", "facilitair manager", "leverancier SecuDoor", "ctl-toegang01", "", "nee"],
    ["APP-007", "Website gemeente", "applicatie", "Publiekswebsite en digitale formulieren", "communicatieadviseur", "leverancier WebGem", "extern (SaaS)", "Vergunningverlening; Paspoort- en rijbewijsuitgifte", "nee"],
    ["LIC-101", "Microsoft 365 licenties", "licentie", "Jaarlicentie werkplekken", "team ICT", "", "", "", "nee"],
    ["SRV-201", "srv-zaak01", "server", "Applicatieserver zaaksysteem", "", "team ICT", "netwerk-core", "", "ja"],
    ["SRV-202", "srv-brp01", "server", "Applicatieserver BRP", "", "team ICT", "netwerk-core", "", "ja"],
    ["SRV-203", "srv-wi01", "server", "Applicatieserver Werk en Inkomen", "", "team ICT", "netwerk-core", "", "ja"],
    ["SRV-204", "srv-fin01", "server", "Applicatieserver financieel systeem", "", "team ICT", "netwerk-core", "", "ja"],
    ["SRV-205", "srv-dms01", "server", "Applicatieserver DMS", "", "team ICT", "netwerk-core", "", "nee"],
    ["SRV-206", "db-centraal01", "database", "Centrale databaseserver voor zaaksysteem, BRP en financieel", "", "team ICT", "netwerk-core", "srv-zaak01; srv-brp01; srv-fin01", "ja"],
    ["NET-301", "netwerk-core", "netwerk", "Kernswitch serverruimte", "", "team ICT", "", "", "ja"],
    ["NET-302", "auth-proxy", "koppeling", "DigiD-koppelvlak", "", "team ICT", "netwerk-core", "APP-002; APP-007", "ja"],
    ["CTL-401", "ctl-toegang01", "besturing", "Controller toegangscontrole", "", "leverancier SecuDoor", "netwerk-core", "", "nee"],
    ["CON-501", "Onderhoudscontract ZaakSoft", "contract", "SLA zaaksysteem, looptijd tot 2028", "inkoop", "", "", "", "nee"],
]


def csv_tekst(rijen: list[list[str]]) -> str:
    def cel(w: str) -> str:
        return '"' + w.replace('"', '""') + '"' if ("," in w or '"' in w or ";" in w) else w
    return "\n".join(",".join(cel(w) for w in rij) for rij in rijen) + "\n"


def xlsx_bytes(rijen: list[list[str]], pad: pathlib.Path) -> None:
    """Een minimale xlsx: alle cellen als inline strings, zodat er geen sharedStrings nodig zijn.

    Excel en LibreOffice openen dit; de lezer in kern.py leest het ook, en ook de variant met
    sharedStrings die echte exports gebruiken (daar is een aparte test voor).
    """
    def kolom(n: int) -> str:
        uit = ""
        n += 1
        while n:
            n, rest = divmod(n - 1, 26)
            uit = chr(65 + rest) + uit
        return uit

    def ontsnap(t: str) -> str:
        return t.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")

    cellen = []
    for r, rij in enumerate(rijen, start=1):
        delen = "".join(
            f'<c r="{kolom(k)}{r}" t="inlineStr"><is><t>{ontsnap(w)}</t></is></c>'
            for k, w in enumerate(rij))
        cellen.append(f'<row r="{r}">{delen}</row>')
    blad = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
            '<sheetData>' + "".join(cellen) + '</sheetData></worksheet>')
    werkboek = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
                'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
                '<sheets><sheet name="CMDB" sheetId="1" r:id="rId1"/></sheets></workbook>')
    rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
            '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
            '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
            '</Relationships>')
    root_rels = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
                 '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
                 '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
                 '</Relationships>')
    types = ('<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
             '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
             '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
             '<Default Extension="xml" ContentType="application/xml"/>'
             '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
             '<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
             '</Types>')
    # Vaste datum in de zip, zodat het bestand byte-gelijk blijft bij opnieuw genereren.
    with zipfile.ZipFile(pad, "w", zipfile.ZIP_DEFLATED) as z:
        for naam, inhoud in (("[Content_Types].xml", types), ("_rels/.rels", root_rels),
                             ("xl/workbook.xml", werkboek), ("xl/_rels/workbook.xml.rels", rels),
                             ("xl/worksheets/sheet1.xml", blad)):
            info = zipfile.ZipInfo(naam, date_time=(2026, 9, 3, 0, 0, 0))
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, inhoud.encode("utf-8"))


def main() -> int:
    (HIER / "voorbeeld-processen.md").write_bytes(PROCESSEN_MD.encode("utf-8"))
    (HIER / "voorbeeld-cmdb.csv").write_bytes(csv_tekst(CMDB_RIJEN).encode("utf-8"))
    xlsx_bytes(CMDB_RIJEN, HIER / "voorbeeld-cmdb.xlsx")
    (HIER / "antwoorden").mkdir(exist_ok=True)
    print(f"voorbeeld-processen.md: {len(PROCESSEN_MD)} tekens; voorbeeld-cmdb: {len(CMDB_RIJEN) - 1} rijen, csv en xlsx")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
