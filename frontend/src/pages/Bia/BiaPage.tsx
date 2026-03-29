import bcpTimelineImg from '../../assets/bcp-timeline.png'
import { useState, useRef, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { Info, ChevronDown } from 'lucide-react'
import { processesApi } from '../../api/processes'
import { biaApi } from '../../api/bia'
import PageHeader from '../../components/common/PageHeader'
import { Card } from '../../components/common/Card'
import { FormField, Input, Textarea } from '../../components/common/FormField'
import { ScoreBadge } from '../../components/common/Badge'
import type { BiaAssessment } from '../../types'

// ── Types ─────────────────────────────────────────────────────────────────────

type AnswerOption = {
  label: string
  info: string
}

type BiaQuestion = {
  key: string
  label: string
  tooltip?: string  // gray toelichting text from Excel; shown via i-icon
  answers: AnswerOption[]
}

// ── Answer labels (5 fixed) ───────────────────────────────────────────────────

const ANSWER_LABELS = ['Catastrofaal', 'Kritiek / zeer ernstig', 'Gemiddeld', 'Gering', 'Verwaarloosbaar']

// ── Beschikbaarheid questions (from Excel, rows 3–10) ─────────────────────────

const B_QUESTIONS: BiaQuestion[] = [
  {
    key: 'b1',
    label: 'Hoe erg is het als informatie tijdelijk niet beschikbaar is, kan het proces dan nog doordraaien?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Uitval van enkele uren is niet acceptabel en kan leiden tot onherstelbare schade en bestuurlijke crisis. Continuïteit moet permanent worden gewaarborgd. Near real-time beschikbaarheid is noodzakelijk.' },
      { label: ANSWER_LABELS[1], info: 'Uitval van maximaal 8 uur kan cruciale processen stilleggen. De informatie is moeilijk te vervangen en herstel vergt veel tijd, middelen en geld. Gevolgen worden breed gevoeld binnen en buiten de organisatie.' },
      { label: ANSWER_LABELS[2], info: 'Uitval van maximaal 2 werkdagen heeft aanzienlijke invloed op kernactiviteiten en kan leiden tot klachten of verminderde dienstverlening. Herstel vergt aanzienlijke inspanning en extra kosten.' },
      { label: ANSWER_LABELS[3], info: 'Uitval van maximaal 1 week kan leiden tot hinder maar heeft geen aanzienlijke invloed op de dienstverlening. Herstel vraagt enige inspanning maar is goed uitvoerbaar.' },
      { label: ANSWER_LABELS[4], info: 'Tijdelijke onbeschikbaarheid is vrijwel zonder gevolgen. Uitval van meer dan een week kan zonder merkbare schade worden opgevangen. Kernactiviteiten blijven doorgaan en de informatie is eenvoudig te vervangen of te herstellen.' },
    ],
  },
  {
    key: 'b2',
    label: 'Managementbeslissingen: Welke tijdsduur, die het nemen van beslissingen door het ontbreken van informatie negatief beïnvloedt, is acceptabel?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Geen uitval acceptabel. Elke vertraging in informatievoorziening kan leiden tot onherstelbare fouten in besluitvorming en een bestuurlijke crisis.' },
      { label: ANSWER_LABELS[1], info: 'Tot maximaal 8 uur. Uitval legt besluitvorming grotendeels stil en kan de koers van de organisatie ernstig ontsporen.' },
      { label: ANSWER_LABELS[2], info: 'Tot twee werkdagen. Vertraging heeft aanzienlijke invloed op kernbeslissingen en kan leiden tot verkeerd beleid of gemiste kansen.' },
      { label: ANSWER_LABELS[3], info: 'Tot één week. Enige vertraging in besluitvorming is hinderlijk maar heeft geen aanzienlijke invloed op de organisatie.' },
      { label: ANSWER_LABELS[4], info: 'Meer dan een week. Beslissingen kunnen probleemloos worden uitgesteld, er is geen merkbare invloed op het bestuur of management.' },
    ],
  },
  {
    key: 'b3',
    label: 'Imagoverlies: Hoe lang duurt het voordat er sprake is van imagoverlies wanneer informatie niet voorhanden is?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Geen uitval acceptabel. Elke periode van niet-beschikbaarheid tast het vertrouwen van burgers en het bestuur onherstelbaar aan.' },
      { label: ANSWER_LABELS[1], info: 'Tot maximaal 8 uur. Forse en blijvende imagoschade, het vertrouwen van burgers, partners en medewerkers krijgt een serieuze knauw.' },
      { label: ANSWER_LABELS[2], info: 'Tot twee werkdagen. Merkbare imagoschade; burgers en ketenpartners verliezen zichtbaar vertrouwen in de dienstverlening.' },
      { label: ANSWER_LABELS[3], info: 'Tot één week. Beperkte imagoschade; enige hinder voor burgers of partners, maar het vertrouwen blijft grotendeels intact.' },
      { label: ANSWER_LABELS[4], info: 'Meer dan een week. Geen voelbare imagoschade, burgers en partners merken de uitval nauwelijks.' },
    ],
  },
  {
    key: 'b4',
    label: 'Wettelijke aansprakelijkheid: Hoe lang kan de informatie niet beschikbaar zijn voordat er wettelijke of contractuele verplichtingen niet kunnen worden nagekomen?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Geen uitval acceptabel. Directe en zware juridische aansprakelijkheid bij elke periode van niet-beschikbaarheid; extreme herstelkosten en mogelijke bestuurlijke crisis.' },
      { label: ANSWER_LABELS[1], info: 'Tot maximaal 8 uur. Juridische claims zijn waarschijnlijk en bijkomende kosten lopen hoog op, naleving van wettelijke verplichtingen komt ernstig in gevaar.' },
      { label: ANSWER_LABELS[2], info: 'Tot twee werkdagen. Reële juridische risico\'s ontstaan en de kosten voor herstel en naleving worden aanzienlijk.' },
      { label: ANSWER_LABELS[3], info: 'Tot één week. Beperkte juridische of contractuele gevolgen; minimale financiële of juridische impact die eenvoudig op te vangen is.' },
      { label: ANSWER_LABELS[4], info: 'Meer dan een week. Er zijn geen directe wettelijke of contractuele verplichtingen die in gevaar komen bij langdurige uitval.' },
    ],
  },
  {
    key: 'b5',
    label: 'Hoe lang kan dit proces maximaal uitvallen voordat de schade onaanvaardbaar wordt? (MTPD/MTD)',
    tooltip: 'MTPD/MTD: Hoe lang mag het proces uitvallen?\n\nDoel: de absolute bovengrens bepalen waarbinnen herstel moet plaatsvinden.\n\nInterviewvragen:\n• "Stel: dit proces valt morgenochtend volledig uit. Wanneer begint dat écht een probleem te worden — niet alleen vervelend, maar met concrete gevolgen voor klanten, burgers of de organisatie?"\n• "Op welk moment zou jij naar je leidinggevende gaan en zeggen: dit is een crisis die geëscaleerd moet worden?"\n• "Zijn er wettelijke termijnen, contractuele afspraken of SLA\'s die bepalen wanneer het te laat is?"\n• "Wat zijn de concrete gevolgen als die grens wordt overschreden — financieel, juridisch, voor klanten, of voor de reputatie?"',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Uitval van enkele uren is niet acceptabel en kan leiden tot onherstelbare schade en bestuurlijke crisis.' },
      { label: ANSWER_LABELS[1], info: 'Uitval van maximaal 8 uur kan cruciale processen stilleggen en leidt tot brede maatschappelijke en bestuurlijke gevolgen.' },
      { label: ANSWER_LABELS[2], info: 'Uitval van maximaal 2 werkdagen heeft aanzienlijke invloed op de dienstverlening en kan leiden tot klachten.' },
      { label: ANSWER_LABELS[3], info: 'Uitval van maximaal 1 week leidt tot hinder maar heeft geen aanzienlijke invloed op de dienstverlening.' },
      { label: ANSWER_LABELS[4], info: 'Uitval van meer dan een week kan zonder merkbare schade worden opgevangen. Geen voelbare impact voor burgers of bestuur.' },
    ],
  },
  {
    key: 'b6',
    label: 'Binnen hoeveel tijd na een verstoring moet dit proces minimaal draaien om onaanvaardbare schade te voorkomen? (RTO)',
    tooltip: 'RTO: Wanneer moet het minimaal werken?\n\nDoel: bepalen binnen hoeveel tijd het proces minimaal operationeel moet zijn, en wat dat minimale niveau inhoudt.\n\nInterviewvragen:\n• "Als het proces uitvalt — hoe lang kun je dat opvangen zonder dat de schade onaanvaardbaar wordt? Wat doe je in de tussentijd?"\n• "Zijn er handmatige alternatieven mogelijk? Zo ja: hoe lang houd je dat vol, en wat kun je dan wél en niet?"\n• "Op welk moment moet het proces minimaal weer operationeel zijn, ook al is het nog niet volledig op normaal niveau?"\n• "Wat versta jij onder \'minimaal operationeel\'? Welke stappen moeten dan in elk geval werken, en wat kan nog even wachten?"\n• "Hoe snel moet er worden hersteld? Binnen welke tijdsperiode moet de dienstverlening weer hersteld zijn?"',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Binnen enkele uren: Near real-time herstel vereist. Elke vertraging leidt tot onherstelbare schade.' },
      { label: ANSWER_LABELS[1], info: 'Binnen 8 uur: Herstel binnen 8 uur is noodzakelijk om stillegging proces te voorkomen.' },
      { label: ANSWER_LABELS[2], info: 'Binnen 2 werkdagen: Herstel binnen 2 werkdagen voorkomt aanzienlijke verstoring van kernactiviteiten.' },
      { label: ANSWER_LABELS[3], info: 'Binnen 1 week: Herstel binnen een week voorkomt aanzienlijke hinder aan de dienstverlening.' },
      { label: ANSWER_LABELS[4], info: 'Meer dan 1 week: Herstel binnen een week is voldoende. Geen merkbare impact bij langere uitval.' },
    ],
  },
  {
    key: 'b7',
    label: 'Nadat de systemen weer werken: hoelang duurt het voordat het proces volledig op normaal niveau draait? (WRT)',
    tooltip: 'WRT: Hoelang duurt volledig herstel?\n\nDoel: bepalen hoeveel tijd nodig is om na technisch herstel ook operationeel volledig te herstellen.\n\nInterviewvragen:\n• "Stel het systeem is weer beschikbaar. Wat moet er daarna nog allemaal gebeuren voordat je zegt: we draaien weer volledig normaal?"\n• "Denk aan achterstallige verwerkingen, handmatige registraties die ingevoerd moeten worden, controles — wat hoort daarbij?"\n• "Hoeveel mensen heb je nodig om die achterstand weg te werken, en zijn die dan beschikbaar?"\n• "Hoelang duurt dat herstelwerk realistisch gezien — niet in het beste geval, maar in een normale situatie?"',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Meerdere werkdagen: Zeer omvangrijk herstelwerk. Volledig operationeel worden vergt meerdere dagen intensieve inspanning.' },
      { label: ANSWER_LABELS[1], info: '1 werkdag: Omvangrijk herstelwerk. Significante capaciteit en tijd nodig om volledig te herstellen.' },
      { label: ANSWER_LABELS[2], info: 'Dagdeel (4–8 uur): Merkbaar herstelwerk vereist. Achterstand vraagt gerichte inzet van medewerkers.' },
      { label: ANSWER_LABELS[3], info: '1–4 uur: Beperkt herstelwerk. Achterstand is snel weggewerkt met beschikbare capaciteit.' },
      { label: ANSWER_LABELS[4], info: 'Minder dan 1 uur: Nauwelijks herstelwerk nodig. Proces draait direct na systeemherstel weer volledig.' },
    ],
  },
  {
    key: 'b8',
    label: 'Hoeveel dataverlies kan dit proces maximaal tolereren zonder onaanvaardbare gevolgen? (RPO)',
    tooltip: 'RPO: Hoeveel dataverlies is acceptabel?\n\nDoel: bepalen over welk tijdvak gegevensverlies acceptabel is zonder onaanvaardbare gevolgen.\n\nInterviewvragen:\n• "Hoe snel veranderen de gegevens in dit proces — zijn het doorlopende transacties of verwerk je data in batches?"\n• "Stel we herstellen het systeem, maar de gegevens van de afgelopen paar uur zijn weg. Wat betekent dat concreet?"\n• "Kunnen verloren gegevens worden gereconstrueerd — bijvoorbeeld uit papieren documenten, e-mails of koppelingen met andere systemen? Hoe lang duurt dat?"\n• "Zijn er wettelijke of contractuele verplichtingen die bepalen hoe actueel de gegevens moeten zijn?"\n• "Hoeveel dataverlies (RPO) is acceptabel en binnen welke tijdsperiode moet dit hersteld kunnen worden?"',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Enkele uren of minder: Dataverlies van enkele uren kan leiden tot onherstelbare schade en bestuurlijke crisis. Near real-time back-up vereist.' },
      { label: ANSWER_LABELS[1], info: '4–8 uur: Dataverlies van 4 tot 8 uur kan proces stilleggen. Informatie is moeilijk te reconstrueren.' },
      { label: ANSWER_LABELS[2], info: '8–24 uur: Dataverlies van 8 tot 24 uur heeft aanzienlijke invloed op de dienstverlening en kernactiviteiten.' },
      { label: ANSWER_LABELS[3], info: 'Maximaal 24 uur: Dataverlies van maximaal 24 uur leidt tot hinder maar heeft geen aanzienlijke invloed op de dienstverlening.' },
      { label: ANSWER_LABELS[4], info: '1 week of meer: Dataverlies van een week of langer kan zonder merkbare schade worden opgevangen. Informatie is eenvoudig te reconstrueren.' },
    ],
  },
]

// ── Integriteit questions (from Excel, rows 3–8) ──────────────────────────────

const I_QUESTIONS: BiaQuestion[] = [
  {
    key: 'i1',
    label: 'Hoe erg is het als informatie onjuist of onvolledig is, wat zijn de gevolgen als er fouten in zitten of als gegevens zijn gemanipuleerd?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Verkeerde of misleidende informatie veroorzaakt structurele fouten in management- en beleidsbeslissingen. Grootschalige fraude wordt mogelijk. Herstel is nauwelijks mogelijk en de schade is grotendeels onomkeerbaar.' },
      { label: ANSWER_LABELS[1], info: 'Beslissingen van management of bestuur worden sterk beïnvloed door verkeerde informatie. Fraude is aannemelijk en kan omvangrijk zijn. Kernprocessen komen grotendeels stil te liggen. Juridische claims zijn waarschijnlijk.' },
      { label: ANSWER_LABELS[2], info: 'Het risico op fraude is significant en kernprocessen kunnen aanzienlijke vertraging oplopen. Managementbeslissingen kunnen worden beïnvloed door onjuiste informatie. Herstel is mogelijk maar kostbaar en tijdsintensief.' },
      { label: ANSWER_LABELS[3], info: 'Fouten hebben beperkte gevolgen. Beslissingen kunnen incidenteel worden beïnvloed maar niet op een manier die de organisatie langdurig schaadt. Fraude is beperkt in omvang. Herstel is relatief eenvoudig en snel uitvoerbaar.' },
      { label: ANSWER_LABELS[4], info: 'Fouten of manipulaties hebben geen merkbare gevolgen. Beslissingen blijven correct, het risico op fraude is verwaarloosbaar en processen blijven ongestoord functioneren. Geen juridische of financiële consequenties.' },
    ],
  },
  {
    key: 'i2',
    label: 'Managementbeslissingen: Kan onjuiste informatie leiden tot onjuiste beslissingen? Wat zijn de gevolgen?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Onjuiste informatie veroorzaakt structurele en onomkeerbare fouten in besluitvorming op bestuurlijk niveau. Langdurige koerswijzigingen op basis van foutieve data zijn mogelijk. Het vertrouwen in de informatievoorziening van de organisatie gaat blijvend verloren.' },
      { label: ANSWER_LABELS[1], info: 'Beslissingen van management en bestuur worden sterk beïnvloed. De koers van de organisatie kan ernstig ontsporen. Correctie achteraf is zeer moeilijk en vergt langdurige inspanning.' },
      { label: ANSWER_LABELS[2], info: 'Managementbeslissingen kunnen merkbaar worden beïnvloed, wat kan leiden tot verkeerd beleid of onjuiste keuzes. Correctie is mogelijk maar tijdrovend en kostbaar.' },
      { label: ANSWER_LABELS[3], info: 'Beslissingen kunnen incidenteel worden beïnvloed, maar zonder langdurige of structurele schade voor de organisatie. Correctie is eenvoudig en snel uitvoerbaar.' },
      { label: ANSWER_LABELS[4], info: 'Onjuiste informatie heeft geen invloed op besluitvorming. De betrouwbaarheid van managementinformatie blijft intact en beslissingen blijven correct.' },
    ],
  },
  {
    key: 'i3',
    label: 'Fraude potentie: Zijn er frauderisico\'s met deze informatie, en welke gevolgen hebben deze?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Grootschalige fraude wordt mogelijk en is nauwelijks meer te beheersen. De financiële en maatschappelijke schade is onomkeerbaar. Het vertrouwen van burgers en partners gaat blijvend verloren en de organisatie wordt geconfronteerd met extreme herstelkosten en zware juridische aansprakelijkheid.' },
      { label: ANSWER_LABELS[1], info: 'Fraude is aannemelijk en kan omvangrijk zijn. De financiële schade loopt hoog op en juridische claims zijn waarschijnlijk. Het vertrouwen van burgers en ketenpartners krijgt forse en blijvende schade.' },
      { label: ANSWER_LABELS[2], info: 'Het risico op fraude is significant. Fraude is mogelijk en kan leiden tot aanzienlijke financiële schade en reputatieschade. Juridische risico\'s zijn reëel en herstelkosten zijn aanzienlijk.' },
      { label: ANSWER_LABELS[3], info: 'Het frauderisico is aanwezig maar beperkt in omvang en impact. Financiële en juridische gevolgen zijn minimaal en eenvoudig op te vangen.' },
      { label: ANSWER_LABELS[4], info: 'Het frauderisico is verwaarloosbaar. Onjuiste of gemanipuleerde informatie biedt geen zinvol aanknopingspunt voor fraude en de processen blijven ongestoord functioneren.' },
    ],
  },
  {
    key: 'i4',
    label: 'Onderbreking: In hoeverre kan het proces onderbroken worden als gevolg van ongeautoriseerde wijzigingen van, of fouten in informatie?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Proces wordt langdurig onderbroken of volledig lamgelegd. Herstel is nauwelijks mogelijk. De organisatie is niet meer in staat haar kerntaken uit te voeren en de continuïteit komt structureel in gevaar.' },
      { label: ANSWER_LABELS[1], info: 'Proces komt grotendeels stil te liggen. Herstel vergt zeer veel tijd, middelen en geld. De brede maatschappelijke gevolgen zijn voelbaar en de bestuurlijke druk neemt sterk toe.' },
      { label: ANSWER_LABELS[2], info: 'Proces loopt aanzienlijke vertraging op. De dienstverlening wordt merkbaar verstoord. Herstel is mogelijk maar kostbaar en tijdsintensief en vraagt extra capaciteit.' },
      { label: ANSWER_LABELS[3], info: 'Proces ondervindt kortdurende hinder. De dienstverlening blijft grotendeels doorgaan en het herstel is relatief eenvoudig en snel uitvoerbaar zonder grote extra inspanning.' },
      { label: ANSWER_LABELS[4], info: 'Process blijft ongestoord functioneren. Fouten of manipulaties in de informatie leiden niet tot enige merkbare onderbreking van activiteiten.' },
    ],
  },
  {
    key: 'i5',
    label: 'Vertrouwen van het publiek c.q. klanten: Kan het vertrouwen van het publiek geschaad worden door onjuiste informatie?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Het vertrouwen van burgers, partners en medewerkers gaat blijvend verloren. De reputatieschade is onomkeerbaar en de organisatie verliest haar maatschappelijke geloofwaardigheid. Herstel van het publieke vertrouwen is niet of nauwelijks meer mogelijk.' },
      { label: ANSWER_LABELS[1], info: 'Het vertrouwen van burgers en ketenpartners krijgt forse en blijvende schade. Publieke verontwaardiging is waarschijnlijk en kan leiden tot politieke en bestuurlijke druk. Herstel van vertrouwen vergt langdurige en zware inspanning.' },
      { label: ANSWER_LABELS[2], info: 'Burgers en ketenpartners verliezen merkbaar vertrouwen in de dienstverlening. Klachten nemen toe en de reputatie van de organisatie lijdt zichtbare schade. Herstel is mogelijk maar vergt gerichte inspanning.' },
      { label: ANSWER_LABELS[3], info: 'Het vertrouwen van burgers of ketenpartners wordt slechts licht geraakt. Er kan sprake zijn van incidentele klachten, maar het algemene beeld van de organisatie blijft positief. Herstel gaat snel.' },
      { label: ANSWER_LABELS[4], info: 'Het vertrouwen van burgers, ketenpartners en medewerkers blijft volledig intact. Onjuiste informatie heeft geen voelbare invloed op de publieke perceptie van de organisatie.' },
    ],
  },
  {
    key: 'i6',
    label: 'Wettelijke aansprakelijkheid: Wat kunnen de gevolgen zijn van het niet voldoen aan wettelijke of contractuele verplichtingen die veroorzaakt worden door onjuiste informatie?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Zware juridische aansprakelijkheid is onvermijdelijk. De organisatie wordt geconfronteerd met extreme boetes, claims en mogelijke strafrechtelijke gevolgen. Naleving van wet- en regelgeving is structureel en langdurig in gevaar. Herstel van de juridische positie is nauwelijks mogelijk.' },
      { label: ANSWER_LABELS[1], info: 'Juridische claims zijn waarschijnlijk en de bijkomende kosten lopen hoog op. Wettelijke termijnen en contractuele verplichtingen worden ernstig geschonden. De organisatie staat bloot aan toezichthoudende sancties en bestuurlijke aansprakelijkheid.' },
      { label: ANSWER_LABELS[2], info: 'Er zijn reële juridische risico\'s en de extra kosten om te herstellen zijn aanzienlijk. Wettelijke of contractuele verplichtingen kunnen niet volledig worden nagekomen, wat kan leiden tot formele klachten of handhavingsmaatregelen.' },
      { label: ANSWER_LABELS[3], info: 'Juridische of financiële gevolgen zijn minimaal en eenvoudig op te vangen. Er kan sprake zijn van een incidentele tekortkoming, maar zonder structurele of zware consequenties.' },
      { label: ANSWER_LABELS[4], info: 'Er zijn geen juridische consequenties of extra kosten te verwachten. Wettelijke en contractuele verplichtingen blijven volledig intact, ongeacht de fout of manipulatie.' },
    ],
  },
]

// ── Vertrouwelijkheid questions (from Excel, rows 3–7) ────────────────────────

const V_QUESTIONS: BiaQuestion[] = [
  {
    key: 'v1',
    label: 'Hoe gevoelig is deze informatie, wat zijn de gevolgen als onbevoegden toegang krijgen?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Geheim/zeer geheim: Hoogste vertrouwelijkheidsklasse. Openbaarmaking heeft catastrofale gevolgen voor de samenleving of nationale veiligheid. Beveiliging is zeer zwaar en strikt gereguleerd (ABDO/ABRO). Komt bij gemeenten zeer waarschijnlijk niet voor.' },
      { label: ANSWER_LABELS[1], info: 'Confidentieel: Zeer gevoelige informatie waarbij openbaarmaking ernstig schadelijk zou zijn. Ongeautoriseerde kennisname moet actief en strikt worden voorkomen. Aanvullende beveiligingsregels (ABDO/ABRO) zijn van toepassing naast BIO2.' },
      { label: ANSWER_LABELS[2], info: 'Vertrouwelijk: Gevoelige informatie waarbij de organisatie weerstand tegen spionage en misbruik moet organiseren. Ongeautoriseerde openbaarmaking is schadelijk en moet zoveel mogelijk worden voorkomen. Minimaal BIO2 van toepassing.' },
      { label: ANSWER_LABELS[3], info: 'Intern: Informatie die binnen de organisatie moet blijven. Onbevoegde kennisname is ongewenst maar gevolgen zijn beperkt en doorgaans herstelbaar. Kan lichte reputatieschade of interne verstoring veroorzaken.' },
      { label: ANSWER_LABELS[4], info: 'Openbaar: Informatie die zonder risico gedeeld kan worden met iedereen. Bedoeld voor openbaarheid, bijvoorbeeld op de gemeentelijke website. Ongeautoriseerde kennisname levert geen schade op. Let op: ook openbare informatie kan integer en beschikbaar moeten zijn.' },
    ],
  },
  {
    key: 'v2',
    label: 'Vertrouwen van de burger: Wat zijn de gevolgen voor de organisatie indien de binnen het proces beschikbare informatie te vroeg c.q. niet volgens de regels verspreid wordt?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Blijvend en onherstelbaar verlies van burgervertrouwen. De relatie tussen burger en overheid wordt fundamenteel aangetast. Maatschappelijke crisis en bestuurlijk ingrijpen zijn onvermijdelijk. Herstel is nauwelijks nog mogelijk.' },
      { label: ANSWER_LABELS[1], info: 'Ernstige en langdurige beschadiging van het burgervertrouwen. Burgers trekken massaal de integriteit van de organisatie in twijfel. Bestuurlijke druk neemt sterk toe en herstel vergt langdurige inspanning en transparantie.' },
      { label: ANSWER_LABELS[2], info: 'Merkbaar verlies van vertrouwen bij een deel van de burgers. De organisatie krijgt publieke kritiek en moet actief communiceren om de schade te beperken. Herstel is mogelijk maar kost tijd en middelen.' },
      { label: ANSWER_LABELS[3], info: 'Beperkt effect op het burgervertrouwen. Een kleine groep burgers merkt het op en er kan sprake zijn van lichte ontevredenheid, maar het vertrouwen in de organisatie als geheel blijft intact.' },
      { label: ANSWER_LABELS[4], info: 'Geen effect op het burgervertrouwen. De verspreiding van deze informatie heeft geen merkbare gevolgen voor de relatie tussen burger en organisatie.' },
    ],
  },
  {
    key: 'v3',
    label: 'Vertrouwen van het publiek: Wat zijn de gevolgen voor het publieke imago van de organisatie als vertrouwelijke informatie van de organisatie onterecht wordt verspreid?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Catastrofale en blijvende reputatieschade. De organisatie verliest haar geloofwaardigheid volledig. Nationale media-aandacht en politieke consequenties zijn onvermijdelijk. Het imago is vrijwel niet meer te herstellen.' },
      { label: ANSWER_LABELS[1], info: 'Zware en langdurige reputatieschade. Brede negatieve media-aandacht en publieke ophef. Het imago van de organisatie krijgt een forse deuk die jaren kan aanhouden. Herstel vereist een intensieve en langdurige communicatiestrategie.' },
      { label: ANSWER_LABELS[2], info: 'Duidelijke reputatieschade die breed zichtbaar is. Negatieve berichtgeving in lokale en regionale media. Het publieke imago wordt merkbaar aangetast, maar met gerichte communicatie en maatregelen is herstel haalbaar.' },
      { label: ANSWER_LABELS[3], info: 'Beperkte reputatieschade. Mogelijke negatieve berichtgeving op kleine schaal. Het imago wordt licht geraakt maar de organisatie wordt niet fundamenteel in twijfel getrokken.' },
      { label: ANSWER_LABELS[4], info: 'Geen reputatieschade. De verspreiding heeft geen invloed op het publieke beeld van de organisatie.' },
    ],
  },
  {
    key: 'v4',
    label: 'Vertrouwen van ketenpartners: Wat zijn de gevolgen voor de relatie met de ketenpartners, als vertrouwelijke informatie onterecht wordt verspreid?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Volledig en blijvend verlies van vertrouwen bij ketenpartners. Samenwerkingsverbanden worden onmiddellijk beëindigd. De organisatie wordt uitgesloten van toekomstige samenwerking en gedeelde informatiestromen. Schade is onomkeerbaar.' },
      { label: ANSWER_LABELS[1], info: 'Ernstige beschadiging van de relatie met ketenpartners. Partners trekken de betrouwbaarheid van de organisatie sterk in twijfel. Lopende samenwerkingen komen onder druk te staan of worden tijdelijk opgeschort. Herstel van vertrouwen vergt langdurige inspanning.' },
      { label: ANSWER_LABELS[2], info: 'Merkbare verslechtering van de relatie met één of meerdere ketenpartners. Er ontstaat onzekerheid over de betrouwbaarheid van de informatiedeling. Extra afspraken en maatregelen zijn nodig om de samenwerking voort te zetten.' },
      { label: ANSWER_LABELS[3], info: 'Lichte verstoring van de relatie met ketenpartners. Partners zijn op de hoogte maar de samenwerking blijft doorgaan. Er kunnen aanvullende vragen of zorgen worden geuit, maar de relatie herstelt zich snel.' },
      { label: ANSWER_LABELS[4], info: 'Geen effect op de relatie met ketenpartners. De verspreiding heeft geen invloed op het vertrouwen of de samenwerking.' },
    ],
  },
  {
    key: 'v5',
    label: '(Wettelijke) Aansprakelijkheid: Wat zijn de gevolgen voor (wettelijke) aansprakelijkheid bij het onterecht verspreiden van deze informatie?',
    answers: [
      { label: ANSWER_LABELS[0], info: 'Extreme juridische aansprakelijkheid. Strafrechtelijke vervolging en zware civiele claims zijn reëel. Toezichthouders leggen maximale sancties op. De financiële en juridische gevolgen zijn zo groot dat de continuïteit van de organisatie in gevaar komt.' },
      { label: ANSWER_LABELS[1], info: 'Grote juridische aansprakelijkheid. Hoge boetes van toezichthouders (bijvoorbeeld AP bij AVG-overtredingen) en omvangrijke civiele claims zijn waarschijnlijk. Langdurige juridische procedures zijn te verwachten en de kosten lopen sterk op.' },
      { label: ANSWER_LABELS[2], info: 'Reële juridische risico\'s. Er kunnen boetes of claims volgen vanuit toezichthouders of gedupeerde partijen. Juridische procedures zijn mogelijk en de herstelkosten zijn aanzienlijk, maar de organisatie kan dit dragen.' },
      { label: ANSWER_LABELS[3], info: 'Minimale juridische gevolgen. Eventuele aansprakelijkheid is beperkt van omvang en eenvoudig op te vangen. Formele waarschuwingen of lichte maatregelen zijn mogelijk, maar verdere juridische stappen zijn onwaarschijnlijk.' },
      { label: ANSWER_LABELS[4], info: 'Geen juridische gevolgen. De verspreiding van deze informatie levert geen aansprakelijkheid op. Er zijn geen wettelijke verplichtingen geschonden.' },
    ],
  },
]

// ── BCP helper ────────────────────────────────────────────────────────────────

// Returns the answer info text for the selected score on a given question
function bcpAnswerInfo(question: BiaQuestion, score: number | undefined): string | undefined {
  if (score == null || score < 1 || score > 5) return undefined
  return question.answers[score - 1]?.info
}

// ── Score label map ───────────────────────────────────────────────────────────

const SCORE_LABELS: Record<number, string> = {
  1: 'Catastrofaal',
  2: 'Kritiek / zeer ernstig',
  3: 'Gemiddeld',
  4: 'Gering',
  5: 'Verwaarloosbaar',
}

// ── BCP compact value mapping (source: Word doc, score 1–5 → compact label) ──

const BCP_COMPACT_MAP = {
  mtpd: { 1: 'enkele uren niet acceptabel', 2: 'maximaal 8 uur', 3: 'maximaal 2 werkdagen', 4: 'maximaal 1 week',   5: 'langer dan een week' },
  rto:  { 1: 'binnen enkele uren',          2: 'binnen 8 uur',   3: 'binnen 2 werkdagen',   4: 'binnen een week',   5: 'langer dan een week' },
  wrt:  { 1: 'meerdere werkdagen',           2: '1 werkdag',      3: '4–8 uur',              4: '1–4 uur',           5: 'minder dan 1 uur'    },
  rpo:  { 1: 'enkele uren',                  2: '4–8 uur',        3: '8–24 uur',             4: 'maximaal 24 uur',   5: 'een week of meer'    },
} as const

type TabKey = 'Algemeen' | 'Beschikbaarheid' | 'Integriteit' | 'Vertrouwelijkheid'

// Highest severity = lowest numeric value (1=Catastrofaal, 5=Verwaarloosbaar)
function highestSeverity(scores: (number | undefined)[]): number | undefined {
  const valid = scores.filter((s): s is number => s !== undefined && s !== null && s > 0)
  return valid.length ? Math.min(...valid) : undefined
}

// ── Info popover (reused from BusinessContext pattern) ───────────────────────

function InfoPopover({ text, onClose }: { text: string; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [onClose])

  return (
    <div
      ref={ref}
      className="absolute top-7 right-0 z-50 w-72 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
    >
      <p className="text-xs text-gray-600 leading-relaxed whitespace-pre-line">{text}</p>
    </div>
  )
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function BiaPage() {
  const { processId } = useParams<{ processId?: string }>()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [tab, setTab] = useState<TabKey>('Algemeen')
  const [selectedPid, setSelectedPid] = useState<number | undefined>(
    processId ? Number(processId) : undefined,
  )

  const { data: processes = [] } = useQuery({
    queryKey: ['processes'],
    queryFn: () => processesApi.list(),
  })

  const pid = selectedPid
  const { data: bia } = useQuery({
    queryKey: ['bia', pid],
    queryFn: () => biaApi.get(pid!),
    enabled: !!pid,
    retry: false,
  })

  const [form, setForm] = useState<Partial<BiaAssessment>>({})
  const currentForm: Partial<BiaAssessment> = bia ? { ...bia, ...form } : form
  const setField = (k: keyof BiaAssessment, v: unknown) => setForm(f => ({ ...f, [k]: v }))

  // Auto-calculate final scores: highest severity (= lowest numeric) across all answered questions
  const autoB = useMemo(
    () => highestSeverity([1,2,3,4,5,6,7,8].map(n => currentForm[`b${n}_score` as keyof BiaAssessment] as number | undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentForm.b1_score, currentForm.b2_score, currentForm.b3_score, currentForm.b4_score,
     currentForm.b5_score, currentForm.b6_score, currentForm.b7_score, currentForm.b8_score],
  )
  const autoI = useMemo(
    () => highestSeverity([1,2,3,4,5,6].map(n => currentForm[`i${n}_score` as keyof BiaAssessment] as number | undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentForm.i1_score, currentForm.i2_score, currentForm.i3_score,
     currentForm.i4_score, currentForm.i5_score, currentForm.i6_score],
  )
  const autoV = useMemo(
    () => highestSeverity([1,2,3,4,5].map(n => currentForm[`v${n}_score` as keyof BiaAssessment] as number | undefined)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [currentForm.v1_score, currentForm.v2_score, currentForm.v3_score,
     currentForm.v4_score, currentForm.v5_score],
  )

  // Effective form: auto-calculated scores override stored values
  const effectiveForm: Partial<BiaAssessment> = {
    ...currentForm,
    ...(autoB !== undefined && { availability_score: autoB }),
    ...(autoI !== undefined && { integrity_score: autoI }),
    ...(autoV !== undefined && { confidentiality_score: autoV }),
  }

  const mutation = useMutation({
    mutationFn: () => biaApi.upsert(pid!, effectiveForm),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['bia', pid] })
      qc.invalidateQueries({ queryKey: ['processes'] })
      setForm({})
    },
  })

  // Autosave: debounce 600ms after any form change
  useEffect(() => {
    if (!pid || Object.keys(form).length === 0) return
    const t = setTimeout(() => mutation.mutate(), 600)
    return () => clearTimeout(t)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form, pid])

  return (
    <div className="flex gap-6">
      {/* Process selector sidebar */}
      <aside className="w-56 shrink-0">
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">Processen</div>
          <ul className="divide-y divide-gray-50 max-h-[70vh] overflow-y-auto">
            {processes.map(p => (
              <li key={p.id}>
                <button
                  onClick={() => { setSelectedPid(p.id); setForm({}); navigate(`/bia/${p.id}`) }}
                  className={`w-full text-left px-4 py-3 text-sm transition-colors ${
                    pid === p.id ? 'bg-brand-50 text-brand-700 font-medium' : 'text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  <div className="font-medium truncate">{p.name}</div>
                  <div className="text-xs text-gray-400 mt-0.5 flex gap-1">
                    <span>{p.code}</span>
                    {p.has_bia && <span className="text-green-500">✓</span>}
                  </div>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </aside>

      <div className="flex-1 min-w-0">
        <PageHeader
          title="BIA & BIV-Classificatie"
          subtitle={pid ? processes.find(p => p.id === pid)?.name : 'Selecteer een proces'}
        />

        {!pid && (
          <Card className="text-center py-12 text-gray-400">
            <p>Selecteer een proces aan de linkerkant om de BIA in te vullen.</p>
          </Card>
        )}

        {pid && (
          <>
            {/* Score summary */}
            {(() => {
              const procScore = highestSeverity([autoB, autoI, autoV])
              const subScores = [
                { abbr: 'B', label: 'Beschikbaarheid', score: effectiveForm.availability_score },
                { abbr: 'I', label: 'Integriteit',     score: effectiveForm.integrity_score },
                { abbr: 'V', label: 'Vertrouwelijkheid', score: effectiveForm.confidentiality_score },
              ]
              return (
                <div className="mb-4">
                  {/* Parent: Procesclassificatie */}
                  <div className={`rounded-xl border border-gray-200 shadow-sm overflow-hidden ${procScore ? SCORE_STRIP_BG[procScore] : 'bg-gray-50'}`}>
                    <div className="flex flex-col items-center py-4 px-6 text-center">
                      <div className="text-[10px] font-semibold uppercase tracking-widest text-gray-400 mb-1.5">
                        Procesclassificatie
                      </div>
                      <div className={`text-base font-bold ${procScore ? SCORE_STRIP_TEXT[procScore] : 'text-gray-400'}`}>
                        {procScore ? SCORE_LABELS[procScore] : 'Nog niet bepaald'}
                      </div>
                    </div>
                  </div>

                  {/* Hierarchy connector */}
                  <div className="flex flex-col items-center py-1">
                    <div className="w-px h-3 bg-gray-300" />
                    <ChevronDown size={13} className="text-gray-300 -mt-0.5" />
                  </div>

                  {/* Children: B / I / V */}
                  <div className="grid grid-cols-3 gap-3">
                    {subScores.map(({ abbr, label, score }) => (
                      <div key={abbr} className="rounded-xl border border-gray-200 bg-white shadow-sm flex flex-col items-center py-4 px-3 text-center">
                        <div className="w-6 h-6 rounded-full bg-gray-100 text-gray-600 text-[10px] font-bold flex items-center justify-center mb-2">
                          {abbr}
                        </div>
                        <div className="text-xs text-gray-500 mb-3 leading-tight">{label}</div>
                        <ScoreBadge score={score} />
                      </div>
                    ))}
                  </div>
                </div>
              )
            })()}

            <div className="flex gap-2 mb-4 border-b border-gray-200">
              {(['Algemeen', 'Beschikbaarheid', 'Integriteit', 'Vertrouwelijkheid'] as TabKey[]).map(t => (
                <button
                  key={t}
                  onClick={() => setTab(t)}
                  className={`px-4 py-2 text-sm font-medium border-b-2 -mb-px transition-colors ${
                    tab === t ? 'border-brand-600 text-brand-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                  }`}
                >
                  {t}
                </button>
              ))}
            </div>

            {tab === 'Algemeen' && (
              <>
              <Card>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField label="Interviewer">
                    <Input value={currentForm.interviewer_name ?? ''} onChange={e => setField('interviewer_name', e.target.value)} />
                  </FormField>
                  <FormField label="Laatste review datum">
                    {(() => {
                      const cutoff = new Date()
                      cutoff.setFullYear(cutoff.getFullYear() - 1)
                      const reviewDate = currentForm.interview_date ? new Date(currentForm.interview_date) : null
                      const isExpired = reviewDate !== null && reviewDate < cutoff
                      return (
                        <>
                          <input
                            type="date"
                            value={currentForm.interview_date ?? ''}
                            onChange={e => setField('interview_date', e.target.value)}
                            className={[
                              'w-full rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:border-transparent',
                              isExpired
                                ? 'border border-red-300 bg-red-50 text-red-700 focus:ring-red-300'
                                : 'border border-gray-300 focus:ring-brand-500',
                            ].join(' ')}
                          />
                          {isExpired && (
                            <span className="text-xs font-medium text-red-600 bg-red-50 border border-red-200 rounded-full px-2 py-0.5 self-start">
                              Review verlopen
                            </span>
                          )}
                        </>
                      )
                    })()}
                  </FormField>

                  <FormField label="Notities" className="md:col-span-2">
                    <Textarea value={currentForm.notes ?? ''} onChange={e => setField('notes', e.target.value)} rows={2} />
                  </FormField>
                </div>
              </Card>

              <Card className="mt-4">
                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">Business Continuity Parameters</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                  <FormField label="MTPD / MTD">
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[4], effectiveForm.b5_score)} />
                  </FormField>
                  <FormField label="RTO">
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[5], effectiveForm.b6_score)} />
                  </FormField>
                  <FormField label="WRT">
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[6], effectiveForm.b7_score)} />
                  </FormField>
                  <FormField label="RPO">
                    <BcpValueDisplay value={bcpAnswerInfo(B_QUESTIONS[7], effectiveForm.b8_score)} />
                  </FormField>
                </div>
                <div className="mt-8 pt-8 border-t border-gray-100">
                  <BcpTimeline
                    mtpd={effectiveForm.b5_score ? BCP_COMPACT_MAP.mtpd[effectiveForm.b5_score as keyof typeof BCP_COMPACT_MAP.mtpd] : undefined}
                    rto={effectiveForm.b6_score  ? BCP_COMPACT_MAP.rto[effectiveForm.b6_score  as keyof typeof BCP_COMPACT_MAP.rto]  : undefined}
                    wrt={effectiveForm.b7_score  ? BCP_COMPACT_MAP.wrt[effectiveForm.b7_score  as keyof typeof BCP_COMPACT_MAP.wrt]  : undefined}
                    rpo={effectiveForm.b8_score  ? BCP_COMPACT_MAP.rpo[effectiveForm.b8_score  as keyof typeof BCP_COMPACT_MAP.rpo]  : undefined}
                  />
                </div>
              </Card>
              </>
            )}

            {tab === 'Beschikbaarheid' && (
              <Card>
                <p className="text-sm text-gray-500 mb-5">Beoordeel de impact van uitval van het proces op onderstaande criteria.</p>
                <div className="space-y-6">
                  {B_QUESTIONS.map(q => (
                    <QuestionBlock
                      key={q.key}
                      question={q}
                      score={effectiveForm[`${q.key}_score` as keyof BiaAssessment] as number}
                      arg={effectiveForm[`${q.key}_arg` as keyof BiaAssessment] as string}
                      onScore={v => setField(`${q.key}_score` as keyof BiaAssessment, v)}
                      onArg={v => setField(`${q.key}_arg` as keyof BiaAssessment, v)}
                    />
                  ))}
                </div>
              </Card>
            )}

            {tab === 'Integriteit' && (
              <Card>
                <p className="text-sm text-gray-500 mb-5">Beoordeel de impact van onjuiste of gemanipuleerde gegevens op onderstaande criteria.</p>
                <div className="space-y-6">
                  {I_QUESTIONS.map(q => (
                    <QuestionBlock
                      key={q.key}
                      question={q}
                      score={effectiveForm[`${q.key}_score` as keyof BiaAssessment] as number}
                      arg={effectiveForm[`${q.key}_arg` as keyof BiaAssessment] as string}
                      onScore={v => setField(`${q.key}_score` as keyof BiaAssessment, v)}
                      onArg={v => setField(`${q.key}_arg` as keyof BiaAssessment, v)}
                    />
                  ))}
                </div>
              </Card>
            )}

            {tab === 'Vertrouwelijkheid' && (
              <Card>
                <p className="text-sm text-gray-500 mb-5">Beoordeel de impact van datalekkage of ongeautoriseerde toegang op onderstaande criteria.</p>
                <div className="space-y-6">
                  {V_QUESTIONS.map(q => (
                    <QuestionBlock
                      key={q.key}
                      question={q}
                      score={effectiveForm[`${q.key}_score` as keyof BiaAssessment] as number}
                      arg={effectiveForm[`${q.key}_arg` as keyof BiaAssessment] as string}
                      onScore={v => setField(`${q.key}_score` as keyof BiaAssessment, v)}
                      onArg={v => setField(`${q.key}_arg` as keyof BiaAssessment, v)}
                    />
                  ))}
                </div>
              </Card>
            )}

          </>
        )}
      </div>
    </div>
  )
}

// ── BcpValueDisplay ───────────────────────────────────────────────────────────

function BcpValueDisplay({ value }: { value: string | undefined }) {
  if (!value) {
    return (
      <div className="flex items-center px-3 py-2 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400 min-h-[36px]">
        Nog niet bepaald
      </div>
    )
  }
  return (
    <div className="px-3 py-2 rounded-lg border border-gray-200 bg-gray-50 text-sm text-gray-700 leading-snug min-h-[36px]">
      {value}
    </div>
  )
}

// ── AutoScoreDisplay ──────────────────────────────────────────────────────────

// Score color classes matching severity (1=most severe, 5=least severe)
const SCORE_COLORS: Record<number, string> = {
  1: 'bg-red-50 border-red-300 text-red-700',
  2: 'bg-orange-50 border-orange-300 text-orange-700',
  3: 'bg-yellow-50 border-yellow-300 text-yellow-700',
  4: 'bg-blue-50 border-blue-300 text-blue-700',
  5: 'bg-green-50 border-green-300 text-green-700',
}

// Solid background + text for the Procesclassificatie strip
const SCORE_STRIP_BG: Record<number, string> = {
  1: 'bg-red-50',
  2: 'bg-orange-50',
  3: 'bg-yellow-50',
  4: 'bg-blue-50',
  5: 'bg-green-50',
}
const SCORE_STRIP_TEXT: Record<number, string> = {
  1: 'text-red-700',
  2: 'text-orange-700',
  3: 'text-yellow-700',
  4: 'text-blue-700',
  5: 'text-green-700',
}
const SCORE_CIRCLE: Record<number, string> = {
  1: 'bg-red-100 text-red-700 ring-red-200',
  2: 'bg-orange-100 text-orange-700 ring-orange-200',
  3: 'bg-yellow-100 text-yellow-700 ring-yellow-200',
  4: 'bg-blue-100 text-blue-700 ring-blue-200',
  5: 'bg-green-100 text-green-700 ring-green-200',
}

function AutoScoreDisplay({ score, fallback }: { score: number | undefined; fallback: string }) {
  if (score === undefined) {
    return (
      <div className="flex items-center h-9 px-3 rounded-lg border border-dashed border-gray-300 text-sm text-gray-400">
        {fallback}
      </div>
    )
  }
  return (
    <div className={`flex items-center gap-2 h-9 px-3 rounded-lg border text-sm font-medium ${SCORE_COLORS[score] ?? 'bg-gray-50 border-gray-300 text-gray-700'}`}>
      <span>{SCORE_LABELS[score]}</span>
      <span className="ml-auto text-xs font-normal opacity-60">automatisch</span>
    </div>
  )
}

// ── BcpTimeline ───────────────────────────────────────────────────────────────
// Uses Visual BC-Parameters.png (1872×576) as a fixed background template.
// Only the 4 dynamic values (mtpd, rto, wrt, rpo) are overlaid via absolute positioning.
//
// Calibration against Visual BC-Parameters.png (1872×576 px) — pixel-scanned:
//   Arrows at y=210 (36.5%) define RPO/RTO/WRT horizontal spans:
//     RPO:  x=374–705,  center=540  → left=28.8%
//     RTO:  x=728–1145, center=936  → left=50.0%
//     WRT:  x=1167–1522,center=1344 → left=71.8%
//   MTD bracket lines at y=66 and y=107:
//     Horizontal span: x=978–1251, center=1114 → left=59.5%
//   Value text Y zones (% of height):
//     MTD value:        14.9% (y≈86, center of white zone y=67–105 inside bracket)
//     RPO/RTO/WRT:      42.5% (y≈245, center of white zone y=226–264 below arrows)

function BcpTimeline({ mtpd, rto, wrt, rpo }: {
  mtpd?: string; rto?: string; wrt?: string; rpo?: string
}) {
  const dash = '—'
  const cap = (s?: string) => s ? s.charAt(0).toUpperCase() + s.slice(1) : dash

  // Base overlay style: no background, no border — text appears to be part of the image.
  // left/top mark the CENTER of the text element (via translate -50% -50%).
  // Positions calibrated from pixel scan of Visual BC-Parameters.png (1872×576):
  //   Each label is centered in its largest unobstructed white run within the image.
  const base: React.CSSProperties = {
    position: 'absolute',
    transform: 'translate(-50%, -50%)',
    whiteSpace: 'nowrap',
    fontSize: '0.7rem',
    fontWeight: 700,
    lineHeight: 1,
    color: '#1a1a1a',
    pointerEvents: 'none',
    userSelect: 'none',
  }

  return (
    <div className="relative w-full" style={{ lineHeight: 0 }}>
      {/* ── Static template image ── */}
      <img
        src={bcpTimelineImg}
        alt="Business Continuity tijdlijn: Business As Usual → Dataverlies → Systeemuitval → Hervatting Productie → Business As Usual"
        className="w-full h-auto block"
        draggable={false}
      />

      {/* MTD/MTPD — bracket x=978–1251 (center=1114 → 59.5%), white zone y=67–105 (center=86 → 14.9%) */}
      <span style={{ ...base, left: '59.5%', top: '14.9%' }}>
        {cap(mtpd)}
      </span>

      {/* RPO — arrow x=374–705 (center=540 → 28.8%), white zone y=226–264 (center=245 → 42.5%) */}
      <span style={{ ...base, left: '28.8%', top: '42.5%' }}>
        {cap(rpo)}
      </span>

      {/* RTO — arrow x=728–1145 (center=936 → 50.0%), white zone y=226–264 (center=245 → 42.5%) */}
      <span style={{ ...base, left: '50.0%', top: '42.5%' }}>
        {cap(rto)}
      </span>

      {/* WRT — arrow x=1167–1522 (center=1344 → 71.8%), white zone y=226–264 (center=245 → 42.5%) */}
      <span style={{ ...base, left: '71.8%', top: '42.5%' }}>
        {cap(wrt)}
      </span>
    </div>
  )
}

// ── QuestionBlock ─────────────────────────────────────────────────────────────

function QuestionBlock({ question, score, arg, onScore, onArg }: {
  question: BiaQuestion
  score?: number
  arg?: string
  onScore: (v: number | undefined) => void
  onArg: (v: string) => void
}) {
  const [openQuestionInfo, setOpenQuestionInfo] = useState(false)
  const [openAnswerInfo, setOpenAnswerInfo] = useState<number | null>(null)

  return (
    <div className="border-b border-gray-100 pb-5 last:border-0">
      {/* Question label + optional i-icon */}
      <div className="flex items-start gap-1.5 mb-3">
        <div className="font-medium text-sm text-gray-800 flex-1">{question.label}</div>
        {question.tooltip && (
          <div className="relative shrink-0 mt-0.5">
            <button
              onClick={e => { e.stopPropagation(); setOpenQuestionInfo(v => !v) }}
              className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
              title="Meer informatie"
            >
              <Info size={14} strokeWidth={1.75} />
            </button>
            {openQuestionInfo && (
              <InfoPopover text={question.tooltip} onClose={() => setOpenQuestionInfo(false)} />
            )}
          </div>
        )}
      </div>

      {/* Answer buttons */}
      <div className="flex flex-wrap gap-2 mb-3">
        {question.answers.map((opt, idx) => {
          const val = idx + 1
          return (
            <div key={val} className="relative">
              <div className="flex items-center gap-0.5">
                <button
                  onClick={() => onScore(score === val ? undefined : val)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors ${
                    score === val
                      ? 'bg-brand-600 text-white border-brand-600'
                      : 'bg-white text-gray-600 border-gray-300 hover:border-brand-400'
                  }`}
                >
                  {opt.label}
                </button>
                <button
                  onClick={e => { e.stopPropagation(); setOpenAnswerInfo(prev => prev === val ? null : val) }}
                  className="p-0.5 rounded text-gray-300 hover:text-gray-500 hover:bg-gray-100 transition-colors"
                  title="Toelichting antwoord"
                >
                  <Info size={12} strokeWidth={1.75} />
                </button>
              </div>
              {openAnswerInfo === val && (
                <InfoPopover text={opt.info} onClose={() => setOpenAnswerInfo(null)} />
              )}
            </div>
          )
        })}
      </div>

      {/* Argumentation textarea */}
      <textarea
        rows={2}
        placeholder="Toelichting / argumentatie..."
        value={arg ?? ''}
        onChange={e => onArg(e.target.value)}
        className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 resize-y"
      />
    </div>
  )
}
