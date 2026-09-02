# De AI-hulp van procescheck

Een aparte pagina (`/procescheck/ai/`) die met de API-sleutel van de gebruiker een procesdocument of een
CMDB-export omzet naar een **voorstel** in het datamodel van de tool. De tool zelf praat nooit met een
leverancier; alleen deze pagina, alleen op verzoek, alleen met de sleutel die de gebruiker invult. Het
patroon is dat van `anonimizer-browser`, en het staat uitgewerkt in het bouwplan
`2026-09-03-ai-hulp.md` in de `.github`-repo van de commons.

| Bestand | Wat het doet |
|---|---|
| `opdrachten.json` | De opdrachten: per opdracht de systeemprompt, het JSON-schema van de uitkomst, de toegestane invoer en een voorbeeld. Data, geen code. |
| `kern.py` | Referentie voor alles wat deterministisch is: schema-controle, chunking, samenvoegen, csv en xlsx lezen, citaatcontrole, vergelijken en toepassen. |
| `bron/kern.js` | Dezelfde functies onder dezelfde namen. Gaat ook mee in de tool (voor *Voorstel laden*) en kent daarom **geen netwerk**. |
| `bron/ai.js` | De zeven stappen van de pagina en de enige plek met `fetch`. |
| `bouw.py` | Zet opdrachten, kern en pagina in een bestand met een CSP dat naar buiten mag: `connect-src https: http://localhost:*`. |
| `tests/fixtures/neem_op.py` | Neemt de voorbeeldantwoorden een keer echt op. Daarna staan ze in git en draaien de tests zonder sleutel. |

## Hoe een aanroep loopt

1. De gebruiker kiest een leverancier (Mistral, een lokale Ollama, of een andere OpenAI-compatibele
   endpoint) en vult een sleutel in. Die staat alleen in `sessionStorage` en verdwijnt met de tab.
2. *Verbinding testen* doet `GET /v1/models`. Pas daarna gaan de volgende stappen open.
3. De invoer (geplakte tekst, `.txt`, `.md`, `.csv` of `.xlsx`) wordt in de browser naar tekst gezet;
   een tabel wordt markdown, zodat het model kolomkoppen ziet. Een xlsx wordt gelezen met
   `DecompressionStream`, zonder bibliotheek.
4. Toestemming per sessie: de pagina zegt wat er waarheen gaat en hoeveel aanroepen het kost.
5. Per stuk van hoogstens 24.000 tekens één `POST /v1/chat/completions` met de systeemprompt plus de
   vaste regels en het stuk; `temperature: 0`; eerst `response_format: json_schema`, bij een 400 opnieuw
   met `json_object`; bij 429 wachten (2, 4, 8 seconden). Een antwoord dat niet aan het schema voldoet,
   wordt één keer teruggestuurd met de fouten erbij.
6. De stukken worden samengevoegd (dubbele codes krijgen een achtervoegsel), elk item krijgt de
   citaatcontrole, en het voorstel is een JSON-bestand met de sha256 van de invoer erin: nooit de invoer
   zelf, nooit de sleutel.
7. In de tool: *Voorstel laden* legt het naast het dossier (nieuw / bestaand / conflict / niet in bron),
   de gebruiker kiest per regel, en pas *Overnemen* verandert het dossier. Elke overname staat in
   `herkomst_ai` en in de uitdraai.

## Regels die niet vanzelf spreken

**De AI schrijft nooit in het dossier.** De pagina levert een bestand; de tool past het toe met
`kern.pas_toe`, dat nooit iets verwijdert en bij *samenvoegen* alleen lege velden vult.

**Het citaat is de hallucinatiecheck.** Elk item draagt een `bronregel`: een letterlijk citaat. De
controle knipt het op zinseinden en tabelstrepen en eist dat elk stuk van minstens twaalf tekens in de
invoer voorkomt. Een model dat een zin overslaat en de rest aan elkaar plakt, komt erdoor; een verzonnen
zin niet. Zo'n item staat standaard op *overslaan*.

**`kern.js` kent geen `fetch`.** Het bestand gaat mee in de tool, en de tool mag geen netwerk kennen.
`instrument/bouw.py` en `ai/bouw.py` weigeren te bouwen als dat toch zo is; de tests van de tool
bewaken dat `fetch(` niet in `dist/index.html` staat en dat een volledige doorloop geen enkel verzoek
naar buiten doet.

**Geen prompt vraagt om een oordeel.** Geen score, klasse of prioriteit; dat rekent de tool.
`test_opdrachten.py` bewaakt het.

**`mistral-medium-latest` is de standaard**, niet `mistral-large`: die laatste is niet op elk
abonnement beschikbaar en geeft dan een 403. De gebruiker kan elk model invullen.

## Een opdracht toevoegen

1. Voeg in `opdrachten.json` een opdracht toe met `id`, `titel`, `uitleg`, `invoer`, `doel`,
   `systeemprompt`, `schema` (met `additionalProperties: false`, `bronregel` op elk item en `onzeker`
   op de uitkomst) en `voorbeeld`.
2. Zet een verzonnen voorbeeldinvoer in `tests/fixtures/` (via `maak_fixtures.py`, zodat hij
   reproduceerbaar is).
3. Neem het antwoord op: `MISTRAL_API_KEY=... python ai/tests/fixtures/neem_op.py <id>`. Kijk het na.
4. Breid `test_opdrachten.py` uit met wat het antwoord hoort te bevatten, en `kern.vergelijk` en
   `kern.pas_toe` (Python én JavaScript) als het doel een nieuw deel van het dossier is.
5. Draai alles: `python -m pytest ai/tests -v` en `python -m pytest instrument/tests -v`.

## Draaien en testen

```bash
python ai/bouw.py                      # ai/dist/index.html
python -m pytest ai/tests -v           # 41 tests, de leverancier nagespeeld
python -m pytest instrument/tests -v   # de tool, met Voorstel laden erbij
```

De twee testmappen draai je apart; ze hebben elk een eigen `conftest.py`.
