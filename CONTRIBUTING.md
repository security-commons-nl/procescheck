# Bijdragen aan ProcesCheck

## Werkwijze

1. Maak een feature branch aan vanuit `main`:
   ```bash
   git checkout -b feat/naam-van-feature
   ```
2. Maak commits volgens de conventie hieronder.
3. Push de branch en open een Pull Request naar `main`.
4. Laat de PR reviewen voor merge.

Directe pushes naar `main` zijn niet toegestaan.

---

## Commit-conventies

Gebruik [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <omschrijving>
```

### Types

| Type | Wanneer |
|---|---|
| `feat` | Nieuwe functionaliteit |
| `fix` | Bugfix |
| `chore` | Onderhoud, dependencies, configuratie |
| `docs` | Documentatie |
| `refactor` | Code herschrijven zonder gedragsverandering |
| `style` | Opmaak, witruimte (geen logica) |
| `test` | Tests toevoegen of aanpassen |
| `ci` | CI/CD pipeline wijzigingen |

### Scope (optioneel)

Gebruik de module als scope: `dashboard`, `bia`, `processes`, `export`, `auth`, `backend`, `frontend`

### Voorbeelden

```
feat(dashboard): voeg reviewmonitoring sectie toe
fix(auth): JWKS cache verversen na 24 uur
chore: verwijder __pycache__ uit git tracking
docs: README uitbreiden met installatie-instructies
refactor(bia): extraheer vragenlijst naar apart bestand
```

### Regels

- Omschrijving in het **Nederlands**, lowercase, zonder punt aan het einde
- Maximaal 72 tekens voor de eerste regel
- Gebruik de body (tweede alinea) voor context als de wijziging niet voor zichzelf spreekt

---

## Branch naamgeving

| Prefix | Wanneer |
|---|---|
| `feat/` | Nieuwe functionaliteit |
| `fix/` | Bugfix |
| `chore/` | Onderhoud |
| `docs/` | Documentatie |

Voorbeeld: `feat/export-powerpoint`, `fix/dashboard-percentages`
