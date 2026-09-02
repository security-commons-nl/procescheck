# Bijdragen

Dit project hoort bij [security-commons-nl](https://github.com/security-commons-nl). De
organisatiebrede regels staan in
[CONTRIBUTING.md](https://github.com/security-commons-nl/.github/blob/main/CONTRIBUTING.md) en het
[redactiestatuut](https://github.com/security-commons-nl/.github/blob/main/REDACTIESTATUUT.md).

## Wat helpt

- **Een vraag die in de praktijk niet werkt.** De zes vragen komen uit een sjabloon dat in gebruik
  was; klemt er een tijdens een interview, dan willen we weten welke en waarom.
- **Een klasse die verkeerd valt.** Noem het proces (verzonnen mag), de zes antwoorden en de klasse
  die je verwachtte.
- **Een landschapsformaat dat we niet lezen.** Exporteert jouw CMDB anders, stuur dan een voorbeeld
  met verzonnen data; het importformaat mag groeien.
- **De risicolaag.** Deze tool zegt hoe erg het is als een proces uitvalt, niet hoe waarschijnlijk dat
  is. De koppeling naar
  [Risicoanalyse langs aanvalspaden](https://security-commons-nl.github.io/kennisbank/security/risicoanalyse-aanvalspaden/)
  loopt nu via de kroonjuwelenlijst in de uitdraai; een betere brug is welkom.

Een [issue](../../issues/new/choose) of
[discussion](https://github.com/security-commons-nl/.github/discussions) is een volwaardige bijdrage.
"Maak maar een pull request" is nooit het antwoord.

## Voor wie een pull request doet

- Nederlands in documentatie en commitboodschappen. Eén onderwerp per commit, met de map als prefix.
- Geen persoonsnamen, organisatienamen of e-mailadressen in documentatie of fixtures (redactiestatuut
  A1 tot en met A3). Alle voorbeelddata is verzonnen en blijft dat.
- **Wijzig `procescheck.json` niet met de hand.** Dat bestand komt uit `instrument/haal_bron.py`, dat
  de code op tag `v0-applicatie` leest; CI controleert het met `--check`.
- Verander je een rekenregel, verander hem dan in `instrument/reken.py` **en** in
  `instrument/bron/app.js` onder dezelfde naam, en draai
  `python instrument/tests/fixtures/maak_doorloop.py` opnieuw. De diff van de fixture laat zien welke
  uitkomsten je hebt veranderd.
- Lees `instrument/LEESMIJ.md` voor de valkuilen: de omgekeerde schaal, half omhoog afronden, lege
  keuzes die `null` moeten worden en de voorvoegsels in de graaf.

## Lokaal bouwen en testen

```bash
git fetch --tags                        # de tag v0-applicatie draagt de bron
python instrument/bouw.py               # instrument/dist/index.html
python -m pytest instrument/tests -v    # 78 tests

npm install && npm run build            # de uitleg op /uitleg/
```

Python 3.12 of nieuwer. Voor de browsertests: `pip install pytest playwright` en
`python -m playwright install chromium`. De pagina is self-contained: geen externe fonts, geen externe
scripts, en een Content-Security-Policy dat dat afdwingt.
