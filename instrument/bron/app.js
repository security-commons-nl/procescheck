/* procescheck in de browser.
 *
 * De rekenregels staan hieronder in het object `reken`, met dezelfde namen en dezelfde uitkomsten als
 * instrument/reken.py. Die spiegeling is geen dubbel werk maar de controle: een test vergelijkt beide
 * kanten, zodat de pagina niet stil iets anders gaat rekenen dan de referentie.
 *
 * De pagina bewaart alles in localStorage en in een JSON-dossier dat je zelf opslaat. Er gaat niets
 * naar een server; er is er ook geen.
 */
(function () {
  'use strict';

  var BRON = window.__BRON__;
  var SLEUTEL = 'procescheck-dossier';
  var DIMENSIES = ['B', 'I', 'V'];
  var CONTEXT_TEKSTVELDEN = ['partners', 'activiteiten', 'middelen', 'propositie', 'klantrelaties',
    'kanalen', 'segmenten', 'kosten', 'opbrengsten', 'wettelijke_basis', 'stakeholders',
    'ketenpositie', 'kernaspecten', 'continuiteitseisen', 'reviewdatum', 'notities'];
  var VRAAG_IDS = ['b1', 'b2', 'b3', 'b4', 'i1', 'v1'];

  // ── reken: spiegel van instrument/reken.py ─────────────────────────────────
  var reken = {};

  reken.rond_half_omhoog = function (x) {
    return Math.floor(x + 0.5);
  };

  reken.procent = function (done, total) {
    return total <= 0 ? 0 : reken.rond_half_omhoog((done / total) * 100);
  };

  reken.klasse_score = function (scores) {
    var geldig = scores.filter(function (s) {
      return typeof s === 'number' && s >= 1 && s <= 5;
    });
    return geldig.length ? Math.min.apply(null, geldig) : null;
  };

  reken.bia = function (antwoorden) {
    antwoorden = antwoorden || {};
    var b = reken.klasse_score([antwoorden.b1, antwoorden.b2, antwoorden.b3, antwoorden.b4]);
    var i = reken.klasse_score([antwoorden.i1]);
    var v = reken.klasse_score([antwoorden.v1]);
    return { B: b, I: i, V: v, proces: reken.klasse_score([b, i, v]) };
  };

  reken.parameterlabel = function (bron, parameter, score) {
    if (score === null || score === undefined || !bron.parameters[parameter]) return null;
    var waarde = bron.parameters[parameter][String(score)];
    return waarde === undefined ? null : waarde;
  };

  reken.label_van_score = function (bron, score) {
    for (var i = 0; i < bron.schaal.length; i++) {
      if (bron.schaal[i].score === score) return bron.schaal[i].label;
    }
    return null;
  };

  function leeg(waarde) {
    return String(waarde === null || waarde === undefined ? '' : waarde).trim() === '';
  }

  reken.heeft_bia = function (proces) {
    var antwoorden = proces.bia || {};
    return VRAAG_IDS.some(function (id) {
      return antwoorden[id] !== null && antwoorden[id] !== undefined;
    });
  };

  reken.heeft_rto_rpo = function (proces) {
    var antwoorden = proces.bia || {};
    return antwoorden.b1 !== null && antwoorden.b1 !== undefined &&
      antwoorden.b2 !== null && antwoorden.b2 !== undefined;
  };

  reken.context_leeg = function (context) {
    context = context || {};
    var gevuld = CONTEXT_TEKSTVELDEN.some(function (veld) { return !leeg(context[veld]); });
    if (gevuld) return false;
    return !context.persoonsgegevens && !context.bijzondere_persoonsgegevens;
  };

  reken.ontbrekend = function (bron, proces) {
    var kritiek = !!proces.kritiek;
    var gevuld = {
      beschrijving: !leeg(proces.beschrijving),
      doelstelling: !leeg(proces.doelstelling),
      eigenaar: !leeg(proces.eigenaar),
      afdeling: !leeg(proces.afdeling),
      laatste_beoordeling: !leeg(proces.laatste_beoordeling),
      reden_kritiek: !leeg(proces.reden_kritiek),
      applicaties: !!(proces.applicaties && proces.applicaties.length),
      bia: reken.heeft_bia(proces),
      rto_rpo: reken.heeft_rto_rpo(proces),
      context: !reken.context_leeg(proces.context)
    };
    var uit = [];
    bron.volledigheid.forEach(function (controle) {
      if (controle.alleen_als_kritiek && !kritiek) return;
      if (!gevuld[controle.id]) uit.push(controle.label);
    });
    return uit;
  };

  reken.hoog_risico = function (proces) {
    var scores = reken.bia(proces.bia);
    return DIMENSIES.some(function (dim) {
      return scores[dim] !== null && scores[dim] <= 2;
    });
  };

  reken.prioriteit = function (bron, proces) {
    var mist = reken.ontbrekend(bron, proces);
    if (!mist.length) return null;
    var perRegel = {};
    bron.prioriteiten.forEach(function (p) { perRegel[p.regel] = p; });
    var regel;
    if (proces.kritiek && !reken.heeft_bia(proces)) regel = perRegel.kritiek_zonder_bia;
    else if (reken.hoog_risico(proces) && !reken.heeft_rto_rpo(proces)) regel = perRegel.hoog_risico_zonder_rto_rpo;
    else if (proces.kritiek) regel = perRegel.kritiek_onvolledig;
    else if (mist.length >= 4) regel = perRegel.vier_of_meer_ontbrekend;
    else regel = perRegel.anders;
    return {
      prioriteit: regel.id,
      reden: regel.reden.replace('{n}', String(mist.length)),
      ontbrekend: mist
    };
  };

  reken.cutoff = function (vandaag) {
    var delen = vandaag.split('-');
    var jaar = parseInt(delen[0], 10), maand = delen[1], dag = delen[2];
    if (maand === '02' && dag === '29') dag = '28';
    return String(jaar - 1) + '-' + maand + '-' + dag;
  };

  reken.op_tijd = function (datum, vandaag) {
    return !!datum && String(datum) >= reken.cutoff(vandaag);
  };

  reken.slug = function (tekst) {
    var schoon = String(tekst || '').toLowerCase().replace(/[^a-z0-9]+/g, '-');
    var uit = schoon.split('-').filter(Boolean).join('-').slice(0, 40).replace(/^-+|-+$/g, '');
    return uit || 'organisatie';
  };

  reken.bestandsnaam = function (dossier, vandaag) {
    return 'procescheck-dossier-' + reken.slug((dossier.organisatie || {}).naam) + '-' + vandaag + '.json';
  };

  reken.dashboard = function (bron, dossier, vandaag) {
    var processen = dossier.processen || [];
    var applicaties = dossier.applicaties || [];
    var totaal = processen.length;
    var compleet = 0, aandacht = 0, onvolledig = 0;
    processen.forEach(function (proces) {
      var n = reken.ontbrekend(bron, proces).length;
      if (n === 0) compleet++; else if (n <= 3) aandacht++; else onvolledig++;
    });

    var scores = {};
    processen.forEach(function (proces) { scores[proces.code] = reken.bia(proces.bia); });

    var verdeling = {}, top = {};
    DIMENSIES.forEach(function (dim) {
      var tel = { '1': 0, '2': 0, '3': 0, '4': 0, '5': 0, leeg: 0 };
      var rijen = [];
      processen.forEach(function (proces) {
        var score = scores[proces.code][dim];
        if (score === null) tel.leeg++; else tel[String(score)]++;
        if (score !== null) rijen.push({ code: proces.code, naam: proces.naam || '', score: score });
      });
      verdeling[dim] = tel;
      top[dim] = rijen.sort(function (a, b) {
        return a.score - b.score || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
      }).slice(0, 5);
    });

    function dek(test) {
      var done = processen.filter(test).length;
      return { done: done, total: totaal, pct: reken.procent(done, totaal) };
    }
    var dekking = {
      bia: dek(reken.heeft_bia),
      rto_rpo: dek(reken.heeft_rto_rpo),
      context: dek(function (p) { return !reken.context_leeg(p.context); }),
      applicaties: dek(function (p) { return !!(p.applicaties && p.applicaties.length); })
    };

    var privacy = {
      persoonsgegevens: processen.filter(function (p) { return (p.context || {}).persoonsgegevens; }).length,
      bijzonder: processen.filter(function (p) { return (p.context || {}).bijzondere_persoonsgegevens; }).length
    };

    function reviewItem(waarden, totaalItems) {
      var done = waarden.filter(function (w) { return reken.op_tijd(w, vandaag); }).length;
      return { on_time: done, total: totaalItems, pct: reken.procent(done, totaalItems) };
    }
    var review = {
      processen: reviewItem(processen.map(function (p) { return p.laatste_beoordeling; }), totaal),
      bia: reviewItem(processen.map(function (p) {
        return reken.heeft_bia(p) ? (p.bia || {}).interviewdatum : null;
      }), totaal),
      context: reviewItem(processen.map(function (p) {
        return reken.context_leeg(p.context) ? null : (p.context || {}).reviewdatum;
      }), totaal),
      applicaties: reviewItem(applicaties.map(function (a) { return a.reviewdatum; }), applicaties.length)
    };

    var volgorde = { critical: 0, high: 1, medium: 2, low: 3 };
    var prioriteiten = [];
    processen.forEach(function (proces) {
      var uitkomst = reken.prioriteit(bron, proces);
      if (!uitkomst) return;
      prioriteiten.push({
        code: proces.code, naam: proces.naam || '', prioriteit: uitkomst.prioriteit,
        reden: uitkomst.reden, ontbrekend: uitkomst.ontbrekend
      });
    });
    prioriteiten.sort(function (a, b) {
      return volgorde[a.prioriteit] - volgorde[b.prioriteit] ||
        (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
    });

    var kritiekLijst = processen.slice().sort(function (a, b) {
      var ka = scores[a.code].proces === null ? 9 : scores[a.code].proces;
      var kb = scores[b.code].proces === null ? 9 : scores[b.code].proces;
      return ka - kb || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
    }).filter(function (p) { return p.kritiek; }).map(function (p) {
      return {
        code: p.code, naam: p.naam || '', B: scores[p.code].B, I: scores[p.code].I,
        V: scores[p.code].V, klasse: scores[p.code].proces, heeft_bia: reken.heeft_bia(p),
        heeft_rto_rpo: reken.heeft_rto_rpo(p), ontbrekend: reken.ontbrekend(bron, p)
      };
    });

    return {
      totaal: totaal,
      kritiek: processen.filter(function (p) { return p.kritiek; }).length,
      compleet: compleet, aandacht: aandacht, onvolledig: onvolledig,
      hoog_risico: processen.filter(reken.hoog_risico).length,
      verdeling: verdeling, top: top, dekking: dekking, privacy: privacy, review: review,
      prioriteiten: prioriteiten, kritiek_lijst: kritiekLijst
    };
  };

  reken.landschap = function (dossier) {
    var nodes = [], edges = [], waarschuwingen = [], gezien = {};
    var appCodes = {}, ciIds = {};
    (dossier.applicaties || []).forEach(function (a) { appCodes[a.code] = true; });
    (dossier.componenten || []).forEach(function (c) { ciIds[c.id] = true; });

    (dossier.processen || []).forEach(function (p) {
      nodes.push({ id: 'proces:' + p.code, label: p.naam || p.code, type: 'proces', kritiek: !!p.kritiek });
    });
    (dossier.applicaties || []).forEach(function (a) {
      nodes.push({ id: 'app:' + a.code, label: a.naam || a.code, type: 'app', kritiek: false });
    });
    (dossier.componenten || []).forEach(function (c) {
      nodes.push({ id: 'ci:' + c.id, label: c.label || c.id, type: 'ci', kritiek: !!c.kritiek });
    });

    function voegToe(van, naar, relatie) {
      var sleutel = JSON.stringify([van, naar]);
      if (gezien[sleutel]) return;
      gezien[sleutel] = true;
      edges.push({ from: van, to: naar, relatie: relatie });
    }

    (dossier.processen || []).forEach(function (p) {
      (p.applicaties || []).forEach(function (code) {
        if (!appCodes[code]) {
          waarschuwingen.push('proces ' + p.code + ' verwijst naar onbekende applicatie ' + code);
          return;
        }
        voegToe('app:' + code, 'proces:' + p.code, 'ondersteunt');
      });
    });

    (dossier.component_edges || []).forEach(function (edge) {
      if (!ciIds[edge.from]) {
        waarschuwingen.push('edge ' + edge.from + ' naar ' + edge.to + ': onbekende bron');
        return;
      }
      // Eerst applicatie, dan component: een code die beide is, is een applicatie.
      var doel;
      if (appCodes[edge.to]) doel = 'app:' + edge.to;
      else if (ciIds[edge.to]) doel = 'ci:' + edge.to;
      else {
        waarschuwingen.push('edge ' + edge.from + ' naar ' + edge.to + ': onbekend doel');
        return;
      }
      voegToe('ci:' + edge.from, doel, edge.relatie || 'ondersteunt');
    });

    return { nodes: nodes, edges: edges, waarschuwingen: waarschuwingen };
  };

  reken.uitgaand = function (land, nodeId) {
    return land.edges.filter(function (e) { return e.from === nodeId; })
      .map(function (e) { return e.to; });
  };

  reken.inkomend = function (land, nodeId) {
    return land.edges.filter(function (e) { return e.to === nodeId; })
      .map(function (e) { return e.from; });
  };

  /* Python geeft hier een tupel terug; JavaScript kent dat niet, dus het is een object met dezelfde
     twee waarden: de verzameling geraakte nodes (gesorteerd) en of er een cyclus is geraakt. */
  reken.bereik = function (land, start) {
    var gezien = {}, cyclus = false;
    var stapel = reken.uitgaand(land, start);
    while (stapel.length) {
      var node = stapel.pop();
      if (node === start) { cyclus = true; continue; }
      if (gezien[node]) continue;
      gezien[node] = true;
      stapel = stapel.concat(reken.uitgaand(land, node));
    }
    return { geraakt: Object.keys(gezien).sort(), cyclus: cyclus };
  };

  reken.impact = function (land, nodeId) {
    var geraakt = reken.bereik(land, nodeId).geraakt;
    var perId = {};
    land.nodes.forEach(function (n) { perId[n.id] = n; });
    var processen = geraakt.filter(function (i) {
      return perId[i] && perId[i].type === 'proces';
    }).sort();
    var kritieke = processen.filter(function (i) { return perId[i].kritiek; });
    return { node_id: nodeId, geraakt: geraakt, processen: processen, kritieke: kritieke };
  };

  reken.dekking = function (land, procesId) {
    var perId = {};
    land.nodes.forEach(function (n) { perId[n.id] = n; });
    return reken.inkomend(land, procesId).filter(function (bronId) {
      return perId[bronId] && perId[bronId].type === 'app';
    }).length;
  };

  reken.ranglijst = function (land) {
    return land.nodes.filter(function (n) { return n.type !== 'proces'; })
      .map(function (n) { return reken.impact(land, n.id); })
      .sort(function (a, b) {
        return b.kritieke.length - a.kritieke.length ||
          b.processen.length - a.processen.length ||
          b.geraakt.length - a.geraakt.length ||
          (a.node_id < b.node_id ? -1 : a.node_id > b.node_id ? 1 : 0);
      });
  };

  reken.single_points = function (land) {
    return land.nodes.filter(function (n) {
      return n.type === 'proces' && n.kritiek && reken.dekking(land, n.id) <= 1;
    }).map(function (n) { return n.id; }).sort();
  };

  reken.cyclus_waarschuwingen = function (land) {
    var uit = [];
    land.nodes.forEach(function (n) {
      if (reken.bereik(land, n.id).cyclus) {
        uit.push('Cyclus geraakt vanaf \'' + n.id + '\'; de blast radius is berekend maar het ' +
          'landschap hoort acyclisch te zijn.');
      }
    });
    return uit;
  };

  reken.dragende_nodes = function (land) {
    var uit = {};
    land.nodes.forEach(function (n) {
      if (n.type === 'proces' && n.kritiek) uit[n.id] = true;
      else if (n.type !== 'proces' && reken.impact(land, n.id).kritieke.length) uit[n.id] = true;
    });
    return Object.keys(uit).sort();
  };

  reken.kroonjuwelen = function (bron, dossier) {
    var perCode = {};
    (dossier.applicaties || []).forEach(function (a) { perCode[a.code] = a; });
    return (dossier.processen || []).filter(function (p) { return p.kritiek; }).map(function (p) {
      var klasse = reken.bia(p.bia).proces;
      return {
        code: p.code, naam: p.naam || '', eigenaar: p.eigenaar || '', klasse: klasse,
        klasse_label: reken.label_van_score(bron, klasse),
        systemen: (p.applicaties || []).map(function (c) {
          return (perCode[c] && perCode[c].naam) || c;
        })
      };
    }).sort(function (a, b) {
      var ka = a.klasse === null ? 9 : a.klasse, kb = b.klasse === null ? 9 : b.klasse;
      return ka - kb || (a.code < b.code ? -1 : a.code > b.code ? 1 : 0);
    });
  };

  // ── Hulp voor de pagina ───────────────────────────────────────────────────

  function el(id) { return document.getElementById(id); }
  function alle(selector, wortel) { return Array.prototype.slice.call((wortel || document).querySelectorAll(selector)); }

  function maak(tag, tekst, attributen) {
    var knoop = document.createElement(tag);
    if (tekst !== null && tekst !== undefined) knoop.textContent = String(tekst);
    if (attributen) {
      Object.keys(attributen).forEach(function (naam) {
        if (attributen[naam] !== null && attributen[naam] !== undefined) {
          knoop.setAttribute(naam, String(attributen[naam]));
        }
      });
    }
    return knoop;
  }

  function leegMaken(knoop) {
    while (knoop.firstChild) knoop.removeChild(knoop.firstChild);
    return knoop;
  }

  function rij(cellen, attributen, kop) {
    var tr = maak('tr', null, attributen);
    cellen.forEach(function (cel) {
      if (cel && cel.nodeType) { tr.appendChild(cel); return; }
      var td = maak(kop ? 'th' : 'td', cel === null || cel === undefined ? '' : cel);
      if (kop) td.setAttribute('scope', 'col');
      tr.appendChild(td);
    });
    return tr;
  }

  function tabel(doel, koppen, rijen) {
    leegMaken(doel);
    var thead = maak('thead');
    thead.appendChild(rij(koppen, null, true));
    doel.appendChild(thead);
    var tbody = maak('tbody');
    rijen.forEach(function (r) { tbody.appendChild(r); });
    doel.appendChild(tbody);
    return doel;
  }

  function vandaag() {
    var nu = new Date();
    return nu.getFullYear() + '-' + String(nu.getMonth() + 1).padStart(2, '0') + '-' +
      String(nu.getDate()).padStart(2, '0');
  }

  function scoreUit(select) {
    // Een lege keuze moet null worden. Via het getaltype zou een lege tekst 0 opleveren, en 0 wint elke min().
    return select.value === '' ? null : parseInt(select.value, 10);
  }

  function vlag(tekst, klasse) {
    return maak('span', tekst, { 'class': 'vlag ' + klasse });
  }

  // ── Het dossier ───────────────────────────────────────────────────────────

  function leegContext() {
    var uit = {};
    CONTEXT_TEKSTVELDEN.forEach(function (veld) { uit[veld] = ''; });
    uit.persoonsgegevens = false;
    uit.bijzondere_persoonsgegevens = false;
    return uit;
  }

  function leegBia() {
    var uit = { onderbouwing: {} };
    VRAAG_IDS.forEach(function (id) { uit[id] = null; uit.onderbouwing[id] = ''; });
    uit.interviewer = '';
    uit.interviewdatum = '';
    uit.beschrijving = '';
    uit.ketenafhankelijkheden = '';
    uit.afwijking_eigenaar = '';
    uit.notities = '';
    return uit;
  }

  function leegProces(code) {
    return {
      code: code, naam: '', beschrijving: '', doelstelling: '', eigenaar: '', afdeling: '',
      kritiek: false, reden_kritiek: '', laatste_beoordeling: '', notities: '', applicaties: [],
      bia: leegBia(),
      rto_rpo: { rto: '', rto_eenheid: '', rpo: '', rpo_eenheid: '', toelichting: '' },
      context: leegContext()
    };
  }

  function leegDossier() {
    return {
      formaat: 'procescheck-dossier', versie: 1, bron_versie: BRON.versie,
      bron_sha256: BRON.vingerafdruk, bijgewerkt: '',
      organisatie: { naam: '', peildatum: '' },
      processen: [], applicaties: [], componenten: [], component_edges: [],
      landschap_bron: { bestand: '', geimporteerd: '' },
      herkomst_ai: []
    };
  }

  var dossier = leegDossier();
  var voorstel = null;
  var gekozenProces = null;
  var gekozenContext = null;
  var bewerktProces = null;
  var bewerktApp = null;
  var gekozenNode = null;

  function bewaar() {
    dossier.bijgewerkt = vandaag();
    try {
      window.localStorage.setItem(SLEUTEL, JSON.stringify(dossier));
    } catch (fout) {
      // Een browser in privémodus mag weigeren; het dossier blijft dan in het geheugen staan.
    }
    tekenAlles();
  }

  function herstel() {
    var ruw = null;
    try { ruw = window.localStorage.getItem(SLEUTEL); } catch (fout) { ruw = null; }
    if (!ruw) return;
    try {
      var data = JSON.parse(ruw);
      if (data && data.formaat === 'procescheck-dossier') dossier = vulAan(data);
    } catch (fout) {
      // Onleesbaar dossier: liever leeg beginnen dan halve data tonen.
    }
  }

  function vulAan(data) {
    var basis = leegDossier();
    Object.keys(basis).forEach(function (sleutel) {
      if (data[sleutel] === undefined) data[sleutel] = basis[sleutel];
    });
    data.organisatie = data.organisatie || { naam: '', peildatum: '' };
    (data.processen || []).forEach(function (proces) {
      var leegP = leegProces(proces.code);
      Object.keys(leegP).forEach(function (sleutel) {
        if (proces[sleutel] === undefined) proces[sleutel] = leegP[sleutel];
      });
      proces.bia = proces.bia || leegBia();
      proces.bia.onderbouwing = proces.bia.onderbouwing || {};
      proces.context = proces.context || leegContext();
    });
    return data;
  }

  function procesVan(code) {
    var gevonden = null;
    dossier.processen.forEach(function (p) { if (p.code === code) gevonden = p; });
    return gevonden;
  }

  function appVan(code) {
    var gevonden = null;
    dossier.applicaties.forEach(function (a) { if (a.code === code) gevonden = a; });
    return gevonden;
  }

  // ── Tabs ──────────────────────────────────────────────────────────────────

  function toonScherm(schermId) {
    alle('.scherm').forEach(function (scherm) { scherm.hidden = scherm.id !== schermId; });
    alle('.tabs button').forEach(function (knop) {
      knop.setAttribute('aria-selected', knop.getAttribute('data-scherm') === schermId ? 'true' : 'false');
    });
  }

  // ── Processen ─────────────────────────────────────────────────────────────

  function tekenProcessen() {
    var rijen = dossier.processen.map(function (proces) {
      var scores = reken.bia(proces.bia);
      var mist = reken.ontbrekend(BRON, proces);
      var prio = reken.prioriteit(BRON, proces);
      var klasse = scores.proces === null ? '-' :
        scores.proces + ' · ' + reken.label_van_score(BRON, scores.proces);
      var knoppen = maak('td');
      var bewerk = maak('button', 'Bewerken', { type: 'button', 'class': 'bewerk' });
      bewerk.addEventListener('click', function () { openProcesForm(proces.code); });
      var verwijder = maak('button', 'Verwijderen', { type: 'button', 'class': 'verwijder' });
      verwijder.addEventListener('click', function () { verwijderProces(proces.code); });
      knoppen.appendChild(bewerk);
      knoppen.appendChild(verwijder);

      var prioCel = maak('td', null, { 'class': 'prioriteit' });
      if (prio) prioCel.appendChild(vlag(prio.prioriteit, 'prio-' + prio.prioriteit));

      return rij([proces.code, proces.naam, proces.eigenaar, proces.afdeling,
        proces.kritiek ? 'Ja' : 'Nee',
        scores.B === null ? '-' : scores.B, scores.I === null ? '-' : scores.I,
        scores.V === null ? '-' : scores.V, klasse, mist.length, prioCel, knoppen],
        { 'data-proces': proces.code });
    });
    tabel(el('tabel-processen'),
      ['Code', 'Naam', 'Eigenaar', 'Afdeling', 'Kritiek', 'B', 'I', 'V', 'Klasse', 'Ontbrekend',
        'Prioriteit', ''], rijen);
  }

  function vulAppKeuze() {
    var keuze = el('p-applicaties');
    leegMaken(keuze);
    dossier.applicaties.forEach(function (app) {
      keuze.appendChild(maak('option', app.code + ' · ' + (app.naam || ''), { value: app.code }));
    });
  }

  function openProcesForm(code) {
    bewerktProces = code;
    var proces = code ? procesVan(code) : leegProces('');
    vulAppKeuze();
    el('proces-form-kop').textContent = code ? 'Proces ' + code : 'Nieuw proces';
    el('p-code').value = proces.code;
    el('p-naam').value = proces.naam;
    el('p-beschrijving').value = proces.beschrijving;
    el('p-doelstelling').value = proces.doelstelling;
    el('p-eigenaar').value = proces.eigenaar;
    el('p-afdeling').value = proces.afdeling;
    el('p-kritiek').checked = !!proces.kritiek;
    el('p-reden-kritiek').value = proces.reden_kritiek;
    el('p-laatste-beoordeling').value = proces.laatste_beoordeling;
    el('p-notities').value = proces.notities;
    alle('#p-applicaties option').forEach(function (optie) {
      optie.selected = (proces.applicaties || []).indexOf(optie.value) >= 0;
    });
    el('p-melding').hidden = true;
    el('proces-form').hidden = false;
  }

  function slaProcesOp() {
    var code = el('p-code').value.trim();
    var melding = el('p-melding');
    if (!code) {
      melding.textContent = 'Een proces heeft een code nodig.';
      melding.hidden = false;
      return;
    }
    if (code !== bewerktProces && procesVan(code)) {
      melding.textContent = 'De code ' + code + ' bestaat al. Codes zijn uniek in een dossier.';
      melding.hidden = false;
      return;
    }
    var proces = bewerktProces ? procesVan(bewerktProces) : leegProces(code);
    if (!bewerktProces) dossier.processen.push(proces);
    proces.code = code;
    proces.naam = el('p-naam').value.trim();
    proces.beschrijving = el('p-beschrijving').value.trim();
    proces.doelstelling = el('p-doelstelling').value.trim();
    proces.eigenaar = el('p-eigenaar').value.trim();
    proces.afdeling = el('p-afdeling').value.trim();
    proces.kritiek = el('p-kritiek').checked;
    proces.reden_kritiek = el('p-reden-kritiek').value.trim();
    proces.laatste_beoordeling = el('p-laatste-beoordeling').value;
    proces.notities = el('p-notities').value.trim();
    proces.applicaties = alle('#p-applicaties option').filter(function (o) { return o.selected; })
      .map(function (o) { return o.value; });
    el('proces-form').hidden = true;
    bewerktProces = null;
    bewaar();
  }

  function verwijderProces(code) {
    if (!window.confirm('Proces ' + code + ' verwijderen? De BIA en de businesscontext gaan mee.')) return;
    dossier.processen = dossier.processen.filter(function (p) { return p.code !== code; });
    if (gekozenProces === code) gekozenProces = null;
    if (gekozenContext === code) gekozenContext = null;
    bewaar();
  }

  // ── Applicaties ───────────────────────────────────────────────────────────

  function tekenApplicaties() {
    var rijen = dossier.applicaties.map(function (app) {
      var aantal = dossier.processen.filter(function (p) {
        return (p.applicaties || []).indexOf(app.code) >= 0;
      }).length;
      var knoppen = maak('td');
      var bewerk = maak('button', 'Bewerken', { type: 'button', 'class': 'bewerk' });
      bewerk.addEventListener('click', function () { openAppForm(app.code); });
      var verwijder = maak('button', 'Verwijderen', { type: 'button', 'class': 'verwijder' });
      verwijder.addEventListener('click', function () { verwijderApp(app.code); });
      knoppen.appendChild(bewerk);
      knoppen.appendChild(verwijder);
      return rij([app.code, app.naam, app.soort || 'applicatie', app.eigenaar_business,
        app.eigenaar_technisch, aantal, app.reviewdatum || '-', knoppen], { 'data-app': app.code });
    });
    tabel(el('tabel-applicaties'),
      ['Code', 'Naam', 'Soort', 'Eigenaar (business)', 'Eigenaar (technisch)', 'Processen',
        'Reviewdatum', ''], rijen);
  }

  function openAppForm(code) {
    bewerktApp = code;
    var app = code ? appVan(code) : { code: '', naam: '', beschrijving: '', eigenaar_business: '',
      eigenaar_technisch: '', soort: BRON.keuzes.soort_applicatie[0],
      csir_dossier: { bestand: '', vingerafdruk: '' }, notities: '', reviewdatum: '' };
    el('app-form-kop').textContent = code ? 'Applicatie ' + code : 'Nieuwe applicatie';
    el('a-code').value = app.code;
    el('a-naam').value = app.naam;
    el('a-beschrijving').value = app.beschrijving;
    el('a-eigenaar-business').value = app.eigenaar_business;
    el('a-eigenaar-technisch').value = app.eigenaar_technisch;
    el('a-soort').value = app.soort || BRON.keuzes.soort_applicatie[0];
    el('a-csir-bestand').value = (app.csir_dossier || {}).bestand || '';
    el('a-csir-vingerafdruk').value = (app.csir_dossier || {}).vingerafdruk || '';
    el('a-reviewdatum').value = app.reviewdatum || '';
    el('a-notities').value = app.notities;
    el('a-melding').hidden = true;
    el('app-form').hidden = false;
  }

  function slaAppOp() {
    var code = el('a-code').value.trim();
    var melding = el('a-melding');
    if (!code) {
      melding.textContent = 'Een applicatie heeft een code nodig.';
      melding.hidden = false;
      return;
    }
    if (code !== bewerktApp && appVan(code)) {
      melding.textContent = 'De code ' + code + ' bestaat al. Codes zijn uniek in een dossier.';
      melding.hidden = false;
      return;
    }
    var app = bewerktApp ? appVan(bewerktApp) : { code: code, csir_dossier: {} };
    if (!bewerktApp) dossier.applicaties.push(app);
    var oudeCode = app.code;
    app.code = code;
    app.naam = el('a-naam').value.trim();
    app.beschrijving = el('a-beschrijving').value.trim();
    app.eigenaar_business = el('a-eigenaar-business').value.trim();
    app.eigenaar_technisch = el('a-eigenaar-technisch').value.trim();
    app.soort = el('a-soort').value;
    app.csir_dossier = { bestand: el('a-csir-bestand').value.trim(),
      vingerafdruk: el('a-csir-vingerafdruk').value.trim() };
    app.reviewdatum = el('a-reviewdatum').value;
    app.notities = el('a-notities').value.trim();
    if (oudeCode && oudeCode !== code) {
      dossier.processen.forEach(function (proces) {
        proces.applicaties = (proces.applicaties || []).map(function (c) {
          return c === oudeCode ? code : c;
        });
      });
      dossier.component_edges.forEach(function (edge) {
        if (edge.to === oudeCode) edge.to = code;
      });
    }
    el('app-form').hidden = true;
    bewerktApp = null;
    bewaar();
  }

  function verwijderApp(code) {
    if (!window.confirm('Applicatie ' + code + ' verwijderen? De koppelingen met processen en ' +
      'componenten verdwijnen mee.')) return;
    dossier.applicaties = dossier.applicaties.filter(function (a) { return a.code !== code; });
    dossier.processen.forEach(function (proces) {
      proces.applicaties = (proces.applicaties || []).filter(function (c) { return c !== code; });
    });
    dossier.component_edges = dossier.component_edges.filter(function (edge) {
      return edge.to !== code;
    });
    bewaar();
  }

  // ── BIA en BIV ────────────────────────────────────────────────────────────

  function vulProcesKeuze(keuze, huidig) {
    leegMaken(keuze);
    keuze.appendChild(maak('option', 'kies een proces', { value: '' }));
    dossier.processen.forEach(function (proces) {
      keuze.appendChild(maak('option', proces.code + ' · ' + (proces.naam || ''),
        { value: proces.code }));
    });
    keuze.value = huidig && procesVan(huidig) ? huidig : '';
  }

  function bouwVragen() {
    var doel = leegMaken(el('bia-vragen'));
    BRON.vragen.forEach(function (vraag) {
      var kaart = maak('div', null, { 'class': 'kaart', 'data-vraag': vraag.id });
      kaart.appendChild(maak('h2', vraag.id.toUpperCase() + ' · ' + vraag.vraag));
      if (vraag.toelichting) {
        var uitleg = maak('details');
        uitleg.appendChild(maak('summary', 'Elementen van de vraag'));
        uitleg.appendChild(maak('p', vraag.toelichting, { 'class': 'klein toelichting' }));
        kaart.appendChild(uitleg);
      }
      var label = maak('label', 'Antwoord');
      var keuze = maak('select', null, { 'data-score': vraag.id });
      keuze.appendChild(maak('option', 'nog niet beantwoord', { value: '' }));
      vraag.antwoorden.forEach(function (antwoord) {
        keuze.appendChild(maak('option', antwoord.score + ' · ' + antwoord.label,
          { value: antwoord.score }));
      });
      keuze.addEventListener('change', function () { leesBia(); });
      label.appendChild(keuze);
      kaart.appendChild(label);
      kaart.appendChild(maak('p', '', { 'class': 'klein', 'data-info': vraag.id }));
      var onderbouwing = maak('label', 'Onderbouwing', { 'class': 'breed' });
      var veld = maak('textarea', null, { rows: '2', 'data-onderbouwing': vraag.id });
      veld.addEventListener('change', function () { leesBia(); });
      onderbouwing.appendChild(veld);
      kaart.appendChild(onderbouwing);
      doel.appendChild(kaart);
    });
  }

  function tekenBia() {
    vulProcesKeuze(el('bia-proces'), gekozenProces);
    var proces = gekozenProces ? procesVan(gekozenProces) : null;
    var antwoorden = proces ? (proces.bia || {}) : {};

    BRON.vragen.forEach(function (vraag) {
      var keuze = document.querySelector('[data-score="' + vraag.id + '"]');
      var info = document.querySelector('[data-info="' + vraag.id + '"]');
      var onderbouwing = document.querySelector('[data-onderbouwing="' + vraag.id + '"]');
      var score = antwoorden[vraag.id];
      keuze.value = (score === null || score === undefined) ? '' : String(score);
      keuze.disabled = !proces;
      onderbouwing.disabled = !proces;
      onderbouwing.value = (proces && (proces.bia.onderbouwing || {})[vraag.id]) || '';
      var gekozenAntwoord = null;
      vraag.antwoorden.forEach(function (a) { if (a.score === score) gekozenAntwoord = a; });
      info.textContent = gekozenAntwoord ? gekozenAntwoord.info : '';
    });

    var scores = reken.bia(antwoorden);
    el('bia-b').textContent = scores.B === null ? '-' : String(scores.B);
    el('bia-i').textContent = scores.I === null ? '-' : String(scores.I);
    el('bia-v').textContent = scores.V === null ? '-' : String(scores.V);
    el('bia-klasse').textContent = scores.proces === null ? 'nog niet bepaald' :
      scores.proces + ' · ' + reken.label_van_score(BRON, scores.proces);
    ['rto', 'rpo', 'wrt', 'mtpd'].forEach(function (parameter) {
      var vraag = null;
      BRON.vragen.forEach(function (v) { if (v.parameter === parameter) vraag = v; });
      var label = reken.parameterlabel(BRON, parameter, antwoorden[vraag.id]);
      el('bia-' + parameter).textContent = label || '-';
    });

    var rto = proces ? proces.rto_rpo : { rto: '', rto_eenheid: '', rpo: '', rpo_eenheid: '', toelichting: '' };
    el('rto-waarde').value = rto.rto || '';
    el('rto-eenheid').value = rto.rto_eenheid || '';
    el('rpo-waarde').value = rto.rpo || '';
    el('rpo-eenheid').value = rto.rpo_eenheid || '';
    el('rto-rpo-toelichting').value = rto.toelichting || '';
    el('bia-interviewer').value = proces ? (proces.bia.interviewer || '') : '';
    el('bia-interviewdatum').value = proces ? (proces.bia.interviewdatum || '') : '';
    el('bia-beschrijving').value = proces ? (proces.bia.beschrijving || '') : '';
    el('bia-keten').value = proces ? (proces.bia.ketenafhankelijkheden || '') : '';
    el('bia-afwijking-eigenaar').value = proces ? (proces.bia.afwijking_eigenaar || '') : '';
    el('bia-notities').value = proces ? (proces.bia.notities || '') : '';
  }

  function leesBia() {
    if (!gekozenProces) return;
    var proces = procesVan(gekozenProces);
    if (!proces) return;
    BRON.vragen.forEach(function (vraag) {
      proces.bia[vraag.id] = scoreUit(document.querySelector('[data-score="' + vraag.id + '"]'));
      proces.bia.onderbouwing[vraag.id] =
        document.querySelector('[data-onderbouwing="' + vraag.id + '"]').value.trim();
    });
    proces.rto_rpo = {
      rto: el('rto-waarde').value.trim(), rto_eenheid: el('rto-eenheid').value.trim(),
      rpo: el('rpo-waarde').value.trim(), rpo_eenheid: el('rpo-eenheid').value.trim(),
      toelichting: el('rto-rpo-toelichting').value.trim()
    };
    proces.bia.interviewer = el('bia-interviewer').value.trim();
    proces.bia.interviewdatum = el('bia-interviewdatum').value;
    proces.bia.beschrijving = el('bia-beschrijving').value.trim();
    proces.bia.ketenafhankelijkheden = el('bia-keten').value.trim();
    proces.bia.afwijking_eigenaar = el('bia-afwijking-eigenaar').value.trim();
    proces.bia.notities = el('bia-notities').value.trim();
    bewaar();
  }

  function tekenParametertabel() {
    var rijen = BRON.parametertabel.map(function (r) {
      return rij([r.klasse, r.mtpd, r.rto, r.wrt, r.rpo]);
    });
    tabel(el('tabel-parameters'), ['Klasse', 'MTPD / MTD', 'RTO', 'WRT', 'RPO'], rijen);
  }

  // ── Businesscontext ───────────────────────────────────────────────────────

  function tekenContext() {
    vulProcesKeuze(el('context-proces'), gekozenContext);
    var proces = gekozenContext ? procesVan(gekozenContext) : null;
    var context = proces ? proces.context : leegContext();
    alle('[data-context]').forEach(function (veld) {
      veld.value = context[veld.getAttribute('data-context')] || '';
      veld.disabled = !proces;
    });
    el('context-persoonsgegevens').checked = !!context.persoonsgegevens;
    el('context-bijzonder').checked = !!context.bijzondere_persoonsgegevens;
    el('context-reviewdatum').value = context.reviewdatum || '';
    el('context-notities').value = context.notities || '';
    el('context-persoonsgegevens').disabled = !proces;
    el('context-bijzonder').disabled = !proces;
    el('context-reviewdatum').disabled = !proces;
    el('context-notities').disabled = !proces;
  }

  function leesContext() {
    if (!gekozenContext) return;
    var proces = procesVan(gekozenContext);
    if (!proces) return;
    alle('[data-context]').forEach(function (veld) {
      proces.context[veld.getAttribute('data-context')] = veld.value.trim();
    });
    proces.context.persoonsgegevens = el('context-persoonsgegevens').checked;
    proces.context.bijzondere_persoonsgegevens = el('context-bijzonder').checked;
    proces.context.reviewdatum = el('context-reviewdatum').value;
    proces.context.notities = el('context-notities').value.trim();
    bewaar();
  }

  // ── Blast radius ──────────────────────────────────────────────────────────

  function leesCsv(tekst) {
    var regels = tekst.replace(/\r\n/g, '\n').replace(/\r/g, '\n').split('\n')
      .filter(function (r) { return r.trim() !== ''; });
    if (!regels.length) return [];
    var koppen = splitsCsvRegel(regels[0]);
    return regels.slice(1).map(function (regel) {
      var cellen = splitsCsvRegel(regel);
      var uit = {};
      koppen.forEach(function (kop, i) { uit[kop.trim()] = (cellen[i] || '').trim(); });
      return uit;
    });
  }

  function splitsCsvRegel(regel) {
    var uit = [], huidig = '', inAanhaling = false;
    for (var i = 0; i < regel.length; i++) {
      var teken = regel[i];
      if (inAanhaling) {
        if (teken === '"' && regel[i + 1] === '"') { huidig += '"'; i++; }
        else if (teken === '"') inAanhaling = false;
        else huidig += teken;
      } else if (teken === '"') inAanhaling = true;
      else if (teken === ',') { uit.push(huidig); huidig = ''; }
      else huidig += teken;
    }
    uit.push(huidig);
    return uit;
  }

  function kritiekUit(waarde) {
    return BRON.keuzes.kritiek_waar.indexOf(String(waarde || '').trim().toLowerCase()) >= 0;
  }

  function landschapUitTekst(naam, tekst) {
    if (/\.csv$/i.test(naam)) {
      var nodes = {}, edges = [];
      leesCsv(tekst).forEach(function (regel) {
        var van = (regel.from || '').trim(), naar = (regel.to || '').trim();
        if (!van || !naar) return;
        [[van, regel.from_label, regel.from_type || 'ci', kritiekUit(regel.from_kritiek)],
          [naar, regel.to_label, regel.to_type || 'proces', kritiekUit(regel.to_kritiek)]]
          .forEach(function (deel) {
            if (!nodes[deel[0]]) {
              nodes[deel[0]] = { id: deel[0], label: (deel[1] || deel[0]).trim(),
                type: String(deel[2]).trim(), kritiek: deel[3] };
            } else if (deel[3]) nodes[deel[0]].kritiek = true;
          });
        edges.push({ from: van, to: naar,
          relatie: (regel.relatie || BRON.keuzes.relatie_standaard).trim() });
      });
      return { nodes: Object.keys(nodes).map(function (id) { return nodes[id]; }), edges: edges };
    }
    var data = JSON.parse(tekst);
    return {
      nodes: (data.nodes || []).map(function (n) {
        return { id: n.id, label: n.label || n.id, type: n.type, kritiek: !!n.kritiek };
      }),
      edges: (data.edges || []).map(function (e) {
        return { from: e.from, to: e.to, relatie: e.relatie || BRON.keuzes.relatie_standaard };
      })
    };
  }

  function importeerLandschap(naam, tekst) {
    var land;
    try {
      land = landschapUitTekst(naam, tekst);
    } catch (fout) {
      el('landschap-melding').textContent = 'Dit bestand is niet te lezen als landschap: ' + fout.message;
      return;
    }
    var telling = { proces_herkend: 0, proces_nieuw: 0, app_herkend: 0, app_nieuw: 0,
      component: 0, edge: 0, overgeslagen: 0 };
    var naarCode = {};

    function zoekOpLabel(lijst, label, veld) {
      var gevonden = null;
      lijst.forEach(function (item) {
        if (String(item[veld] || '').trim().toLowerCase() === String(label || '').trim().toLowerCase()) {
          gevonden = item;
        }
      });
      return gevonden;
    }

    land.nodes.forEach(function (node) {
      if (node.type === 'proces') {
        var proces = procesVan(node.id) || zoekOpLabel(dossier.processen, node.label, 'naam');
        if (proces) { telling.proces_herkend++; if (node.kritiek) proces.kritiek = true; }
        else {
          proces = leegProces(node.id);
          proces.naam = node.label;
          proces.kritiek = !!node.kritiek;
          dossier.processen.push(proces);
          telling.proces_nieuw++;
        }
        naarCode[node.id] = proces.code;
      } else if (node.type === 'app') {
        var app = appVan(node.id) || zoekOpLabel(dossier.applicaties, node.label, 'naam');
        if (app) telling.app_herkend++;
        else {
          app = { code: node.id, naam: node.label, beschrijving: '', eigenaar_business: '',
            eigenaar_technisch: '', soort: BRON.keuzes.soort_applicatie[0],
            csir_dossier: { bestand: '', vingerafdruk: '' }, notities: '', reviewdatum: '' };
          dossier.applicaties.push(app);
          telling.app_nieuw++;
        }
        naarCode[node.id] = app.code;
      } else if (node.type === 'ci') {
        var bestaand = null;
        dossier.componenten.forEach(function (c) { if (c.id === node.id) bestaand = c; });
        if (bestaand) { if (node.kritiek) bestaand.kritiek = true; }
        else {
          dossier.componenten.push({ id: node.id, label: node.label, kritiek: !!node.kritiek });
          telling.component++;
        }
        naarCode[node.id] = node.id;
      } else {
        telling.overgeslagen++;
      }
    });

    var typePerId = {};
    land.nodes.forEach(function (n) { typePerId[n.id] = n.type; });

    land.edges.forEach(function (edge) {
      var vanType = typePerId[edge.from], naarType = typePerId[edge.to];
      var van = naarCode[edge.from], naar = naarCode[edge.to];
      if (!van || !naar) { telling.overgeslagen++; return; }
      if (vanType === 'app' && naarType === 'proces') {
        var proces = procesVan(naar);
        if (!proces) { telling.overgeslagen++; return; }
        proces.applicaties = proces.applicaties || [];
        if (proces.applicaties.indexOf(van) < 0) { proces.applicaties.push(van); telling.edge++; }
      } else if (vanType === 'ci' && (naarType === 'app' || naarType === 'ci')) {
        var dubbel = dossier.component_edges.some(function (e) {
          return e.from === van && e.to === naar;
        });
        if (!dubbel) {
          dossier.component_edges.push({ from: van, to: naar,
            relatie: edge.relatie || BRON.keuzes.relatie_standaard });
          telling.edge++;
        }
      } else {
        telling.overgeslagen++;
      }
    });

    dossier.landschap_bron = { bestand: naam, geimporteerd: vandaag() };
    el('landschap-melding').textContent = telling.proces_herkend + ' processen herkend, ' +
      telling.proces_nieuw + ' aangemaakt, ' + telling.app_herkend + ' applicaties herkend, ' +
      telling.app_nieuw + ' aangemaakt, ' + telling.component + ' componenten, ' +
      telling.edge + ' relaties, ' + telling.overgeslagen + ' overgeslagen.';
    bewaar();
  }

  function tekenComponenten() {
    var rijen = dossier.componenten.map(function (component) {
      var uitgaandeEdges = dossier.component_edges.filter(function (e) {
        return e.from === component.id;
      }).map(function (e) { return e.to; });
      var vink = maak('input', null, { type: 'checkbox' });
      vink.checked = !!component.kritiek;
      vink.addEventListener('change', function () {
        component.kritiek = vink.checked;
        bewaar();
      });
      var vinkCel = maak('td');
      vinkCel.appendChild(vink);
      var knopCel = maak('td');
      var verwijder = maak('button', 'Verwijderen', { type: 'button', 'class': 'verwijder' });
      verwijder.addEventListener('click', function () {
        dossier.componenten = dossier.componenten.filter(function (c) { return c.id !== component.id; });
        dossier.component_edges = dossier.component_edges.filter(function (e) {
          return e.from !== component.id && e.to !== component.id;
        });
        bewaar();
      });
      knopCel.appendChild(verwijder);
      return rij([component.id, component.label, vinkCel, uitgaandeEdges.join(', ') || '-', knopCel],
        { 'data-component': component.id });
    });
    tabel(el('tabel-componenten'), ['Id', 'Label', 'Kritiek', 'Ondersteunt', ''], rijen);
  }

  function tekenBlast() {
    var land = reken.landschap(dossier);
    var rijen = reken.ranglijst(land).map(function (item) {
      var node = null;
      land.nodes.forEach(function (n) { if (n.id === item.node_id) node = n; });
      var kritiekCel = maak('td', item.kritieke.length, { 'class': 'kritieke' });
      var procesCel = maak('td', item.processen.length, { 'class': 'processen' });
      var geraaktCel = maak('td', item.geraakt.length, { 'class': 'geraakt' });
      var namen = item.kritieke.map(function (id) {
        var gevonden = id;
        land.nodes.forEach(function (n) { if (n.id === id) gevonden = n.label; });
        return gevonden;
      }).join(', ');
      return rij([node.label, node.type, kritiekCel, procesCel, geraaktCel, namen || '-'],
        { 'data-blast': item.node_id });
    });
    tabel(el('tabel-blast'),
      ['Wat', 'Soort', 'Kritieke processen', 'Processen', 'Geraakt', 'Welke kritieke processen'], rijen);

    var spof = leegMaken(el('blast-spof'));
    var single = reken.single_points(land);
    if (!single.length) {
      spof.appendChild(maak('li', 'Geen kritiek proces steunt op maar een enkele applicatie.'));
    }
    single.forEach(function (id) {
      var label = id;
      land.nodes.forEach(function (n) { if (n.id === id) label = n.label; });
      spof.appendChild(maak('li', label + ' (' + reken.dekking(land, id) + ' dragende applicatie)',
        { 'data-spof': id }));
    });

    var cyclus = leegMaken(el('blast-cyclus'));
    reken.cyclus_waarschuwingen(land).forEach(function (tekst) {
      cyclus.appendChild(maak('p', tekst, { 'class': 'waarschuwing' }));
    });
    var waarschuwingen = leegMaken(el('blast-waarschuwingen'));
    land.waarschuwingen.forEach(function (tekst) {
      waarschuwingen.appendChild(maak('p', tekst, { 'class': 'waarschuwing' }));
    });

    tekenGraaf(land);
  }

  function tekenGraaf(land) {
    var svg = leegMaken(el('blast-graaf'));
    var nodes = land.nodes;
    var melding = el('graaf-melding');
    if (nodes.length > BRON.graaf_maximum) {
      var houden = {};
      reken.dragende_nodes(land).forEach(function (id) { houden[id] = true; });
      nodes = nodes.filter(function (n) { return houden[n.id]; });
      melding.textContent = 'Het landschap heeft ' + land.nodes.length + ' nodes, meer dan ' +
        BRON.graaf_maximum + '. De tekening toont alleen wat een kritiek proces draagt; de tabel ' +
        'hierboven is volledig.';
    } else if (!nodes.length) {
      melding.textContent = 'Nog geen processen, applicaties of componenten om te tekenen.';
      return;
    } else {
      melding.textContent = '';
    }

    var zichtbaar = {};
    nodes.forEach(function (n) { zichtbaar[n.id] = true; });
    var edges = land.edges.filter(function (e) { return zichtbaar[e.from] && zichtbaar[e.to]; });

    var kolommen = BRON.keuzes.nodetypes;
    var breedte = 150, hoogte = 22, tussenX = 240, tussenY = 30, marge = 60;
    var perKolom = {};
    kolommen.forEach(function (type) {
      perKolom[type] = nodes.filter(function (n) { return n.type === type; })
        .sort(function (a, b) { return a.id < b.id ? -1 : a.id > b.id ? 1 : 0; });
    });
    var plaats = {};
    kolommen.forEach(function (type, kolom) {
      perKolom[type].forEach(function (node, i) {
        plaats[node.id] = { x: 10 + kolom * tussenX, y: marge + i * tussenY };
      });
    });
    var maxRijen = Math.max(1, perKolom.ci.length, perKolom.app.length, perKolom.proces.length);
    var svgHoogte = marge + maxRijen * tussenY + 10;
    var svgBreedte = 10 + (kolommen.length - 1) * tussenX + breedte + 10;
    svg.setAttribute('viewBox', '0 0 ' + svgBreedte + ' ' + svgHoogte);
    svg.setAttribute('height', svgHoogte);

    function svgEl(tag, attributen) {
      var knoop = document.createElementNS('http://www.w3.org/2000/svg', tag);
      Object.keys(attributen).forEach(function (naam) {
        knoop.setAttribute(naam, String(attributen[naam]));
      });
      return knoop;
    }

    kolommen.forEach(function (type, kolom) {
      var kop = svgEl('text', { x: 10 + kolom * tussenX, y: 30, 'class': 'kop' });
      kop.textContent = { ci: 'Componenten', app: 'Applicaties', proces: 'Processen' }[type];
      svg.appendChild(kop);
    });

    edges.forEach(function (edge) {
      var van = plaats[edge.from], naar = plaats[edge.to];
      var vanType = null, naarType = null;
      nodes.forEach(function (n) {
        if (n.id === edge.from) vanType = n.type;
        if (n.id === edge.to) naarType = n.type;
      });
      var vorm;
      if (vanType === naarType) {
        // Binnen een kolom: linksom buiten de kolom, anders loopt de lijn dwars door de nodes.
        var x = van.x, y1 = van.y + hoogte / 2, y2 = naar.y + hoogte / 2;
        vorm = svgEl('path', { 'class': 'edge',
          d: 'M ' + x + ',' + y1 + ' C ' + (x - 40) + ',' + y1 + ' ' + (x - 40) + ',' + y2 +
             ' ' + naar.x + ',' + y2,
          'data-edge': edge.from + '|' + edge.to });
      } else {
        vorm = svgEl('line', { 'class': 'edge', x1: van.x + breedte, y1: van.y + hoogte / 2,
          x2: naar.x, y2: naar.y + hoogte / 2, 'data-edge': edge.from + '|' + edge.to });
      }
      svg.appendChild(vorm);
    });

    var geraakt = {};
    if (gekozenNode && zichtbaar[gekozenNode]) {
      reken.bereik(land, gekozenNode).geraakt.forEach(function (id) { geraakt[id] = true; });
    }

    nodes.forEach(function (node) {
      var punt = plaats[node.id];
      var klasse = 'node' + (node.kritiek ? ' kritiek' : '') +
        (node.id === gekozenNode ? ' gekozen' : '') + (geraakt[node.id] ? ' geraakt' : '');
      var groep = svgEl('g', { 'class': klasse, 'data-node': node.id, tabindex: '0', role: 'button' });
      groep.appendChild(svgEl('rect', { x: punt.x, y: punt.y, width: breedte, height: hoogte, rx: 3 }));
      var tekst = svgEl('text', { x: punt.x + 6, y: punt.y + 15 });
      tekst.textContent = node.label.length > 26 ? node.label.slice(0, 25) + '...' : node.label;
      groep.appendChild(tekst);
      groep.appendChild(svgEl('title', {})).textContent = node.label;
      groep.addEventListener('click', function () {
        gekozenNode = gekozenNode === node.id ? null : node.id;
        tekenGraaf(land);
      });
      svg.appendChild(groep);
    });

    if (gekozenNode) {
      alle('[data-edge]', svg).forEach(function (vorm) {
        var delen = vorm.getAttribute('data-edge').split('|');
        if ((delen[0] === gekozenNode || geraakt[delen[0]]) && geraakt[delen[1]]) {
          vorm.setAttribute('class', 'edge geraakt');
        }
      });
    }
  }

  // ── Dashboard ─────────────────────────────────────────────────────────────

  function teller(doel, sleutel, waarde, naam) {
    var cel = maak('div', null, { 'class': 'cel' });
    cel.appendChild(maak('span', waarde, { 'class': 'getal', 'data-teller': sleutel }));
    cel.appendChild(maak('span', naam, { 'class': 'naam' }));
    doel.appendChild(cel);
  }

  function tekenDashboard() {
    var doel = leegMaken(el('dashboard-inhoud'));
    var stand = reken.dashboard(BRON, dossier, vandaag());

    var raster = maak('div', null, { 'class': 'tellerraster' });
    [['totaal', 'Processen'], ['kritiek', 'Kritiek'], ['compleet', 'Compleet'],
      ['aandacht', 'Aandacht (1 tot 3)'], ['onvolledig', 'Onvolledig (4 of meer)'],
      ['hoog_risico', 'Hoog risico']].forEach(function (paar) {
      teller(raster, paar[0], stand[paar[0]], paar[1]);
    });
    doel.appendChild(raster);

    var verdelingKaart = maak('div', null, { 'class': 'kaart' });
    verdelingKaart.appendChild(maak('h2', 'Verdeling per dimensie'));
    var verdelingTabel = maak('table', null, { 'class': 'uitkomst' });
    var koppen = ['Dimensie'].concat(BRON.schaal.map(function (s) { return s.score + ' ' + s.label; }))
      .concat(['niet beoordeeld']);
    var thead = maak('thead');
    thead.appendChild(rij(koppen, null, true));
    verdelingTabel.appendChild(thead);
    var tbody = maak('tbody');
    DIMENSIES.forEach(function (dim) {
      var cellen = [maak('th', { B: 'Beschikbaarheid', I: 'Integriteit', V: 'Vertrouwelijkheid' }[dim],
        { scope: 'row' })];
      ['1', '2', '3', '4', '5', 'leeg'].forEach(function (sleutel) {
        cellen.push(maak('td', stand.verdeling[dim][sleutel],
          { 'data-teller': 'verdeling.' + dim + '.' + sleutel }));
      });
      tbody.appendChild(rij(cellen));
    });
    verdelingTabel.appendChild(tbody);
    verdelingKaart.appendChild(verdelingTabel);

    DIMENSIES.forEach(function (dim) {
      if (!stand.top[dim].length) return;
      verdelingKaart.appendChild(maak('h3', 'Zwaarst op ' +
        { B: 'beschikbaarheid', I: 'integriteit', V: 'vertrouwelijkheid' }[dim]));
      var lijst = maak('ul');
      stand.top[dim].forEach(function (item) {
        lijst.appendChild(maak('li', item.code + ' · ' + item.naam + ' — ' + item.score +
          ' ' + reken.label_van_score(BRON, item.score)));
      });
      verdelingKaart.appendChild(lijst);
    });
    doel.appendChild(verdelingKaart);

    var dekkingKaart = maak('div', null, { 'class': 'kaart' });
    dekkingKaart.appendChild(maak('h2', 'Dekking en review'));
    var dekkingRijen = [];
    [['bia', 'BIA ingevuld'], ['rto_rpo', 'RTO en RPO bepaald'], ['context', 'Businesscontext'],
      ['applicaties', 'Applicaties gekoppeld']].forEach(function (paar) {
      var item = stand.dekking[paar[0]];
      dekkingRijen.push(rij([paar[1],
        maak('td', item.done, { 'data-teller': 'dekking.' + paar[0] + '.done' }),
        maak('td', item.total, { 'data-teller': 'dekking.' + paar[0] + '.total' }),
        maak('td', item.pct + '%', { 'data-teller': 'dekking.' + paar[0] + '.pct' })]));
    });
    [['processen', 'Procesbeoordeling op tijd'], ['bia', 'BIA-interview op tijd'],
      ['context', 'Businesscontext op tijd'], ['applicaties', 'Applicatiereview op tijd']]
      .forEach(function (paar) {
        var item = stand.review[paar[0]];
        dekkingRijen.push(rij([paar[1],
          maak('td', item.on_time, { 'data-teller': 'review.' + paar[0] + '.on_time' }),
          maak('td', item.total, { 'data-teller': 'review.' + paar[0] + '.total' }),
          maak('td', item.pct + '%', { 'data-teller': 'review.' + paar[0] + '.pct' })]));
      });
    var dekkingTabel = maak('table', null, { 'class': 'uitkomst' });
    tabel(dekkingTabel, ['Wat', 'Op orde', 'Totaal', 'Percentage'], dekkingRijen);
    dekkingKaart.appendChild(dekkingTabel);
    var privacy = maak('p', null, { 'class': 'klein' });
    privacy.appendChild(document.createTextNode('Processen met persoonsgegevens: '));
    privacy.appendChild(maak('strong', stand.privacy.persoonsgegevens,
      { 'data-teller': 'privacy.persoonsgegevens' }));
    privacy.appendChild(document.createTextNode(', waarvan met bijzondere persoonsgegevens: '));
    privacy.appendChild(maak('strong', stand.privacy.bijzonder, { 'data-teller': 'privacy.bijzonder' }));
    privacy.appendChild(document.createTextNode('.'));
    dekkingKaart.appendChild(privacy);
    doel.appendChild(dekkingKaart);

    var prioKaart = maak('div', null, { 'class': 'kaart' });
    prioKaart.appendChild(maak('h2', 'Wat vraagt als eerste aandacht'));
    var prioTabel = maak('table', null, { 'class': 'regels', id: 'prioriteiten' });
    tabel(prioTabel, ['Code', 'Naam', 'Prioriteit', 'Reden', 'Ontbrekende velden'],
      stand.prioriteiten.map(function (item) {
        var niveau = maak('td', null, { 'class': 'niveau' });
        niveau.appendChild(vlag(item.prioriteit, 'prio-' + item.prioriteit));
        return rij([item.code, item.naam, niveau, item.reden, item.ontbrekend.join(', ')],
          { 'data-prioriteit': item.code });
      }));
    prioKaart.appendChild(prioTabel);
    doel.appendChild(prioKaart);

    var kritiekKaart = maak('div', null, { 'class': 'kaart' });
    kritiekKaart.appendChild(maak('h2', 'Kritieke processen'));
    var kritiekTabel = maak('table', null, { 'class': 'regels', id: 'kritiek-lijst' });
    tabel(kritiekTabel, ['Code', 'Naam', 'B', 'I', 'V', 'Klasse', 'BIA', 'RTO/RPO', 'Ontbrekend'],
      stand.kritiek_lijst.map(function (item) {
        return rij([item.code, item.naam,
          item.B === null ? '-' : item.B, item.I === null ? '-' : item.I,
          item.V === null ? '-' : item.V,
          item.klasse === null ? '-' : item.klasse + ' · ' + reken.label_van_score(BRON, item.klasse),
          item.heeft_bia ? 'ja' : 'nee', item.heeft_rto_rpo ? 'ja' : 'nee',
          item.ontbrekend.join(', ') || '-'], { 'data-kritiek': item.code });
      }));
    kritiekKaart.appendChild(kritiekTabel);
    doel.appendChild(kritiekKaart);
  }

  // ── Uitdraai ──────────────────────────────────────────────────────────────

  function veldTabel(doel, paren) {
    var t = maak('table');
    var tbody = maak('tbody');
    paren.forEach(function (paar) {
      var tr = maak('tr');
      tr.appendChild(maak('th', paar[0], { scope: 'row' }));
      var td = maak('td');
      if (leeg(paar[1])) {
        td.appendChild(maak('span', 'niet ingevuld', { 'class': 'leeg' }));
      } else {
        td.textContent = String(paar[1]);
      }
      tr.appendChild(td);
      tbody.appendChild(tr);
    });
    t.appendChild(tbody);
    doel.appendChild(t);
  }

  function tekenUitdraai() {
    var doel = leegMaken(el('uitdraai-inhoud'));
    var stand = reken.dashboard(BRON, dossier, vandaag());
    var land = reken.landschap(dossier);

    doel.appendChild(maak('h2', '1 Organisatie'));
    veldTabel(doel, [['Organisatie', dossier.organisatie.naam],
      ['Peildatum', dossier.organisatie.peildatum], ['Bijgewerkt', dossier.bijgewerkt],
      ['Processen', dossier.processen.length], ['Applicaties', dossier.applicaties.length],
      ['Componenten', dossier.componenten.length]]);

    doel.appendChild(maak('h2', '2 Dashboard'));
    veldTabel(doel, [['Processen', stand.totaal], ['Kritiek', stand.kritiek],
      ['Compleet', stand.compleet], ['Aandacht', stand.aandacht], ['Onvolledig', stand.onvolledig],
      ['Hoog risico', stand.hoog_risico],
      ['BIA ingevuld', stand.dekking.bia.done + ' van ' + stand.dekking.bia.total +
        ' (' + stand.dekking.bia.pct + '%)'],
      ['RTO en RPO', stand.dekking.rto_rpo.done + ' van ' + stand.dekking.rto_rpo.total +
        ' (' + stand.dekking.rto_rpo.pct + '%)'],
      ['Businesscontext', stand.dekking.context.done + ' van ' + stand.dekking.context.total +
        ' (' + stand.dekking.context.pct + '%)'],
      ['Persoonsgegevens', stand.privacy.persoonsgegevens],
      ['Bijzondere persoonsgegevens', stand.privacy.bijzonder]]);
    if (stand.prioriteiten.length) {
      var prio = maak('table');
      tabel(prio, ['Code', 'Naam', 'Prioriteit', 'Reden', 'Ontbrekende velden'],
        stand.prioriteiten.map(function (item) {
          return rij([item.code, item.naam, item.prioriteit, item.reden, item.ontbrekend.join(', ')]);
        }));
      doel.appendChild(prio);
    }

    doel.appendChild(maak('h2', '3 Kroonjuwelen'));
    var juwelen = reken.kroonjuwelen(BRON, dossier);
    if (!juwelen.length) {
      doel.appendChild(maak('p', 'Nog geen proces als kritiek aangemerkt.', { 'class': 'leeg' }));
    } else {
      var juwelenTabel = maak('table');
      tabel(juwelenTabel, ['#', 'Kroonjuweel', 'Eigenaar', 'Klasse', 'Systemen eronder'],
        juwelen.map(function (item, i) {
          return rij([i + 1, item.naam || item.code, item.eigenaar,
            item.klasse === null ? '-' : item.klasse + ' · ' + item.klasse_label,
            item.systemen.join(', ') || '-']);
        }));
      doel.appendChild(juwelenTabel);
      if (juwelen.length > 10) {
        doel.appendChild(maak('p', 'De risicoanalyse langs aanvalspaden vraagt in stap 1 om maximaal ' +
          'tien kroonjuwelen; kies er tien uit deze lijst.', { 'class': 'klein' }));
      }
    }

    doel.appendChild(maak('h2', '4 Processen'));
    var procesTabel = maak('table');
    tabel(procesTabel, ['Code', 'Naam', 'Eigenaar', 'Afdeling', 'Kritiek', 'B', 'I', 'V', 'Klasse',
      'RTO', 'RPO', 'Laatste beoordeling'],
      dossier.processen.map(function (proces) {
        var scores = reken.bia(proces.bia);
        return rij([proces.code, proces.naam, proces.eigenaar, proces.afdeling,
          proces.kritiek ? 'Ja' : 'Nee',
          scores.B === null ? '-' : scores.B, scores.I === null ? '-' : scores.I,
          scores.V === null ? '-' : scores.V,
          scores.proces === null ? '-' : scores.proces + ' · ' +
            reken.label_van_score(BRON, scores.proces),
          reken.parameterlabel(BRON, 'rto', proces.bia.b1) || '-',
          reken.parameterlabel(BRON, 'rpo', proces.bia.b2) || '-',
          proces.laatste_beoordeling || '-']);
      }));
    doel.appendChild(procesTabel);

    doel.appendChild(maak('h2', '5 BIA en BIV per proces'));
    dossier.processen.forEach(function (proces) {
      doel.appendChild(maak('h3', proces.code + ' · ' + (proces.naam || '')));
      var paren = BRON.vragen.map(function (vraag) {
        var score = proces.bia[vraag.id];
        var label = score === null || score === undefined ? '' :
          score + ' · ' + reken.label_van_score(BRON, score);
        var onderbouwing = (proces.bia.onderbouwing || {})[vraag.id];
        return [vraag.id.toUpperCase() + ' ' + vraag.vraag,
          label + (onderbouwing ? ' — ' + onderbouwing : '')];
      });
      paren.push(['Interviewer', proces.bia.interviewer]);
      paren.push(['Interviewdatum', proces.bia.interviewdatum]);
      paren.push(['Ketenafhankelijkheden', proces.bia.ketenafhankelijkheden]);
      paren.push(['RTO en RPO met de hand', [proces.rto_rpo.rto, proces.rto_rpo.rto_eenheid,
        proces.rto_rpo.rpo, proces.rto_rpo.rpo_eenheid].filter(Boolean).join(' ')]);
      veldTabel(doel, paren);
    });

    doel.appendChild(maak('h2', '6 Businesscontext per proces'));
    dossier.processen.forEach(function (proces) {
      doel.appendChild(maak('h3', proces.code + ' · ' + (proces.naam || '')));
      var paren = CONTEXT_TEKSTVELDEN.map(function (veld) {
        return [veld.charAt(0).toUpperCase() + veld.slice(1).replace(/_/g, ' '), proces.context[veld]];
      });
      paren.push(['Persoonsgegevens', proces.context.persoonsgegevens ? 'ja' : 'nee']);
      paren.push(['Bijzondere persoonsgegevens', proces.context.bijzondere_persoonsgegevens ? 'ja' : 'nee']);
      veldTabel(doel, paren);
    });

    doel.appendChild(maak('h2', '7 Applicaties'));
    var appTabel = maak('table');
    tabel(appTabel, ['Code', 'Naam', 'Soort', 'Eigenaar (business)', 'Eigenaar (technisch)',
      'CSIR-dossier', 'Processen', 'Reviewdatum'],
      dossier.applicaties.map(function (app) {
        var processen = dossier.processen.filter(function (p) {
          return (p.applicaties || []).indexOf(app.code) >= 0;
        }).map(function (p) { return p.code; }).join(', ');
        var csir = (app.csir_dossier || {}).bestand || '';
        if (csir && (app.csir_dossier || {}).vingerafdruk) {
          csir += ' (' + app.csir_dossier.vingerafdruk + ')';
        }
        return rij([app.code, app.naam, app.soort || 'applicatie', app.eigenaar_business,
          app.eigenaar_technisch, csir || '-', processen || '-', app.reviewdatum || '-']);
      }));
    doel.appendChild(appTabel);

    doel.appendChild(maak('h2', '8 Blast radius'));
    var blastTabel = maak('table');
    tabel(blastTabel, ['Wat', 'Soort', 'Kritieke processen', 'Processen', 'Geraakt'],
      reken.ranglijst(land).map(function (item) {
        var node = null;
        land.nodes.forEach(function (n) { if (n.id === item.node_id) node = n; });
        return rij([node.label, node.type, item.kritieke.length, item.processen.length,
          item.geraakt.length]);
      }));
    doel.appendChild(blastTabel);
    var single = reken.single_points(land);
    doel.appendChild(maak('p', single.length ?
      'Kritieke processen zonder redundantie: ' + single.map(function (id) {
        var label = id;
        land.nodes.forEach(function (n) { if (n.id === id) label = n.label; });
        return label;
      }).join(', ') :
      'Geen kritiek proces steunt op maar een enkele applicatie.'));
    reken.cyclus_waarschuwingen(land).concat(land.waarschuwingen).forEach(function (tekst) {
      doel.appendChild(maak('p', tekst, { 'class': 'klein' }));
    });

    doel.appendChild(maak('h2', '9 Verantwoording'));
    veldTabel(doel, [['Bronversie', BRON.versie], ['Vingerafdruk van de bron', BRON.vingerafdruk],
      ['Herkomst van de vragen', BRON.bron.vragen], ['Herkomst van de regels', BRON.bron.regels],
      ['Herkomst van de blast radius', BRON.bron.blast_radius],
      ['Landschap geimporteerd uit', dossier.landschap_bron.bestand],
      ['Dossier bijgewerkt', dossier.bijgewerkt]]);
    if ((dossier.herkomst_ai || []).length) {
      doel.appendChild(maak('h3', 'Overgenomen uit de AI-hulp'));
      var herkomst = maak('table');
      tabel(herkomst, ['Opdracht', 'Leverancier', 'Model', 'Datum', 'Invoer (sha256)', 'Overgenomen', 'Samengevoegd', 'Overgeslagen'],
        dossier.herkomst_ai.map(function (h) {
          return rij([h.opdracht, h.leverancier, h.model, h.gemaakt, String(h.invoer_sha256 || '').slice(0, 12), h.overgenomen, h.samengevoegd, h.overgeslagen]);
        }));
      doel.appendChild(herkomst);
    }
  }


  // ── Voorstel uit de AI-hulp ───────────────────────────────────────────────
  // De AI-pagina schrijft nooit in het dossier. Hier legt de gebruiker het voorstel naast wat er staat
  // en kiest per regel; window.kern (uit ai/bron/kern.js) doet het vergelijken en toepassen.

  function laadVoorstel(tekst) {
    var data;
    try { data = JSON.parse(tekst); } catch (fout) { meldStatus('Dit bestand is geen leesbare JSON.', true); return; }
    if (!data || data.formaat !== 'procescheck-voorstel') { meldStatus('Dit is geen voorstel van de AI-hulp van procescheck.', true); return; }
    if (data.tool !== 'procescheck') { meldStatus('Dit voorstel hoort bij een andere tool (' + data.tool + ').', true); return; }
    if (['processen', 'applicaties', 'landschap'].indexOf(data.opdracht) < 0) { meldStatus('Onbekende opdracht: ' + data.opdracht, true); return; }
    if (data.tool_vingerafdruk && data.tool_vingerafdruk !== BRON.vingerafdruk) {
      meldStatus('Let op: dit voorstel is gemaakt met een andere versie van de tool; loop de regels na.', true);
    }
    voorstel = data;
    tekenVoorstel();
    alle('.scherm').forEach(function (scherm) { scherm.hidden = true; });
    el('scherm-voorstel').hidden = false;
  }

  function tekenVoorstel() {
    var vergelijking = window.kern.vergelijk(dossier, voorstel);
    el('voorstel-kop').textContent = 'Opdracht ' + voorstel.opdracht + ' · ' + voorstel.leverancier + ' (' + voorstel.model + ') · ' +
      voorstel.gemaakt + ' · invoer ' + ((voorstel.invoer || {}).naam || '') + ' (' + String((voorstel.invoer || {}).sha256 || '').slice(0, 12) + ')';
    var records = voorstel.items || voorstel.nodes || [];
    var kolommen = records.length ? Object.keys(records[0]).filter(function (k) { return k !== 'bronregel'; }) : [];
    var rijen = vergelijking.map(function (regel) {
      var item = regel.item;
      var statusCel = maak('td', null, { 'class': 'status' });
      statusCel.appendChild(vlag({ nieuw: 'nieuw', bestaand: 'bestaand', conflict: 'conflict', niet_in_bron: 'niet in bron' }[regel.status],
        { nieuw: 'klasse-5', bestaand: 'klasse-4', conflict: 'klasse-2', niet_in_bron: 'klasse-3' }[regel.status]));
      var keuze = maak('select', null, { 'data-keuze': regel.sleutel });
      ['overnemen', 'overslaan'].concat(regel.status === 'bestaand' ? ['samenvoegen'] : []).forEach(function (k) {
        keuze.appendChild(maak('option', k, { value: k }));
      });
      keuze.value = window.kern.standaardkeuze(regel.status);
      if (keuze.value === 'samenvoegen' && regel.status !== 'bestaand') keuze.value = 'overnemen';
      var keuzeCel = maak('td'); keuzeCel.appendChild(keuze);
      var huidig = '';
      if (regel.huidig_code && (voorstel.opdracht === 'processen' || voorstel.opdracht === 'applicaties')) {
        var bestaand = (dossier[voorstel.opdracht] || []).filter(function (p) { return p.code === regel.huidig_code; })[0];
        huidig = bestaand ? bestaand.code + ' · ' + (bestaand.naam || '') : '';
      }
      var cellen = [statusCel];
      if ('type' in item || 'code' in item) {
        kolommen.forEach(function (k) { cellen.push(typeof item[k] === 'boolean' ? (item[k] ? 'ja' : 'nee') : (item[k] === undefined ? '' : item[k])); });
      } else {
        cellen.push(item.from + ' → ' + item.to); while (cellen.length < kolommen.length + 1) cellen.push('');
      }
      cellen.push(huidig, keuzeCel);
      return rij(cellen, { 'data-voorstel': regel.sleutel });
    });
    tabel(el('tabel-vergelijk'), ['Status'].concat(kolommen, ['Staat nu in het dossier', 'Keuze']), rijen);
    el('voorstel-onzeker').textContent = (voorstel.onzeker && voorstel.onzeker.length) ?
      'Het model wist niet zeker: ' + voorstel.onzeker.join(' · ') : '';
  }

  function zetAlleKeuzes(keuze) {
    alle('#tabel-vergelijk select[data-keuze]').forEach(function (select) {
      if (Array.prototype.some.call(select.options, function (o) { return o.value === keuze; })) select.value = keuze;
    });
  }

  function neemVoorstelOver() {
    var keuzes = {};
    alle('#tabel-vergelijk select[data-keuze]').forEach(function (select) { keuzes[select.getAttribute('data-keuze')] = select.value; });
    var uitkomst = window.kern.pas_toe(dossier, voorstel, keuzes);
    dossier = uitkomst.dossier;
    voorstel = null;
    bewaar();
    toonScherm({ processen: 'scherm-processen', applicaties: 'scherm-applicaties', landschap: 'scherm-blast' }[uitkomst.dossier.herkomst_ai[uitkomst.dossier.herkomst_ai.length - 1].opdracht]);
    meldStatus(uitkomst.telling.overgenomen + ' overgenomen, ' + uitkomst.telling.samengevoegd + ' samengevoegd, ' +
      uitkomst.telling.overgeslagen + ' overgeslagen.', false);
  }

  // ── Dossier opslaan, laden, wissen ────────────────────────────────────────

  function slaDossierOp() {
    dossier.bron_versie = BRON.versie;
    dossier.bron_sha256 = BRON.vingerafdruk;
    dossier.bijgewerkt = vandaag();
    var tekst = JSON.stringify(dossier, null, 1);
    var blob = new Blob([tekst], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = reken.bestandsnaam(dossier, vandaag());
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 0);
  }

  function laadDossier(tekst) {
    var data;
    try {
      data = JSON.parse(tekst);
    } catch (fout) {
      meldStatus('Dit bestand is geen leesbare JSON.', true);
      return;
    }
    if (!data || data.formaat !== 'procescheck-dossier') {
      meldStatus('Dit is geen procescheck-dossier.', true);
      return;
    }
    if (data.versie !== 1) {
      meldStatus('Dit dossier heeft versie ' + data.versie + '; deze pagina leest versie 1.', true);
      return;
    }
    dossier = vulAan(data);
    gekozenProces = null;
    gekozenContext = null;
    gekozenNode = null;
    bewaar();
    if (data.bron_sha256 && data.bron_sha256 !== BRON.vingerafdruk) {
      meldStatus('Let op: dit dossier is gemaakt met een andere versie van de bron (' +
        String(data.bron_sha256).slice(0, 12) + ' tegen ' + BRON.vingerafdruk.slice(0, 12) +
        '). De antwoorden zijn geladen; loop de uitkomsten na.', true);
    }
  }

  function meldStatus(tekst, letOp) {
    var status = el('dossier-status');
    status.textContent = tekst;
    status.className = letOp ? 'let-op' : '';
  }

  function tekenStatus() {
    var kritiek = dossier.processen.filter(function (p) { return p.kritiek; }).length;
    var delen = [(dossier.organisatie.naam || 'Nog geen organisatie'),
      dossier.processen.length + ' processen', kritiek + ' kritiek',
      dossier.applicaties.length + ' applicaties'];
    if (dossier.bijgewerkt) delen.push('bijgewerkt ' + dossier.bijgewerkt);
    meldStatus(delen.join(' · '), false);
  }

  function wisAlles() {
    if (!window.confirm('Het hele dossier wissen? Dit kan niet ongedaan worden gemaakt.')) return;
    dossier = leegDossier();
    gekozenProces = null;
    gekozenContext = null;
    gekozenNode = null;
    try { window.localStorage.removeItem(SLEUTEL); } catch (fout) { /* niets te doen */ }
    bewaar();
  }

  // ── Alles tekenen ─────────────────────────────────────────────────────────

  function tekenAlles() {
    el('org-naam').value = dossier.organisatie.naam || '';
    el('org-peildatum').value = dossier.organisatie.peildatum || '';
    tekenProcessen();
    tekenApplicaties();
    tekenBia();
    tekenContext();
    tekenComponenten();
    tekenBlast();
    tekenDashboard();
    tekenUitdraai();
    tekenStatus();
  }

  // ── Opstarten ─────────────────────────────────────────────────────────────

  function start() {
    el('versie').textContent = 'bron ' + BRON.versie + ' · vingerafdruk ' +
      BRON.vingerafdruk.slice(0, 12);

    var soort = el('a-soort');
    BRON.keuzes.soort_applicatie.forEach(function (waarde) {
      soort.appendChild(maak('option', waarde, { value: waarde }));
    });

    bouwVragen();
    tekenParametertabel();

    alle('.tabs button').forEach(function (knop) {
      knop.addEventListener('click', function () { toonScherm(knop.getAttribute('data-scherm')); });
    });
    toonScherm('scherm-processen');

    el('org-naam').addEventListener('change', function () {
      dossier.organisatie.naam = el('org-naam').value.trim();
      bewaar();
    });
    el('org-peildatum').addEventListener('change', function () {
      dossier.organisatie.peildatum = el('org-peildatum').value;
      bewaar();
    });

    el('knop-proces-nieuw').addEventListener('click', function () { openProcesForm(null); });
    el('p-opslaan').addEventListener('click', slaProcesOp);
    el('p-annuleren').addEventListener('click', function () {
      el('proces-form').hidden = true;
      bewerktProces = null;
    });

    el('knop-app-nieuw').addEventListener('click', function () { openAppForm(null); });
    el('a-opslaan').addEventListener('click', slaAppOp);
    el('a-annuleren').addEventListener('click', function () {
      el('app-form').hidden = true;
      bewerktApp = null;
    });

    el('bia-proces').addEventListener('change', function () {
      gekozenProces = el('bia-proces').value || null;
      tekenBia();
    });
    ['rto-waarde', 'rto-eenheid', 'rpo-waarde', 'rpo-eenheid', 'rto-rpo-toelichting',
      'bia-interviewer', 'bia-interviewdatum', 'bia-beschrijving', 'bia-keten',
      'bia-afwijking-eigenaar', 'bia-notities'].forEach(function (id) {
      el(id).addEventListener('change', leesBia);
    });

    el('context-proces').addEventListener('change', function () {
      gekozenContext = el('context-proces').value || null;
      tekenContext();
    });
    alle('[data-context]').forEach(function (veld) { veld.addEventListener('change', leesContext); });
    ['context-persoonsgegevens', 'context-bijzonder', 'context-reviewdatum', 'context-notities']
      .forEach(function (id) { el(id).addEventListener('change', leesContext); });

    el('knop-landschap-laden').addEventListener('click', function () { el('bestand-landschap').click(); });
    el('bestand-landschap').addEventListener('change', function (gebeurtenis) {
      var bestand = gebeurtenis.target.files[0];
      if (!bestand) return;
      var lezer = new FileReader();
      lezer.onload = function () { importeerLandschap(bestand.name, String(lezer.result)); };
      lezer.readAsText(bestand);
      gebeurtenis.target.value = '';
    });
    el('knop-landschap-voorbeeld').addEventListener('click', function () {
      importeerLandschap('voorbeeld/landschap.json', JSON.stringify(BRON.voorbeeld));
    });
    el('knop-componenten-wissen').addEventListener('click', function () {
      if (!window.confirm('Alle componenten en hun relaties wissen? Processen en applicaties ' +
        'blijven staan.')) return;
      dossier.componenten = [];
      dossier.component_edges = [];
      dossier.landschap_bron = { bestand: '', geimporteerd: '' };
      gekozenNode = null;
      bewaar();
    });

    el('knop-opslaan').addEventListener('click', slaDossierOp);
    el('knop-laden').addEventListener('click', function () { el('bestand-laden').click(); });
    el('bestand-laden').addEventListener('change', function (gebeurtenis) {
      var bestand = gebeurtenis.target.files[0];
      if (!bestand) return;
      var lezer = new FileReader();
      lezer.onload = function () { laadDossier(String(lezer.result)); };
      lezer.readAsText(bestand);
      gebeurtenis.target.value = '';
    });
    el('knop-afdrukken').addEventListener('click', function () {
      toonScherm('scherm-uitdraai');
      window.print();
    });
    el('knop-wissen').addEventListener('click', wisAlles);
    el('knop-voorstel-laden').addEventListener('click', function () { el('bestand-voorstel').click(); });
    el('bestand-voorstel').addEventListener('change', function (gebeurtenis) {
      var bestand = gebeurtenis.target.files[0];
      if (!bestand) return;
      var lezer = new FileReader();
      lezer.onload = function () { laadVoorstel(String(lezer.result)); };
      lezer.readAsText(bestand);
      gebeurtenis.target.value = '';
    });
    el('knop-alles-overnemen').addEventListener('click', function () { zetAlleKeuzes('overnemen'); });
    el('knop-alles-overslaan').addEventListener('click', function () { zetAlleKeuzes('overslaan'); });
    el('knop-overnemen').addEventListener('click', neemVoorstelOver);
    el('knop-voorstel-sluiten').addEventListener('click', function () { voorstel = null; toonScherm('scherm-processen'); });

    herstel();
    tekenAlles();
  }

  window.reken = reken;
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
