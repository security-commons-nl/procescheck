# procescheck

Business Impact Analyse en BIV-classificatie per bedrijfsproces, met de applicaties en
infrastructuurcomponenten die eronder liggen.

Vier stappen achter elkaar. Je legt je **processen** vast en zegt welke kritiek zijn. Je koppelt de
**applicaties** die ze dragen. Je beantwoordt per proces **zes vragen** over beschikbaarheid,
integriteit en vertrouwelijkheid; daaruit volgen de BIV-scores, de procesklasse en de continuiteits-
parameters RTO, RPO, WRT en MTPD. En je importeert je **CI-landschap**, waarna de blast radius laat
zien wat er omvalt als een component uitvalt, en welke kritieke processen op maar een enkele
applicatie steunen.

Het rekent in je eigen browser: geen server, geen account, geen telemetrie. Je dossier is een
JSON-bestand dat je zelf opslaat en dat je apparaat niet verlaat.

**[Open de tool](https://security-commons-nl.github.io/procescheck/)** ·
[uitleg en verantwoording](https://security-commons-nl.github.io/procescheck/uitleg/)

Status: prototype. Werkt en is te draaien, maar zonder belofte over volledigheid, onderhoud of
ondersteuning. De vragen, de antwoordklassen en de rekenregels zijn woordelijk overgenomen uit de
applicatie die procescheck tot september 2026 was (tag `v0-applicatie`) en staan getest in
`procescheck.json`. Wat nog niet is beproefd: het gebruik in een echte BIA-ronde met meerdere
proceseigenaren.

## Voor wie

CISO's, informatiebeveiligers en proceseigenaren bij publieke organisaties die een BIA of
BIV-classificatie moeten doen, en iedereen die wil weten welke processen omvallen als een component
uitvalt. Je hebt niets nodig behalve een browser.

## Snel starten

1. Open **[de tool](https://security-commons-nl.github.io/procescheck/)**. Wil je hem offline? Sla de
   pagina op met Ctrl+S; alles zit erin, ook de vragen en de rekenregels.
2. Vul bij **Processen** je organisatie in en voeg je processen toe. Zet het vinkje *kritiek* bij de
   processen waar de dienstverlening op stilvalt.
3. Voeg bij **Applicaties** de systemen toe en koppel ze aan de processen. Een object met industriele
   automatisering hoort er ook bij; voor de eisen aan zo'n object bestaat de
   [CSIR Assessment Tool](https://security-commons-nl.github.io/csir-assessment-tool/), en je kunt
   hier naar dat dossier verwijzen.
4. Beantwoord bij **BIA en BIV** de zes vragen per proces. De schaal loopt van 1 (Catastrofaal) tot 5
   (Verwaarloosbaar): **1 is het ergst**, en de zwaarste score telt.
5. Vul bij **Businesscontext** in waar het proces van afhangt en wie het raakt.
6. Importeer bij **Blast radius** je CI-landschap als JSON of CSV, of klik *Voorbeeld laden* om te
   zien wat de analyse doet. Het formaat staat in
   [de verantwoording](https://security-commons-nl.github.io/procescheck/uitleg/#verantwoording).
7. Kijk op het **Dashboard** wat als eerste aandacht vraagt en druk de **Uitdraai** af.

Sla je dossier tussendoor op met *Dossier opslaan*. De browser onthoudt je werk ook zelf, maar een
opgeslagen bestand is wat je deelt, archiveert en de volgende ronde terugzet.

De **Uitdraai** bevat een kroonjuwelenlijst: de kritieke processen met hun eigenaar en de systemen
eronder. Dat is precies stap 1 van
[Risicoanalyse langs aanvalspaden](https://security-commons-nl.github.io/kennisbank/security/risicoanalyse-aanvalspaden/).

### Zelf bouwen

```bash
python instrument/haal_bron.py --check   # procescheck.json loopt gelijk met tag v0-applicatie
python instrument/bouw.py                # schrijft instrument/dist/index.html
python -m pytest instrument/tests -v     # 78 tests, inclusief een doorloop in Chromium
```

Python 3.12 of nieuwer, alleen standaardbibliotheek. Voor de browsertests: `pip install pytest
playwright` en `python -m playwright install chromium`. `git fetch --tags` is nodig voor de tag
`v0-applicatie`, waar de bron uit komt.

## Bijdragen

Zie [CONTRIBUTING.md](CONTRIBUTING.md). Een vraag die niet klopt, een klasse die verkeerd valt of een
landschapsformaat dat we niet lezen: open een issue. Wijzig `procescheck.json` niet met de hand; dat
bestand komt uit `instrument/haal_bron.py` en CI controleert dat.

## Licentie

[EUPL-1.2](LICENSE). De vragen en antwoordteksten komen uit het sjabloon *Template BIA &
BIV-Classificatie.xlsx* dat de oorspronkelijke applicatie gebruikte; zie de verantwoording.
