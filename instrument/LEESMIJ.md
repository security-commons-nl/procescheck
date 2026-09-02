# De machinerie van procescheck

Vier bestanden dragen de tool. Wie hier iets verandert, verandert wat de pagina uitrekent; lees eerst
waarom het staat zoals het staat.

| Bestand | Wat het doet |
|---|---|
| `haal_bron.py` | Leest de code op tag `v0-applicatie` en schrijft `procescheck.json`. `--check` faalt als de bron is gaan schuiven. |
| `reken.py` | De referentie-implementatie van alle rekenregels, inclusief de blast radius. Puur, zonder bestanden. |
| `bouw.py` | Zet `procescheck.json`, `bron/app.css` en `bron/app.js` in `bron/index.html` en schrijft `dist/index.html`. |
| `bron/app.js` | Dezelfde rekenregels als `reken.py`, onder dezelfde namen in het object `reken`, plus de pagina. |

## De volgorde

```bash
git fetch --tags                        # de tag v0-applicatie moet er zijn
python instrument/haal_bron.py          # procescheck.json bijwerken (zelden nodig)
python instrument/bouw.py               # instrument/dist/index.html
python -m pytest instrument/tests -v    # alles
```

`instrument/tests/fixtures/maak_doorloop.py` maakt de drie fixtures opnieuw. Draai hem als je de
rekenregels wijzigt, en kijk daarna naar de diff: die vertelt je precies welke uitkomsten je hebt
veranderd. Een test controleert dat opnieuw genereren hetzelfde bestand oplevert.

## Regels die niet vanzelf spreken

**De schaal loopt omgekeerd.** 1 is Catastrofaal, 5 is Verwaarloosbaar, en de aggregatie is `min`. Wie
hier een `max` schrijft, krijgt groene dashboards bij rode processen.

**Nooit `round()`, nooit `Math.round()`.** Python rondt 12,5 naar 12 en JavaScript naar 13. Alle
afrondingen lopen door `rond_half_omhoog`; `test_rond_half_omhoog` legt de valkuil vast.

**Een lege keuzelijst wordt `null`, niet `0`.** In JavaScript is `Number('')` gelijk aan 0, en 0 wint
elke `min`. `app.js` leest scores daarom als `waarde === '' ? null : parseInt(waarde, 10)`, en
`test_bouw.py` verbiedt `Number(` in het hele bestand.

**Ids krijgen een voorvoegsel zodra ze in de graaf komen.** In het dossier staan kale codes (`P01`,
`A01`, `ci-db1`), in `reken.landschap` en alles daarna `proces:P01`, `app:A01`, `ci:ci-db1`. Een
`bereik()` zonder voorvoegsels is fout, ook als de test toevallig slaagt omdat de codes uniek zijn.

**Een relatie naar een onbekend doel is een waarschuwing, geen stilte.** `component_edges[].to` wordt
eerst tegen de applicatiecodes gehouden, dan tegen de component-ids; matcht hij nergens, dan komt hij
in `waarschuwingen` en niet in de graaf.

**Regeleindes eerst normaliseren.** `git show` kan op Windows `\r\n` opleveren; zonder normaliseren
staan er wagenterugloop-tekens in de tooltips en verschilt de bron per machine.

**De pagina bevat geen tweede kopie van de inhoud.** Vragen, labels, redenteksten en parameters komen
alleen uit `window.__BRON__`. `test_bouw.py` blokkeert het als een vraagtekst of een klasselabel in
`app.js` opduikt.

## De tests

| Bestand | Bewijst |
|---|---|
| `test_bron.py` | `procescheck.json` is woordelijk gelijk aan de code op de tag |
| `test_reken.py` | de rekenregels, met de doorloop-fixture als volledige uitkomst |
| `test_bouw.py` | de pagina is zelfstandig, offline en zonder tweede kopie van de bron |
| `test_app.py` | een echte browser rekent hetzelfde als `reken.py`, van invullen tot afdrukken |

`test_bron.py` slaat over als de tag ontbreekt, `test_app.py` als Playwright of Chromium ontbreekt. CI
installeert beide, dus daar slaat niets over.
