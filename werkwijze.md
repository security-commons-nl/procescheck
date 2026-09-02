# Zo gebruik je procescheck

Een BIA is geen invuloefening maar een gesprek met de proceseigenaar. Deze tool is het formulier
eromheen: hij stelt de vragen in een vaste volgorde, rekent de klasse uit en laat zien wat er nog
ontbreekt. Wat hij niet doet is voor je bedenken hoe erg iets is.

## Wat je ermee bereikt

De applicatie waar procescheck uit voortkomt had vijf doelen; die staan hier, vertaald naar het
instrument.

| Doel | Waar het zit |
|---|---|
| Processen en applicaties centraal vastleggen | Tab *Processen* en *Applicaties*; alles in een dossier |
| BIA en BIV-classificatie uitvoeren en herhalen | Tab *BIA en BIV*, zes vragen per proces |
| Continuiteitseisen expliciet maken | RTO, RPO, WRT en MTPD volgen uit de B-vragen |
| Zien wat af is en wat niet | Tab *Dashboard*: volledigheid, dekking, review, prioriteiten |
| Verantwoorden wat je hebt gedaan | Tab *Uitdraai*: een afdrukbaar dossier met de onderbouwing |

## De schaal loopt andersom dan je verwacht

**1 is Catastrofaal, 5 is Verwaarloosbaar.** De zwaarste klasse is dus het laagste getal, en de
aggregatie is een minimum:

- **B (beschikbaarheid)** = de zwaarste van B1 tot en met B4;
- **I (integriteit)** = de score op I1; **V (vertrouwelijkheid)** = de score op V1;
- **procesklasse** = de zwaarste van B, I en V.

Beantwoord je maar een deel van de vragen, dan rekent de tool met wat er staat. Een leeg antwoord telt
niet mee en trekt de klasse dus niet omlaag.

## De zes vragen en wat eruit volgt

| Vraag | Gaat over | Levert |
|---|---|---|
| B1 | Maximale uitvalduur voordat onaanvaardbare gevolgen optreden | RTO |
| B2 | Maximale hoeveelheid dataverlies die acceptabel is | RPO |
| B3 | Tijd om na herstel de achterstand in te halen | WRT |
| B4 | Maximale tijd dat het proces stil kan liggen, alles bij elkaar | MTPD |
| I1 | Impact als informatie onjuist, onvolledig of gemanipuleerd is | I-score |
| V1 | Impact als informatie ongeautoriseerd wordt ingezien of verspreid | V-score |

De antwoordtekst onder de keuzelijst is de omschrijving die bij die klasse hoort. Lees hem voor tijdens
het interview; hij is preciezer dan het label. Bij V1 zijn de vijf antwoorden de rubriceringsniveaus
Geheim, Confidentieel, Vertrouwelijk, Intern en Openbaar.

**Vul de onderbouwing in.** Het cijfer is over een jaar niet meer uit te leggen, de zin eronder wel.
De uitdraai zet die zinnen achter de scores.

## RTO en RPO met de hand

Onder de uitkomst staan losse velden voor RTO en RPO. Die zijn er voor een expliciete afspraak
("hersteltijd 4 uur, vastgelegd in het contract") naast de klasse die uit de vragen volgt.

Let op, en dit is met opzet zo gehouden: **de volledigheidscontrole "RTO / RPO" kijkt naar de
BIA-vragen B1 en B2, niet naar deze velden.** Vul je alleen de handmatige velden in, dan blijft het
proces als onvolledig staan. Dat is trouw aan hoe de applicatie het deed, en het is verdedigbaar: de
klasse komt uit het gesprek met de eigenaar, het getal in het contract is een afgeleide daarvan.

## Wanneer een proces compleet is

Tien controles per proces, in deze volgorde: beschrijving, doelstelling, eigenaar, afdeling, laatste
beoordelingsdatum, reden kritiek (alleen bij een kritiek proces), gekoppelde applicaties, BIA/BIV,
RTO/RPO en businesscontext.

- **compleet**: niets ontbreekt · **aandacht**: 1 tot 3 ontbreken · **onvolledig**: 4 of meer.

Daaruit volgt de prioriteit in het dashboard, in deze volgorde van beoordelen:

1. **critical** — kritiek proces zonder BIA. Je weet niet hoe erg het is bij het proces waar het het
   meest toe doet.
2. **high** — hoog risico (een van B, I, V is 1 of 2) zonder RTO en RPO.
3. **high** — kritiek proces dat verder onvolledig is.
4. **medium** — vier of meer velden ontbreken.
5. **low** — een tot drie velden ontbreken.

## Op tijd beoordeeld

Een datum is "op tijd" als hij niet ouder is dan een jaar. Het dashboard telt dat voor vier dingen: de
procesbeoordeling, het BIA-interview, de review van de businesscontext en de review per applicatie.
Een leeg datumveld telt als niet op tijd; dat is geen straf maar een vraag.

## De blast radius

Importeer je CI-landschap (JSON of CSV, formaat in de verantwoording) of vul de componenten met de
hand. De keten loopt van component naar applicatie naar proces, en de analyse beantwoordt drie vragen:

- **Wat valt er om** als dit onderdeel uitvalt: alles wat er stroomafwaarts van hangt, met daarin de
  processen en de kritieke processen apart geteld. De ranglijst zet bovenaan wat de meeste kritieke
  processen raakt.
- **Waar zit geen redundantie**: kritieke processen die op hoogstens een applicatie steunen.
- **Klopt het landschap**: relaties naar een onbekend doel en cycli worden gemeld, niet stil genegeerd.

De tekening is dezelfde data in drie kolommen. Klik op een onderdeel om te zien wat eronder valt. Bij
meer dan zestig onderdelen tekent hij alleen wat een kritiek proces draagt; de tabel blijft volledig.

Importeren voegt toe en overschrijft niets. Een proces of applicatie die de tool herkent aan de code of
de naam, blijft staan zoals hij is; een tweede import van hetzelfde bestand verandert niets.

## De uitdraai

Alles op een rij, in negen hoofdstukken, afdrukbaar op A4 met de knop *Afdrukken* of Ctrl+P.
Hoofdstuk 3 is de **kroonjuwelenlijst**: de kritieke processen, zwaarste klasse eerst, met eigenaar en
de systemen eronder. Dat is de tabel waar
[Risicoanalyse langs aanvalspaden](https://security-commons-nl.github.io/kennisbank/security/risicoanalyse-aanvalspaden/)
in stap 1 om vraagt. Staat er meer dan tien in, kies er dan tien; de risicoanalyse werkt met een korte
lijst, anders wordt het een inventarisatie in plaats van een analyse.

## Je dossier

Alles blijft in je browser. *Dossier opslaan* geeft je een JSON-bestand
(`procescheck-dossier-<organisatie>-<datum>.json`) dat je kunt delen, archiveren en later terugzetten.
Bewaar het in je eigen documentbeheer; git of een gedateerde kopie is je audit trail. Er is geen
auditlog in de tool, want die had alleen zin toen meerdere mensen in dezelfde database werkten.

In het bestand staat een vingerafdruk van de bron. Laad je later een dossier terwijl de vragen
inmiddels zijn gewijzigd, dan zegt de tool dat erbij en loop je de uitkomsten na.
