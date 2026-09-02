# Waar de inhoud vandaan komt

Een instrument dat een klasse aan een proces hangt, moet kunnen zeggen waar die klasse vandaan komt.
Hier staat per onderdeel wat is overgenomen, wat eigen invulling is, en waar de bron zichzelf
tegenspreekt.

## De vragen en de antwoordklassen

De zes vragen, de vijf antwoordklassen en de omschrijving per klasse komen **woordelijk** uit de
applicatie die procescheck tot september 2026 was. Die applicatie noemt als herkomst het sjabloon
*Template BIA & BIV-Classificatie.xlsx*.

De bron is geen overgetypte kopie. `instrument/haal_bron.py` leest de code op de git-tag
`v0-applicatie` (`frontend/src/pages/Bia/BiaPage.tsx` en `biaShared.tsx`) en schrijft daar
`procescheck.json` uit; `instrument/tests/test_bron.py` legt elke vraag, elke tooltip en elk van de
dertig antwoordteksten daarna weer naast diezelfde code. Wijkt er een letter af, dan valt de test om.
De tag staat vast en verhuist niet.

**B1 en B2 hebben dezelfde vijf antwoordteksten.** Zo staat het in de bron: het sjabloon herhaalde de
alinea bij de vraag over uitvalduur en die over dataverlies. Dat is geen fout van het extractiescript.
De vragen zelf verschillen wel, en de parameters die eruit volgen ook (RTO tegenover RPO).

## De continuiteitsparameters, en waar de bron zichzelf tegenspreekt

B1 levert de RTO, B2 de RPO, B3 de WRT en B4 de MTPD. Die koppeling staat als commentaar in de
oorspronkelijke code en is hier vastgelegd. De labels per score komen uit `PARAM_MAP` in
`biaShared.tsx`; voor de RTO staan dezelfde vijf teksten in `backend/app/routers/export.py`, en de
test vergelijkt beide.

Daarnaast bestaat er een klassentabel in `Docs/MTPD-RTO-WRT-RPO-classificatie.md`, die je in de tool
terugvindt onder *De klassen naast elkaar*. **Voor de WRT lopen die twee tegen elkaar in:**

| | Catastrofaal (1) | Verwaarloosbaar (5) |
|---|---|---|
| Vragenlijst (`PARAM_MAP`) | Enkele uren | Meer dan een week |
| Klassentabel (`Docs/`) | meerdere werkdagen | minder dan 1 uur |

Dat is te verklaren: de tabel leest WRT als "hoeveel tijd heb je nog om de achterstand weg te werken"
(bij een catastrofaal proces heb je die tijd juist niet, dus staat er ruimte in de tabel als
tegenwicht bij RTO), terwijl de vragenlijst vraagt hoeveel tijd je nodig hebt. Beide zijn overgenomen
zoals ze in de bron staan; we hebben er niet stilzwijgend een van rechtgezet, want dan zou de tool
iets anders zeggen dan de organisatie die ermee werkte. **De vragenlijst bepaalt de score, de tabel is
naslag.** Een test legt dit verschil vast, zodat het een besluit blijft en geen slordigheid wordt.

## De rekenregels

De aggregatie (`min` over de ingevulde scores), de tien volledigheidscontroles, de prioriteitsregels,
de dekkingspercentages en de reviewregel van een jaar komen uit `backend/app/routers/dashboard.py` op
dezelfde tag. `instrument/reken.py` is de referentie-implementatie; `instrument/bron/app.js` heeft
dezelfde functies onder dezelfde namen, en de browsertests vergelijken wat op het scherm staat met wat
de referentie uitrekent.

Twee dingen wijken bewust af van de applicatie:

1. **Het gedachtestreepje wordt een komma.** De reden die in de code als `Kritisch proces`, gedachtestreepje, `onvolledig gedocumenteerd` staat,
   heet hier `Kritisch proces, onvolledig gedocumenteerd`; de commons schrijft geen gedachtestreepjes.
2. **De lichtste prioriteit heet `low` en niet `medium`.** In de applicatie kregen "vier of meer
   velden ontbreken" en "een tot drie velden ontbreken" allebei het label `medium`, met alleen een
   ander redentekst. Hier heet de tweede `low`, zodat de prioriteit gelijkloopt met de bandbreedtes
   die de applicatie zelf al hanteerde voor volledigheid (0 compleet, 1 tot 3 aandacht, 4 of meer
   onvolledig). De redenteksten zijn wel letterlijk overgenomen, inclusief het verschil tussen
   "velden ontbreken" en "veld(en) ontbreken".

**Afronden gebeurt half omhoog.** Dat lijkt een detail en is het niet: Python rondt 12,5 af naar 12
(banker's rounding), JavaScript naar 13. Zonder een gedeelde regel zou de referentie een ander
percentage tonen dan de pagina. Beide kanten gebruiken `floor(x + 0.5)`, en een test bewaakt het.

## De blast radius

De analyse komt uit [blast-radius](https://github.com/security-commons-nl/blast-radius), een losse
CLI die in september 2026 in procescheck is opgegaan. Reden: de vraag "wat valt er om" gaat over
processen, en de data (proces, applicatie, component) stond hier al. De rekenregels zijn
overgenomen uit `blastradius/analysis.py`: het bereik is de transitieve afsluiting over de uitgaande
relaties, de dekking telt de dragende applicaties per proces, en de ranglijst sorteert op kritieke
processen, dan processen, dan omvang. Een test vergelijkt de uitkomst met die van de oorspronkelijke
CLI zolang die repo ernaast staat.

Het importformaat is dat van `blastradius/parsers.py`:

- **JSON**: `{"nodes": [{"id", "label", "type", "kritiek"}], "edges": [{"from", "to", "relatie"}]}`,
  met `type` uit `ci`, `app` of `proces`. Een relatie loopt van drager naar gedragene
  (`ci-db01` → `app-brp` → `proc-paspoort`).
- **CSV**: een regel per relatie, kolommen `from, from_label, from_type, from_kritiek, to, to_label,
  to_type, to_kritiek, relatie`. Ontbreekt `from_type`, dan is het een `ci`; ontbreekt `to_type`, dan
  een `proces`. Kritiek is waar bij `ja`, `true`, `1` of `yes`.

Het voorbeeldlandschap in de tool is de testdata van blast-radius: verzonnen, maar herkenbaar
gemeentelijk.

Eigen invulling bij het opgaan: de ids krijgen in de graaf een voorvoegsel (`proces:`, `app:`, `ci:`),
zodat een proces P01 en een applicatie P01 elkaar niet overschrijven, en een relatie naar een doel dat
noch applicatie noch component is, wordt als waarschuwing gemeld in plaats van stil overgeslagen.

## Wat eigen invulling is

- De **kroonjuwelenlijst** in de uitdraai: de kritieke processen, zwaarste klasse eerst, in de kolommen
  die stap 1 van de risicoanalyse langs aanvalspaden vraagt.
- Het veld **soort** bij een applicatie (`applicatie` of `object met industriële automatisering`) en de
  optionele verwijzing naar een **CSIR-dossier**. Dat is de haak naar de
  [CSIR Assessment Tool](https://security-commons-nl.github.io/csir-assessment-tool/) en verplicht tot
  niets.
- Het **dossierformaat** (JSON met een vingerafdruk van de bron) en de uitdraai zelf.

## Wat is vervallen ten opzichte van de applicatie

Inloggen met Azure AD, de auditlog, de exportserver voor xlsx, docx en pptx, de Docker-omgeving en de
losse pagina Ketenarchitectuur. Dat was geen inhoud maar hosting: een database, een account en een
beheerder tussen jou en een formulier met zes vragen. De auditlog bestond omdat meerdere mensen in
dezelfde database werkten; een dossier op je eigen schijf heeft git of een gedateerde kopie als audit
trail. De graaf uit de Ketenarchitectuur-pagina is teruggekomen als de tekening bij de blast radius.

Zestien vraagslots uit het oorspronkelijke sjabloon (`b5` tot en met `b8`, `i2` tot en met `i7`, `v2`
tot en met `v7`) zijn niet meegegaan: ze werden nergens gesteld. Wie ze nodig heeft, voegt ze toe aan
`procescheck.json`; de pagina toont wat er in de bron staat.

## Wat dit niet is

Geen technische verificatie en geen risicoanalyse. De uitkomst komt uit je eigen antwoorden. De klasse
zegt hoe erg het is als het misgaat, niet hoe waarschijnlijk dat is en niet of je maatregelen deugen.
Voor de vraag hoe een aanvaller bij een kroonjuweel komt, gebruik je de risicoanalyse langs
aanvalspaden; voor de eisen aan een object met industriele automatisering de CSIR Assessment Tool.
