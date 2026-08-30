# procescheck

Webapplicatie voor Business Impact Analyses en BIV-classificaties.

Status: prototype. Werkt en is te draaien, zonder belofte over onderhoud.

Interne webapplicatie voor het uitvoeren en beheren van **Business Impact Analyses (BIA)** en **BIV-classificaties** (Beschikbaarheid, Integriteit, Vertrouwelijkheid) binnen een organisatie.

De applicatie brengt processen, applicaties en procescontext samen in één dashboard dat inzicht geeft in het beveiligingslandschap en de continuïteitsrisico's.

## Voor wie

ISO's en proceseigenaren bij publieke organisaties.

## Snel starten

### Vereisten

- [Docker Desktop](https://www.docker.com/products/docker-desktop/)
- [Docker Compose](https://docs.docker.com/compose/)

### Stappen

1. **Clone de repository**
   ```bash
   git clone https://github.com/security-commons-nl/procescheck.git
   cd ProcesCheck
   ```

2. **Maak een `.env` bestand aan voor de backend**
   ```bash
   cp backend/.env.example backend/.env
   ```
   Pas de waarden aan indien nodig (zie [Environment variables](#environment-variables)).

3. **Start alle services**
   ```bash
   docker compose up --build
   ```

4. **Open de applicatie**
   - Frontend: [http://localhost:3300](http://localhost:3300)
   - Backend API docs: [http://localhost:8000/docs](http://localhost:8000/docs)

### Database migraties

Alembic wordt automatisch uitgevoerd bij het starten van de backend container. Handmatig uitvoeren:

```bash
docker exec procescheck_backend alembic upgrade head
```

## Bijdragen

Zie de [CONTRIBUTING](https://github.com/security-commons-nl/.github/blob/main/CONTRIBUTING.md) van de organisatie: daar staat per project een formulier, ook zonder Git-ervaring.

Zie [CONTRIBUTING.md](CONTRIBUTING.md) voor de werkwijze en commit-conventies.

## Licentie

EUPL-1.2, zie [LICENSE](LICENSE).

## Functionaliteit
- **Processen** - registreer en beheer organisatieprocessen met classificatie en eigenaarschap
- **Applicaties** - koppel applicaties aan processen en volg reviewstatus
- **BIA & BIV-Classificatie** - voer gestructureerde beoordelingen uit op beschikbaarheid, integriteit en vertrouwelijkheid
- **Procescontext** - leg de bredere context van een proces vast (afhankelijkheden, risico's)
- **Dashboard** - security posture overzicht met KPI's, risico-landschap en reviewmonitoring
- **Export** - exporteer rapportages naar Word, Excel en PowerPoint
- **Ketenarchitectuur** - visualiseer koppelingen tussen processen en applicaties

## Architectuur
```
┌─────────────────┐     ┌──────────────────┐     ┌──────────────┐
│   Frontend      │────▶│   Backend API    │────▶│  PostgreSQL  │
│   React + Vite  │     │   FastAPI        │     │  Database    │
│   Tailwind CSS  │     │   SQLAlchemy     │     │              │
│   Port 3300     │     │   Port 8000      │     │  Port 5435   │
└─────────────────┘     └──────────────────┘     └──────────────┘
                                │
                         Azure AD (OIDC)
                         Authenticatie
```

| Laag | Technologie |
|---|---|
| Frontend | React 18, TypeScript, Vite, Tailwind CSS |
| Backend | Python 3.12, FastAPI, SQLAlchemy, Alembic |
| Database | PostgreSQL 15 |
| Authenticatie | Azure Active Directory (OIDC/JWT) |
| Deployment | Azure Container Apps (backend) + Azure Static Web Apps (frontend) |

## Environment variables
### Backend (`backend/.env`)

| Variabele | Vereist | Beschrijving |
|---|---|---|
| `DATABASE_URL` | Ja | PostgreSQL connection string |
| `CORS_ORIGINS` | Nee | Komma-gescheiden lijst van toegestane origins (default: `http://localhost:3300`) |
| `AZURE_TENANT_ID` | Nee | Azure AD tenant ID - leeg = authenticatie uitgeschakeld (dev-mode) |
| `AZURE_CLIENT_ID` | Nee | Azure AD client ID - leeg = authenticatie uitgeschakeld (dev-mode) |

Voorbeeld:
```env
DATABASE_URL=postgresql://procescheck:procescheck_dev@localhost:5435/procescheck
CORS_ORIGINS=http://localhost:3300
AZURE_TENANT_ID=
AZURE_CLIENT_ID=
```

### Frontend (`frontend/.env.local`)

| Variabele | Vereist | Beschrijving |
|---|---|---|
| `VITE_API_URL` | Ja | URL van de backend API |
| `VITE_AZURE_CLIENT_ID` | Nee | Azure AD client ID voor frontend authenticatie |
| `VITE_AZURE_TENANT_ID` | Nee | Azure AD tenant ID voor frontend authenticatie |

## Projectstructuur
```
ProcesCheck/
├── backend/               # FastAPI applicatie
│   ├── app/
│   │   ├── models/        # SQLAlchemy database modellen
│   │   ├── routers/       # API endpoints
│   │   ├── schemas/       # Pydantic request/response schemas
│   │   ├── auth.py        # Azure AD authenticatie
│   │   ├── config.py      # Applicatieconfiguratie
│   │   └── main.py        # FastAPI app entry point
│   ├── alembic/           # Database migraties
│   ├── Dockerfile
│   └── requirements.txt
├── frontend/              # React applicatie
│   ├── src/
│   │   ├── components/    # Herbruikbare UI-componenten
│   │   ├── pages/         # Pagina-componenten per module
│   │   └── api/           # API client functies
│   ├── Dockerfile
│   └── package.json
├── Docs/                  # Projectdocumentatie
├── docker-compose.yml     # Lokale development omgeving
└── .github/workflows/     # CI/CD pipelines
```

## Deployment
De applicatie wordt gehost op Azure:

- **Backend** - Azure Container Apps via Azure Container Registry
- **Frontend** - Azure Static Web Apps
- **Database** - Azure Database for PostgreSQL

Zie `Docs/Azure-Deployment-Handleiding.md` voor de volledige deployment instructies.
