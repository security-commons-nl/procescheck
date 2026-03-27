# Specificatie – Applicatie voor Kritieke Processen, ondersteunende IT-middelen ((informatie)systemen), en bedrijfseisen (BIA/BIV (beschikbaarheid, integriteit, vertrouwelijkheid), RTO, RPO)

Naam applicatie: ProcesCheck

## 1. Doel van de applicatie

Deze applicatie moet de organisatie ondersteunen bij het centraal vastleggen, beheren en analyseren van:

1. één uniforme lijst met kritieke processen;
2. de directe taakspecifieke IT-middelen ((informatie)systemen / applicaties) die noodzakelijk zijn voor de uitvoering van die processen;
3. de bedrijfseisen (Business Impact Assessment (BIA)) per proces, dus de BIV-classificatie per proces (Beschikbaarheid, Integriteit, Vertrouwelijkheid);
4. de RTO en RPO per proces;
5. aanvullende businesscontext per proces via een business model canvas.

De applicatie moet fungeren als een centrale bron van waarheid voor de relatie tussen bedrijfsprocessen, ondersteunende IT-middelen, en bedrijfseisen.

---

## 2. Achtergrond en probleemstelling

Binnen organisaties is informatie over kritieke processen, ondersteunende applicaties en continuïteitseisen vaak versnipperd over Excelbestanden, Word-documenten, losse notities en verschillende teams. Daardoor ontstaan de volgende problemen:

* er is geen eenduidige en bestuurlijk vastgestelde lijst met kritieke processen;
* het is onvoldoende inzichtelijk welke applicaties direct nodig zijn voor de uitvoering van een proces;
* BIA’s en BIV-classificaties zijn niet uniform vastgelegd;
* RTO en RPO zijn vaak niet expliciet gekoppeld aan processen;
* businesscontext ontbreekt of is onvoldoende gestructureerd;
* het is lastig om managementinformatie, audits, BCM, security en IT-herstel op elkaar aan te laten sluiten.

Deze applicatie moet dit oplossen door één logisch en samenhangend model te bieden.

---

## 3. Hoofddoelstellingen

De applicatie moet minimaal de volgende doelstellingen ondersteunen:

### 3.1 Centrale registratie

Eén centrale en beheerde registratie van alle kritieke processen.

### 3.2 Proces-applicatie afhankelijkheden

Per kritisch proces inzichtelijk maken welke directe taakspecifieke applicaties nodig zijn voor de uitvoering van het proces.

### 3.3 Impact en classificatie

Per proces de BIA, BIV, RTO en RPO uniform vastleggen.

### 3.4 Businesscontext

Per proces aanvullende context vastleggen zodat niet alleen IT-afhankelijkheden, maar ook businessdoel, stakeholders en ketenafhankelijkheden duidelijk zijn. Dit moet middels een visuele business model canvas.

---

## 4. Scope van versie 1

### In scope

* registreren en beheren van kritieke processen;
* registreren en beheren van applicaties;
* koppelen van processen aan applicaties;
* vastleggen van BIA-gegevens (BIV-classificatie) per proces;
* vastleggen van RTO en RPO per proces;
* vastleggen van business model canvas / businesscontext per proces;
* exportfunctionaliteit.

### Buiten scope

* volledige CMDB-vervanging;
* diepgaande technische infrastructuurmodellering;
* volledige workflow engine voor incidentmanagement;
* automatische live-koppelingen met alle bronapplicaties;
* volledige risicomanagementmodule buiten de procescontext.

---

## 5. Functionele behoefte – processen

Per proces moet minimaal het volgende vastgelegd kunnen worden:

* procesnaam;
* unieke procescode;
* beschrijving van het proces;
* doel van het proces;
* proceseigenaar;
* afdeling / domein / cluster;
* of het proces als kritiek is vastgesteld;
* reden / motivatie waarom het proces kritiek is;
* datum laatste beoordeling;
* opmerkingen.

---

## 6. Functionele behoefte – applicaties

Per applicatie moet minimaal het volgende vastgelegd kunnen worden:

* applicatienaam;
* unieke applicatiecode;
* beschrijving;
* Business eigenaar;
* technische eigenaar;
* opmerkingen.

### Gewenst gedrag

* één applicatie moet aan meerdere processen gekoppeld kunnen worden;
* één proces moet meerdere applicaties kunnen hebben;
* de relatie is dus many-to-many.

---

## 7. Functionele behoefte – BIA en BIV

Per proces moet een BIA kunnen worden ingevuld met daarin minimaal:

### BIV-classificatie

* Beschikbaarheid
* Integriteit
* Vertrouwelijkheid

### BIA-inhoud
Om de BIA te kunnen uitvoeren, moet informatie beschikbaar zijn welke wordt opgehaald middels vragen, zie het document voorbeeld BIA kritieke processen BIO2.0.

---

## 8. Functionele behoefte – RTO en RPO

Per proces moeten expliciet kunnen worden vastgelegd:

### RTO

Recovery Time Objective: de maximale tijd waarbinnen het proces na uitval hersteld moet zijn.

### RPO

Recovery Point Objective: de maximale hoeveelheid gegevensverlies die acceptabel is.

Per proces moet kunnen worden vastgelegd:

* RTO-waarde;
* RPO-waarde;
* eenheid (minuten, uren, dagen);
* toelichting / onderbouwing;

### Belangrijke functionele nuance

---

## 9. Functionele behoefte – business model canvas / businesscontext

Per proces moet een businesscontext kunnen worden vastgelegd. Dit hoeft geen zwaar of volledig commercieel business model canvas te zijn, maar wel een praktische businesscontextsectie.

Minimaal opnemen:
Zie document voorbeeld business model canvas BIO2.O.

---

## 10. Niet-functionele eisen

### 10.1 Gebruiksvriendelijkheid

* intuïtieve interface;
* logische schermopbouw;
* zo min mogelijk vrije tekst waar standaardisatie beter is;
* maar voldoende ruimte voor toelichting.

### 10.2 Beheerbaarheid

* makkelijk uitbreidbaar datamodel;
* configurabele keuzelijsten;
* onderhoudbare codebasis.

### 10.3 Veiligheid

* rolgebaseerde autorisatie;
* logging van wijzigingen;
* bescherming van gevoelige informatie;
* veilige authenticatie.

### 10.4 Auditability

* audit trail op record- en veldniveau waar haalbaar;
* inzicht in wie wat heeft gewijzigd en wanneer.

### 10.5 Toekomstvastheid

* voorbereid op uitbreiding met controls, risico’s, BCM, leveranciers, SLA’s en integraties.

---

## 11. Gewenste schermen

Minimaal de volgende schermen:

1. **Dashboard**
2. **Kritieke processen**
3. **Kritieke (informatie)systemen**
