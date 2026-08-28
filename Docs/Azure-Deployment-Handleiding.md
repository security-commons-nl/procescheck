# Azure Deployment via Portal — Stap-voor-stap handleiding

**Startpunt:** Ga naar **portal.azure.com** en log in met je Microsoft-account.

---

## Stap 1 — Azure resources aanmaken

### 1.1 Resource Group

1. Zoek bovenaan op **"Resource groups"**
2. Klik **+ Create**
3. Vul in:
   - **Subscription:** kies jouw subscription
   - **Resource group:** `rg-procescheck-prod`
   - **Region:** `West Europe`
4. Klik **Review + create** → **Create**

---

### 1.2 Azure Container Registry (ACR)

1. Zoek op **"Container registries"**
2. Klik **+ Create**
3. Vul in:
   - **Resource group:** `rg-procescheck-prod`
   - **Registry name:** `acrprocescheckprod` *(wereldwijd uniek, alleen letters/cijfers)*
   - **Location:** `West Europe`
   - **SKU:** `Basic`
4. Klik **Review + create** → **Create**
5. Ga na aanmaken naar de registry → **Settings → Access keys**
6. Zet **Admin user** op **Enabled**
7. **Noteer:** Login server, Username, en één van de passwords → nodig bij stap 3

---

### 1.3 PostgreSQL Flexible Server

1. Zoek op **"Azure Database for PostgreSQL flexible servers"**
2. Klik **+ Create** → kies **Flexible server**
3. **Basics tab:**
   - **Resource group:** `rg-procescheck-prod`
   - **Server name:** `[servernaam]`
   - **Region:** `West Europe`
   - **PostgreSQL version:** `15`
   - **Workload type:** `Development`
   - **Admin username:** `procescheck`
   - **Password:** *kies een sterk wachtwoord, noteer dit*
4. **Networking tab:**
   - **Connectivity method:** Public access
   - Vink aan: **Allow public access from any Azure service**
5. Klik **Review + create** → **Create** *(duurt ~5 minuten)*
6. Ga na aanmaken naar de server → **Databases** → **+ Add**
   - **Database name:** `procescheck` → **Save**

---

### 1.4 Key Vault

1. Zoek op **"Key vaults"**
2. Klik **+ Create**
3. Vul in:
   - **Resource group:** `rg-procescheck-prod`
   - **Key vault name:** `kv-procescheck-prod` *(wereldwijd uniek)*
   - **Region:** `West Europe`
   - **Pricing tier:** `Standard`
4. Klik **Review + create** → **Create**
5. Ga naar de Key Vault → **Objects → Secrets** → voeg de volgende secrets toe via **+ Generate/Import**:

| Secret Name | Value |
|-------------|-------|
| `DATABASE-URL` | `postgresql://procescheck:<wachtwoord>@[servernaam].postgres.database.azure.com:5432/procescheck?sslmode=require` |
| `CORS-ORIGINS` | Laat voorlopig leeg — vul je in na stap 1.6 |
| `AZURE-TENANT-ID` | Laat voorlopig leeg — vul je in na stap 2 |
| `AZURE-CLIENT-ID` | Laat voorlopig leeg — vul je in na stap 2 |

---

### 1.5 Container Apps

**Container Apps Environment aanmaken:**

1. Zoek op **"Container Apps Environments"**
2. Klik **+ Create**
3. Vul in:
   - **Resource group:** `rg-procescheck-prod`
   - **Name:** `cae-procescheck`
   - **Region:** `West Europe`
4. Klik **Review + create** → **Create**

**Container App aanmaken:**

1. Zoek op **"Container Apps"**
2. Klik **+ Create**
3. **Basics tab:**
   - **Resource group:** `rg-procescheck-prod`
   - **Container app name:** `ca-procescheck-backend`
   - **Container Apps Environment:** `cae-procescheck`
4. **Container tab:**
   - Haal vinkje weg bij **Use quickstart image**
   - **Image source:** Docker Hub or other registries
   - **Image and tag:** `mcr.microsoft.com/azuredocs/containerapps-helloworld:latest`
   *(placeholder — wordt straks vervangen door GitHub Actions)*
5. **Ingress tab:**
   - **Ingress:** Enabled
   - **Ingress traffic:** Accepting traffic from anywhere
   - **Target port:** `8000`
6. Klik **Review + create** → **Create**
7. Ga na aanmaken naar de Container App → **Overview**
8. **Noteer de Application URL** (iets als `ca-procescheck-backend.westeurope.azurecontainerapps.io`)

**Managed Identity inschakelen:**

1. Ga naar de Container App → **Settings → Identity**
2. Zet **System assigned** op **On** → **Save**
3. **Noteer de Object (principal) ID** die verschijnt

**Key Vault toegang geven aan de Container App:**

1. Ga naar **kv-procescheck-prod** → **Access policies** → **+ Create**
2. **Permissions tab:** vink aan **Get** en **List** onder *Secret permissions*
3. **Principal tab:** zoek op de **Object ID** van de Container App
4. Klik door naar **Review + create** → **Create**

---

### 1.6 Static Web Apps

1. Zoek op **"Static Web Apps"**
2. Klik **+ Create**
3. Vul in:
   - **Resource group:** `rg-procescheck-prod`
   - **Name:** `swa-procescheck`
   - **Plan type:** `Free`
   - **Region:** `West Europe 2`
   - **Source:** `GitHub`
4. Klik op **Sign in with GitHub** en autoriseer Azure
5. Kies:
   - **Organization:** `[github-organisatie]`
   - **Repository:** `ProcesCheck`
   - **Branch:** `main`
6. **Build Details:**
   - **Build Presets:** `React`
   - **App location:** `frontend`
   - **Output location:** `dist`
7. Klik **Review + create** → **Create**
8. Ga na aanmaken naar de Static Web App → **Overview**
9. **Noteer de URL** (iets als `swa-procescheck.azurestaticapps.net`)

**CORS-ORIGINS secret bijwerken:**

1. Ga naar **kv-procescheck-prod** → **Secrets** → klik op `CORS-ORIGINS`
2. Klik **+ New Version**
3. Vul de SWA-URL in als waarde: `https://swa-procescheck.azurestaticapps.net`
4. Klik **Create**

---

## Stap 2 — App Registration aanmaken (Entra ID)

1. Zoek op **"Microsoft Entra ID"**
2. Ga naar **App registrations** → **+ New registration**
3. Vul in:
   - **Name:** `ProcesCheck`
   - **Supported account types:** *Accounts in this organizational directory only*
   - **Redirect URI:** kies `Single-page application (SPA)` → vul in: `https://swa-procescheck.azurestaticapps.net`
4. Klik **Register**
5. **Noteer van de Overview pagina:**
   - **Application (client) ID**
   - **Directory (tenant) ID**

**API scope aanmaken:**

1. Ga naar **Expose an API** → **+ Add a scope**
2. Klik **Save and continue** bij de Application ID URI
3. Vul in:
   - **Scope name:** `user_impersonation`
   - **Who can consent:** Admins and users
   - **Admin consent display name:** `Toegang tot ProcesCheck`
   - **State:** Enabled
4. Klik **Add scope**

**Key Vault secrets bijwerken:**

1. Ga naar **kv-procescheck-prod** → **Secrets**
2. Klik op `AZURE-TENANT-ID` → **+ New Version** → vul Tenant ID in → **Create**
3. Klik op `AZURE-CLIENT-ID` → **+ New Version** → vul Client ID in → **Create**

**Container App env-variabelen instellen:**

1. Ga naar **ca-procescheck-backend** → **Secrets** → **+ Add** voor elk secret:

| Name | Type | Waarde |
|------|------|--------|
| `database-url` | Key Vault reference | selecteer `DATABASE-URL` uit `kv-procescheck-prod` |
| `cors-origins` | Key Vault reference | selecteer `CORS-ORIGINS` uit `kv-procescheck-prod` |
| `azure-tenant-id` | Key Vault reference | selecteer `AZURE-TENANT-ID` uit `kv-procescheck-prod` |
| `azure-client-id` | Key Vault reference | selecteer `AZURE-CLIENT-ID` uit `kv-procescheck-prod` |

2. Ga daarna naar **Settings → Environment variables** → **+ Add** voor elk:

| Name | Source | Secret name |
|------|--------|-------------|
| `DATABASE_URL` | Reference a secret | `database-url` |
| `CORS_ORIGINS` | Reference a secret | `cors-origins` |
| `AZURE_TENANT_ID` | Reference a secret | `azure-tenant-id` |
| `AZURE_CLIENT_ID` | Reference a secret | `azure-client-id` |

3. Klik **Save**

---

## Stap 3 — GitHub Secrets instellen

**Service Principal aanmaken:**

1. Zoek op **"Microsoft Entra ID"** → **App registrations** → **+ New registration**
   - **Name:** `procescheck-github-actions`
   - Klik **Register**
2. Ga naar **Certificates & secrets** → **+ New client secret**
   - **Description:** `github-actions`
   - **Expires:** 24 months
   - Klik **Add** → **noteer de Value direct** *(verdwijnt na verlaten pagina)*
3. Ga naar **rg-procescheck-prod** → **Access control (IAM)** → **+ Add role assignment**
   - **Role:** `Contributor`
   - **Members:** zoek op `procescheck-github-actions`
   - Klik **Review + assign**
4. Stel de JSON samen voor `AZURE_CREDENTIALS`:

```json
{
  "clientId": "<Application ID van procescheck-github-actions>",
  "clientSecret": "<de secret Value uit stap 2>",
  "subscriptionId": "<jouw Subscription ID>",
  "tenantId": "<Tenant ID>"
}
```

> Je Subscription ID vind je via **Azure Portal → Subscriptions**.

**GitHub Secrets toevoegen:**

Ga naar **github.com/[organisatie]/procescheck → Settings → Secrets and variables → Actions**

Klik **New repository secret** voor elk van de volgende:

| Secret naam | Waarde |
|-------------|--------|
| `AZURE_CREDENTIALS` | De JSON van hierboven |
| `ACR_LOGIN_SERVER` | `acrprocescheckprod.azurecr.io` |
| `ACR_USERNAME` | Genoteerd in stap 1.2 |
| `ACR_PASSWORD` | Genoteerd in stap 1.2 |
| `AZURE_RESOURCE_GROUP` | `rg-procescheck-prod` |
| `CONTAINER_APP_NAME` | `ca-procescheck-backend` |

---

## Stap 4 — Static Web Apps build-variabelen

1. Ga naar **swa-procescheck** → **Settings → Configuration**
2. Klik **+ Add** voor elk van de volgende variabelen:

| Naam | Waarde |
|------|--------|
| `VITE_API_URL` | `https://<application-url-container-app>` |
| `VITE_AZURE_CLIENT_ID` | Client ID uit stap 2 |
| `VITE_AZURE_TENANT_ID` | Tenant ID uit stap 2 |

3. Klik **Save**

---

## Eerste deploy triggeren

Voer dit eenmalig uit in de terminal om beide pipelines te starten:

```bash
cd /Users/vasilis_theocharis/Documents/ProcesCheck
git commit --allow-empty -m "trigger: eerste Azure deploy"
git push origin main
```

Daarna kun je de voortgang volgen via:
- **GitHub → Actions** — voor de backend container deploy
- **Azure Portal → swa-procescheck → GitHub Actions runs** — voor de frontend

---

## Verificatie

Zodra alles klaar is (~10 minuten):

1. Open `https://<jouw-swa-url>` in de browser → je ziet een Microsoft login
2. Log in met je organisatie-account
3. Je ziet het ProcesCheck dashboard

---

## Notities (vul in tijdens uitvoering)

| Gegeven | Waarde |
|---------|--------|
| Subscription ID | |
| Tenant ID | |
| Client ID (ProcesCheck app) | |
| ACR Login Server | |
| ACR Username | |
| ACR Password | |
| Container App URL | |
| Static Web App URL | |
| PostgreSQL wachtwoord | |
