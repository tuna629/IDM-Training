
(function(){
"use strict";

const C = window.CONCEPTS;
const SEQ = window.SEQUENCES;
const STORE = "idm_forschungsmethoden_github_v1";
const MODES = {
  all: {label:"Gesamtes Skript", cats:["grundlagen","qualitativ","quantitativ"]},
  qual: {label:"Nur qualitativ", cats:["grundlagen","qualitativ"]},
  quant: {label:"Nur quantitativ", cats:["grundlagen","quantitativ"]},
  stats: {label:"Statistik & Testverfahren", cats:["quantitativ"]}
};

let state = loadState();
let filter = "all";

function loadState(){
  try {
    const s = JSON.parse(localStorage.getItem(STORE) || "null");
    if(s && Array.isArray(s.tests) && Array.isArray(s.usedIds)) return s;
  } catch(e){}
  return {tests:[], usedIds:[], active:0, mode:"all"};
}
function save(){ localStorage.setItem(STORE, JSON.stringify(state)); }
function byId(id){ return C.find(x=>x.id===id); }
function rand(n){ return Math.floor(Math.random()*n); }
function choice(a){ return a[rand(a.length)]; }
function sample(a,n){
  const b=[...a];
  for(let i=b.length-1;i>0;i--){ const j=rand(i+1); [b[i],b[j]]=[b[j],b[i]]; }
  return b.slice(0,n);
}
function shuffle(a){ return sample(a,a.length); }
function esc(s){ return String(s).replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[m])); }
function hash(str){
  let h=2166136261;
  for(let i=0;i<str.length;i++){ h ^= str.charCodeAt(i); h = Math.imul(h,16777619); }
  return (h>>>0).toString(36);
}
function makeId(base){ return "q_"+hash(base); }

function eligibleConcepts(mode){
  const cats=MODES[mode].cats;
  let pool=C.filter(x=>cats.includes(x.category));
  if(mode==="stats"){
    const allowed=["stat_anzahl","zentral","stat_verfahren","skala","test","test_richtung","hypothese","signifikanz","stat_basis","stichprobenart","ergebnis","messung","datenauf"];
    pool=pool.filter(x=>allowed.includes(x.group));
  }
  return pool;
}
function nearDistractors(target,pool,n=3){
  let near=pool.filter(x=>x.id!==target.id && x.group===target.group);
  if(near.length<n) near=near.concat(pool.filter(x=>x.id!==target.id && x.category===target.category && !near.some(y=>y.id===x.id)));
  if(near.length<n) near=near.concat(pool.filter(x=>x.id!==target.id && !near.some(y=>y.id===x.id)));
  return sample(near,n);
}
function withShuffledOptions(q, rawOptions, correctRaw){
  const indexed=rawOptions.map((text,i)=>({text,correct:correctRaw.includes(i)}));
  const shuffled=shuffle(indexed);
  q.options=shuffled.map(x=>x.text);
  q.correct=shuffled.map((x,i)=>x.correct?i:null).filter(x=>x!==null);
  return q;
}

function genDefinition(mode){
  const pool=eligibleConcepts(mode);
  const t=choice(pool);
  const dist=nearDistractors(t,pool,3);
  const terms=[t,...dist];
  const base="def|"+t.id+"|"+dist.map(x=>x.id).sort().join(",");
  let q={id:makeId(base),source:"Begriff aus dem IDM-Skript",explain:t.term+" bezeichnet "+t.definition+".",
    prompt:"Welcher Begriff passt zu dieser Beschreibung?\n\n„"+t.definition+"“"};
  return withShuffledOptions(q,terms.map(x=>x.term),[0]);
}

function genReverseDefinition(mode){
  const pool=eligibleConcepts(mode);
  const t=choice(pool);
  const dist=nearDistractors(t,pool,3);
  const defs=[t,...dist];
  const base="revdef|"+t.id+"|"+dist.map(x=>x.id).sort().join(",");
  let q={id:makeId(base),source:"Begriff aus dem IDM-Skript",explain:"Passend zu "+t.term+": "+t.definition+".",
    prompt:"Welche Beschreibung trifft auf „"+t.term+"“ zu?"};
  return withShuffledOptions(q,defs.map(x=>x.definition),[0]);
}

function genPairing(mode, negative=false){
  const pool=eligibleConcepts(mode);
  // use one broad group when possible so distractors are close
  const target=choice(pool);
  let terms=pool.filter(x=>x.group===target.group);
  if(terms.length<4) terms=pool.filter(x=>x.category===target.category);
  terms=sample(terms,4);
  if(terms.length<4) terms=sample(pool,4);
  const numCorrect=1+rand(3); // 1..3
  const correctPositions=new Set(sample([0,1,2,3],numCorrect));
  const options=[];
  const mapping=[];
  for(let i=0;i<4;i++){
    let defConcept;
    if(correctPositions.has(i)){
      defConcept=terms[i];
    }else{
      const others=terms.filter((_,j)=>j!==i);
      defConcept=choice(others);
    }
    mapping.push(terms[i].id+"->"+defConcept.id);
    options.push(terms[i].term+" — "+defConcept.definition);
  }
  const correctRaw=[0,1,2,3].filter(i=>negative?!correctPositions.has(i):correctPositions.has(i));
  const base=(negative?"pairN":"pair")+"|"+mapping.slice().sort().join("|");
  let q={id:makeId(base),source:"Begriffszuordnungen aus dem IDM-Skript",
    explain:"Bei den korrekten Zuordnungen ist der Begriff jeweils mit seiner eigenen Definition verbunden.",
    prompt:negative?"Welche Zuordnung/en ist/sind NICHT korrekt?":"Welche Zuordnung/en ist/sind korrekt?"};
  return withShuffledOptions(q,options,correctRaw);
}

function genSequence(mode){
  let pool=SEQ.filter(s=>MODES[mode].cats.includes(s.category));
  if(mode==="stats") pool=SEQ.filter(s=>s.id==="seq_qdesign" || s.id==="seq_likert");
  const s=choice(pool);
  const correct=s.items.join(" → ");
  const wrong=[];
  let tries=0;
  while(wrong.length<3 && tries<50){
    tries++;
    const perm=shuffle(s.items);
    const txt=perm.join(" → ");
    if(txt!==correct && !wrong.includes(txt)) wrong.push(txt);
  }
  const base="seq|"+s.id+"|"+wrong.slice().sort().join("||");
  let q={id:makeId(base),source:"Ablauf aus dem IDM-Skript",explain:"Die richtige Reihenfolge lautet: "+correct+".",
    prompt:"Welche Reihenfolge ist für „"+s.title+"“ korrekt?"};
  return withShuffledOptions(q,[correct,...wrong],[0]);
}

// Scenario generators
const variables = {
  nominal:["Abteilung (Produktion/Einkauf/Vertrieb)","Haarfarbe","Produktkategorie","Geschlecht"],
  ordinal:["Zufriedenheit von sehr unzufrieden bis sehr zufrieden","Schulnoten","Priorität niedrig/mittel/hoch","Bewertung auf einer Rangskala"],
  intervall:["Temperatur in Grad Celsius"],
  ratio:["Einkommen in Euro","Gewicht in Kilogramm","Stückzahl pro Stunde","Alter in Jahren"]
};
function genScaleScenario(){
  const types=[
    ["Nominalskala","nominal"],["Ordinalskala","ordinal"],["Intervallskala","intervall"],["Verhältnisskala","ratio"]
  ];
  const t=choice(types), example=choice(variables[t[1]]);
  const base="scale|"+t[1]+"|"+example;
  let q={id:makeId(base),source:"Skalenniveaus im IDM-Skript",
    explain:example+" gehört zur "+t[0]+".",
    prompt:"Welches Skalenniveau passt am besten zu folgender Variable?\n\n"+example};
  return withShuffledOptions(q,types.map(x=>x[0]),[types.findIndex(x=>x[1]===t[1])]);
}
function genStatTestScenario(){
  const scenarios=[
    ["Zwei kategoriale Variablen sollen darauf geprüft werden, ob zwischen ihnen ein Zusammenhang besteht.","Chi-Quadrat-Test"],
    ["Zwei unabhängige Gruppen werden auf einer ordinalen Skala verglichen; die Daten sind nicht normalverteilt.","Mann-Whitney-U-Test"],
    ["Die Mittelwerte zweier unabhängiger, annähernd normalverteilter Gruppen sollen verglichen werden.","t-Test"],
    ["Die Mittelwerte von vier Gruppen sollen verglichen werden; die parametrischen Voraussetzungen sind erfüllt.","Varianzanalyse (ANOVA)"],
    ["Mehr als zwei Gruppen sollen verglichen werden, aber die Voraussetzungen der ANOVA sind nicht erfüllt.","Kruskal-Wallis-Test"],
    ["Stärke und Richtung eines linearen Zusammenhangs zwischen zwei metrischen Variablen sollen geprüft werden.","Pearson-Korrelationstest"]
  ];
  const s=choice(scenarios);
  const all=["Chi-Quadrat-Test","Mann-Whitney-U-Test","t-Test","Varianzanalyse (ANOVA)","Kruskal-Wallis-Test","Pearson-Korrelationstest"];
  const dist=sample(all.filter(x=>x!==s[1]),3);
  const base="stattest|"+s[0];
  let q={id:makeId(base),source:"Statistische Testverfahren im IDM-Skript",explain:"Passend ist: "+s[1]+".",prompt:"Welches Verfahren passt am besten?\n\n"+s[0]};
  return withShuffledOptions(q,[s[1],...dist],[0]);
}
function genSurveyScenario(){
  const s=[
    ["Eine Interviewerin telefoniert mit der befragten Person und gibt die Antworten direkt in den Computer ein.","CATI"],
    ["Die befragte Person füllt den Fragebogen selbst über einen Weblink aus.","CAWI"],
    ["Das Interview findet persönlich statt und Antworten werden direkt in Tablet oder Computer eingegeben.","CAPI"],
    ["Die befragte Person füllt einen Papierfragebogen aus.","PAPI"],
    ["Die befragte Person sitzt am Computer und wird gleichzeitig telefonisch befragt.","WATI"]
  ];
  const x=choice(s), opts=["CATI","CAWI","CAPI","PAPI","WATI"];
  const base="survey|"+x[0];
  let q={id:makeId(base),source:"Quantitative Befragungsformen im IDM-Skript",explain:"Die beschriebene Form ist "+x[1]+".",prompt:"Welche Befragungsform wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genInterviewScenario(){
  const s=[
    ["Eine Person wird gebeten, ihren Karriereweg frei zu erzählen. Die forschende Person steuert möglichst wenig.","Narratives Interview"],
    ["Es gibt vorbereitete offene Hauptfragen, aber Reihenfolge und Nachfragen werden dem Gespräch angepasst.","Halbstandardisiertes Leitfadeninterview"],
    ["Mehrere Personen diskutieren moderiert ein Thema; auch ihre Interaktion ist Teil des Erkenntnisgewinns.","Fokusgruppeninterview"],
    ["Eine Person wird wegen ihres spezifischen Branchenwissens befragt.","Expert:inneninterview"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="interview|"+x[0];
  let q={id:makeId(base),source:"Qualitative Interviewformen im IDM-Skript",explain:"Passend ist: "+x[1]+".",prompt:"Welche Interviewform passt am besten?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genObservationScenario(){
  const s=[
    ["Zu Beginn verschafft sich die forschende Person zunächst einen allgemeinen Überblick über das Feld.","Deskriptive Beobachtung"],
    ["Die Aufmerksamkeit wird auf Prozesse verengt, die für die Forschungsfrage besonders wichtig sind.","Fokussierte Beobachtung"],
    ["Gegen Ende werden gezielt weitere Belege für bereits identifizierte Praktiken gesucht.","Selektive Beobachtung"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="obsphase|"+x[0];
  let q={id:makeId(base),source:"Phasen qualitativer Beobachtung im IDM-Skript",explain:"Das ist die "+x[1]+".",prompt:"Welche Beobachtungsphase wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genMayringScenario(){
  const s=[
    ["Ein umfangreicher Interviewtext wird auf seine wesentlichen Kernaussagen reduziert.","Zusammenfassung"],
    ["Eine schwer verständliche Passage wird mithilfe zusätzlichen Materials erläutert.","Explikation"],
    ["Bestimmte Aspekte des Materials werden gezielt ausgewählt und anhand festgelegter Maßstäbe beurteilt.","Strukturierung"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="mayring|"+x[0];
  let q={id:makeId(base),source:"Mayring im IDM-Skript",explain:"Passend ist: "+x[1]+".",prompt:"Welche Grundform nach Mayring liegt vor?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genGTScenario(){
  const s=[
    ["Daten werden zunächst aufgebrochen, um Phänomene, Eigenschaften und erste Konzepte herauszuarbeiten.","Offenes Kodieren"],
    ["Bereits identifizierte Konzepte werden miteinander in Beziehung gesetzt und ihre Zusammenhänge geprüft.","Axiales Kodieren"],
    ["Eine oder wenige Kernkategorien werden herausgearbeitet und das Material wird darauf bezogen erneut analysiert.","Selektives Kodieren"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="gtphase|"+x[0];
  let q={id:makeId(base),source:"Grounded Theory im IDM-Skript",explain:"Das beschreibt "+x[1]+".",prompt:"Welche Kodierphase der Grounded Theory wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genKuckartzScenario(){
  const s=[
    ["Inhalte werden primär thematisch strukturiert und anhand inhaltlicher Kategorien ausgewertet.","Inhaltlich strukturierende Inhaltsanalyse"],
    ["Aussagen werden bewertenden Kategorien zugeordnet und klassifiziert.","Evaluative Inhaltsanalyse"],
    ["Ähnliche Fälle werden gruppiert, um unterschiedliche Typen beziehungsweise Typologien zu bilden.","Typenbildende Inhaltsanalyse"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="kuckart|"+x[0];
  let q={id:makeId(base),source:"Kuckartz im IDM-Skript",explain:"Passend ist: "+x[1]+".",prompt:"Welche Auswertungsmöglichkeit nach Kuckartz wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genDataPrepScenario(){
  const s=[
    ["Ein offensichtlich unmögliches Alter von 150 Jahren wird geprüft und korrigiert oder entfernt.","Datenbereinigung"],
    ["Einkommensangaben in Euro und US-Dollar werden in eine einheitliche Währung überführt.","Datenformatierung"],
    ["Online- und Telefonbefragungsdaten werden zusammengeführt und Doppelungen entfernt.","Datenintegration"],
    ["Nur die für die Forschungsfrage relevanten Variablen werden für die Analyse ausgewählt.","Datenreduktion"],
    ["Berufsangaben werden in numerische Codes wie 1 = Büro, 2 = Produktion umgewandelt.","Datenkodierung"],
    ["Namen und Geburtsdaten werden entfernt oder durch anonyme IDs ersetzt.","Datenanonymisierung"],
    ["Ein Gesamtdatensatz wird nach Altersgruppen in Teilgruppen aufgeteilt.","Erstellung von Datenuntergruppen"],
    ["Variablen, Werte, Erhebungszeitraum und Erhebungsmethode werden in einem Codebook dokumentiert.","Metadaten beziehungsweise Codebook"]
  ];
  const x=choice(s), terms=s.map(y=>y[1]), dist=sample(terms.filter(t=>t!==x[1]),3);
  const base="dataprep|"+x[0];
  let q={id:makeId(base),source:"Quantitative Datenaufbereitung im IDM-Skript",explain:"Der passende Schritt ist: "+x[1]+".",prompt:"Welcher Schritt der Datenaufbereitung wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,[x[1],...dist],[0]);
}
function genTriScenario(){
  const s=[
    ["Interviews und Beobachtungen werden in derselben Studie kombiniert.","Methodentriangulation"],
    ["Mehrere Forschende analysieren denselben Gegenstand gemeinsam.","Forscher:innentriangulation"],
    ["Ein Phänomen wird mithilfe mehrerer theoretischer Konzepte betrachtet.","Theorietriangulation"],
    ["Erkenntnisse aus unterschiedlichen Datenquellen werden zusammengeführt.","Datenquellentriangulation"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="tri|"+x[0];
  let q={id:makeId(base),source:"Triangulation im IDM-Skript",explain:"Das ist "+x[1]+".",prompt:"Welche Form der Triangulation wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genObjectivityScenario(){
  const s=[
    ["Alle Untersuchungspersonen erhalten dieselben Anweisungen und Bedingungen.","Durchführungsobjektivität"],
    ["Zwei Personen werten dieselben Daten nach denselben Regeln aus und gelangen zum gleichen Ergebnis.","Auswertungsobjektivität"],
    ["Aus denselben Ergebnissen werden nach denselben Kriterien die gleichen Schlussfolgerungen gezogen.","Interpretationsobjektivität"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="obj|"+x[0];
  let q={id:makeId(base),source:"Objektivität im IDM-Skript",explain:"Beschrieben wird "+x[1]+".",prompt:"Welche Form der Objektivität steht im Vordergrund?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genLongitudinalScenario(){
  const isPanel=Math.random()<0.5;
  const base=isPanel?
    "Dieselbe Personengruppe wird in festgelegten Abständen wiederholt zum gleichen Thema befragt.":
    "Regelmäßig werden unterschiedliche Personengruppen zum gleichen Thema befragt.";
  let q={id:makeId("long|"+base),source:"Panel und Tracking im IDM-Skript",
    explain:isPanel?"Das beschreibt ein Panel.":"Das beschreibt Tracking.",
    prompt:"Welcher Begriff passt?\n\n"+base};
  return withShuffledOptions(q,["Panel","Tracking"],[isPanel?0:1]);
}
function genBehaviorScenario(){
  const s=[
    ["„Haben Sie im letzten Jahr an einer Fortbildung teilgenommen?“","Prävalenzmessung"],
    ["„Wie oft haben Sie im letzten Monat an einer Fortbildung teilgenommen?“","Inzidenzmessung"],
    ["„Wie wahrscheinlich ist es, dass Sie in den nächsten sechs Monaten an einer Fortbildung teilnehmen?“","Verhaltensintention"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="beh|"+x[0];
  let q={id:makeId(base),source:"Messung von Ereignissen und Verhalten im IDM-Skript",explain:"Passend ist: "+x[1]+".",prompt:"Welche Messart wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genNetworkScenario(){
  const s=[
    ["Eine Person nennt, mit welchen Kolleg:innen sie am häufigsten zusammenarbeitet.","Egozentrierte Netzwerkanalyse"],
    ["Es wird untersucht, wie dicht die Verbindungen innerhalb eines gesamten Netzwerks sind.","Strukturelle Netzwerkanalyse"],
    ["Es wird erfragt, wer bei wichtigen Entscheidungen besonders häufig konsultiert wird.","Soziometrische Fragen"]
  ];
  const x=choice(s), opts=s.map(y=>y[1]);
  const base="net|"+x[0];
  let q={id:makeId(base),source:"Quantitative Netzwerkmessung im IDM-Skript",explain:"Passend ist: "+x[1]+".",prompt:"Welche Form der Netzwerkerhebung wird beschrieben?\n\n"+x[0]};
  return withShuffledOptions(q,opts,[opts.indexOf(x[1])]);
}
function genCentralMeasure(){
  const sets=[
    [2,3,3,5,7],
    [1,4,4,4,9],
    [2,2,5,8,13],
    [3,5,5,6,11]
  ];
  const vals=choice(sets);
  const sorted=[...vals].sort((a,b)=>a-b);
  const mean=vals.reduce((a,b)=>a+b,0)/vals.length;
  const median=sorted[Math.floor(sorted.length/2)];
  const counts={}; vals.forEach(v=>counts[v]=(counts[v]||0)+1);
  const mode=Number(Object.keys(counts).sort((a,b)=>counts[b]-counts[a])[0]);
  const truths=[
    "Der Median beträgt "+median+".",
    "Der Modus beträgt "+mode+".",
    "Der Mittelwert beträgt "+(Math.round(mean*100)/100)+"."
  ];
  const falseVal=median+2;
  const opts=[...truths,"Der Median beträgt "+falseVal+"."];
  const base="central|"+vals.join(",");
  let q={id:makeId(base),source:"Mittelwert, Median und Modus im IDM-Skript",
    explain:"Für "+vals.join(", ")+" gilt: Median = "+median+", Modus = "+mode+", Mittelwert = "+(Math.round(mean*100)/100)+".",
    prompt:"Welche Aussage/n ist/sind für den Datensatz korrekt?\n\n"+vals.join(" – ")};
  return withShuffledOptions(q,opts,[0,1,2]);
}
function genHypothesis(){
  const directed=Math.random()<0.5;
  const text=directed?
    "Der durchschnittliche Umsatz mit Kampagne A ist höher als mit Kampagne B.":
    "Zwischen Abteilung A und Abteilung B besteht ein Unterschied im durchschnittlichen Umsatz.";
  const base="hyp|"+text;
  const opts=directed?
    ["gerichtete Alternativhypothese","ungerichtete Alternativhypothese","Nullhypothese","Operationalisierung"]:
    ["ungerichtete Alternativhypothese","gerichtete Alternativhypothese","Nullhypothese","Operationalisierung"];
  let q={id:makeId(base),source:"Hypothesen im IDM-Skript",
    explain:directed?"„höher“ gibt eine Richtung vor; die Hypothese ist gerichtet.":"Es wird nur ein Unterschied angenommen, ohne Richtung; die Hypothese ist ungerichtet.",
    prompt:"Wie ist folgende Hypothese einzuordnen?\n\n„"+text+"“"};
  return withShuffledOptions(q,opts,[0]);
}

const SCENARIO_GENERATORS = {
  all:[genScaleScenario,genStatTestScenario,genSurveyScenario,genInterviewScenario,genObservationScenario,genMayringScenario,genGTScenario,genKuckartzScenario,genDataPrepScenario,genTriScenario,genObjectivityScenario,genLongitudinalScenario,genBehaviorScenario,genNetworkScenario,genCentralMeasure,genHypothesis],
  qual:[genInterviewScenario,genObservationScenario,genMayringScenario,genGTScenario,genKuckartzScenario,genTriScenario],
  quant:[genScaleScenario,genStatTestScenario,genSurveyScenario,genDataPrepScenario,genObjectivityScenario,genLongitudinalScenario,genBehaviorScenario,genNetworkScenario,genCentralMeasure,genHypothesis],
  stats:[genScaleScenario,genStatTestScenario,genDataPrepScenario,genCentralMeasure,genHypothesis]
};

function candidate(mode){
  const r=Math.random();
  if(r<0.22) return genDefinition(mode);
  if(r<0.40) return genReverseDefinition(mode);
  if(r<0.62) return genPairing(mode,false);
  if(r<0.76) return genPairing(mode,true);
  if(r<0.84) return genSequence(mode);
  return choice(SCENARIO_GENERATORS[mode])();
}

function generateTest(mode){
  const already=new Set(state.usedIds);
  const picked=[], local=new Set();
  let attempts=0;
  while(picked.length<20 && attempts<12000){
    attempts++;
    let q=candidate(mode);
    if(!q || already.has(q.id) || local.has(q.id)) continue;
    // For whole-script tests, make sure both qualitative and quantitative content appear.
    picked.push(q); local.add(q.id);
  }
  if(picked.length<20) return null;
  return picked;
}

function startNewTest(){
  const mode=document.getElementById("mode").value;
  const qs=generateTest(mode);
  if(!qs){
    alert("Ich konnte keine 20 wirklich neuen Fragen mehr erzeugen. Der lokale Fragenverlauf kann in den Einstellungen zurückgesetzt werden – oder du lässt den Fragenpool von ChatGPT erweitern.");
    return;
  }
  const t={
    number:state.tests.length+1,
    mode,
    questions:qs,
    attempts:[{answers:{},evaluated:false,score:null}],
    activeAttempt:0,
    createdAt:new Date().toISOString()
  };
  state.tests.push(t);
  state.usedIds.push(...qs.map(q=>q.id));
  if(state.tests.length>40) state.tests=state.tests.slice(-40);
  state.active=state.tests.length-1;
  state.mode=mode;
  filter="all"; save(); render();
}
function currentTest(){ return state.tests[state.active]; }
function currentAttempt(){ const t=currentTest(); return t?t.attempts[t.activeAttempt]:null; }

function scoreQuestion(q, chosen){
  const k=q.correct.length;
  let s=0;
  for(const i of chosen) s += q.correct.includes(i) ? 1/k : -1/k;
  return Math.max(0,Math.min(1,s));
}

function evaluate(){
  const t=currentTest(), a=currentAttempt(); if(!t||!a||a.evaluated) return;
  let total=0;
  t.questions.forEach((q)=>{
    total += scoreQuestion(q,a.answers[q.id]||[]);
  });
  a.score=Math.round(total*100)/100;
  a.evaluated=true;
  filter="all"; save(); render();
  window.scrollTo({top:0,behavior:"smooth"});
}
function retry(){
  const t=currentTest(); if(!t) return;
  t.attempts.push({answers:{},evaluated:false,score:null});
  t.activeAttempt=t.attempts.length-1;
  filter="all"; save(); render();
}
function toggle(qid,oi,checked){
  const a=currentAttempt(); if(!a||a.evaluated) return;
  a.answers[qid]=a.answers[qid]||[];
  if(checked && !a.answers[qid].includes(oi)) a.answers[qid].push(oi);
  if(!checked) a.answers[qid]=a.answers[qid].filter(x=>x!==oi);
  save();
}
window.toggleAnswer=toggle;
window.openTest=function(i){ state.active=i; filter="all"; save(); render(); };
window.openAttempt=function(i){ const t=currentTest(); t.activeAttempt=i; filter="all"; save(); render(); };

function renderTabs(){
  const el=document.getElementById("tabs"); el.innerHTML="";
  state.tests.forEach((t,i)=>{
    const b=document.createElement("button");
    b.className="tab "+(i===state.active?"active":"");
    b.textContent="Test "+t.number;
    b.onclick=()=>window.openTest(i);
    el.appendChild(b);
  });
}
function render(){
  document.getElementById("mode").value=state.mode||"all";
  if(state.tests.length===0){ startNewTest(); return; }
  renderTabs();
  const t=currentTest(), a=currentAttempt();
  const answered=Object.values(a.answers).filter(x=>x&&x.length).length;
  const status=document.getElementById("status");
  let h="<b>Test "+t.number+"</b> · "+MODES[t.mode].label+" · Versuch "+(t.activeAttempt+1)+" von "+t.attempts.length+
        " · "+answered+"/20 beantwortet";
  if(a.evaluated) h+="<div class='score'>"+a.score.toFixed(2)+" / 20 Punkte</div>";
  h+="<div class='muted'>Bereits verwendete, nicht erneut generierte Fragen auf diesem Gerät: "+state.usedIds.length+"</div>";
  if(t.attempts.length>1){
    h+="<div class='attempts'>Versuche: ";
    t.attempts.forEach((x,i)=>{
      h+="<button onclick='openAttempt("+i+")'>Versuch "+(i+1)+(x.evaluated?" · "+x.score.toFixed(2)+" P":"")+"</button>";
    });
    h+="</div>";
  }
  status.innerHTML=h;

  document.getElementById("eval").disabled=a.evaluated;
  document.getElementById("retry").disabled=!a.evaluated;
  document.getElementById("errors").disabled=!a.evaluated;
  document.getElementById("all").disabled=!a.evaluated;

  const quiz=document.getElementById("quiz"); quiz.innerHTML="";
  t.questions.forEach((q,qi)=>{
    const chosen=a.answers[q.id]||[];
    const pts=a.evaluated?scoreQuestion(q,chosen):null;
    if(filter==="errors" && a.evaluated && pts===1) return;
    const card=document.createElement("section");
    card.className="card";
    let html="<div class='meta'>Frage "+(qi+1)+" von 20</div>"+
      "<div class='question'>"+esc(q.prompt).replace(/\n/g,"<br>")+"</div>";
    q.options.forEach((op,oi)=>{
      let cls="option", note="";
      if(a.evaluated){
        const c=q.correct.includes(oi), s=chosen.includes(oi);
        if(c&&s){cls+=" correct";note=" <small>– richtig gewählt</small>";}
        else if(!c&&s){cls+=" wrong";note=" <small>– falsch gewählt</small>";}
        else if(c&&!s){cls+=" missed";note=" <small>– richtig, aber nicht gewählt</small>";}
      }
      html+="<label class='"+cls+"'><input type='checkbox' "+(chosen.includes(oi)?"checked ":"")+(a.evaluated?"disabled ":"")+
        "onchange='toggleAnswer(\""+q.id+"\","+oi+",this.checked)'><span><b>"+String.fromCharCode(97+oi)+")</b> "+esc(op)+note+"</span></label>";
    });
    if(a.evaluated){
      html+="<div class='feedback'><b>Richtige Lösung:</b> "+q.correct.map(i=>String.fromCharCode(97+i)).join(", ")+
        " &nbsp;·&nbsp; <b>Punkte:</b> "+pts.toFixed(2)+"/1<br>"+esc(q.explain)+
        "<div class='source'>Grundlage: "+esc(q.source)+"</div></div>";
    }
    card.innerHTML=html; quiz.appendChild(card);
  });
}
function resetHistory(){
  if(!confirm("Wirklich den gesamten Test- und Fragenverlauf auf diesem Gerät löschen? Danach können frühere Fragen wieder erscheinen.")) return;
  localStorage.removeItem(STORE);
  state={tests:[],usedIds:[],active:0,mode:"all"};
  filter="all"; render();
}

document.getElementById("eval").onclick=evaluate;
document.getElementById("new").onclick=startNewTest;
document.getElementById("retry").onclick=retry;
document.getElementById("errors").onclick=()=>{filter="errors";render();};
document.getElementById("all").onclick=()=>{filter="all";render();};
document.getElementById("resetHistory").onclick=resetHistory;
document.getElementById("mode").onchange=(e)=>{state.mode=e.target.value;save();};

render();
})();
