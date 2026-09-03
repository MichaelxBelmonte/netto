# Modello di calcolo

Anno fiscale modellato: **2026**. Profilo: dipendente privato a tempo indeterminato, intero anno, nessun familiare a carico e nessun altro reddito o onere personale.

Il motore è implementato in `src/lib/tax.ts`; le regole territoriali sono isolate in `src/lib/localTaxes.ts`. Gli importi sono arrotondati ai centesimi dopo i passaggi principali. Il risultato è un netto **per competenza annuale**: dice quanto costano contributi e imposte dell’anno, non come il cedolino li distribuisce mese per mese (vedi §9).

## 1. Contributi del dipendente

Nel caso standard viene stimata la quota pensionistica (IVS) a carico del lavoratore, 9,19% della RAL. Alla parte eccedente 56.224 € viene aggiunto l’1% (art. 3-ter D.L. 384/1992; prima fascia di retribuzione pensionabile 2026 fissata dalla circolare INPS n. 6/2026, par. 5).

```text
contributi = RAL × 9,19% + max(0, RAL − 56.224) × 1%
```

È la principale semplificazione previdenziale:

- nelle aziende che rientrano nel campo della Cassa integrazione straordinaria la quota sale a 9,49% (0,30% di contributo CIGS a carico del lavoratore): dal 1° gennaio 2022 la L. 234/2021 vi ha ricondotto in via generale i datori con più di 15 dipendenti, superando le vecchie soglie di settore; apprendisti 5,84%; operai agricoli 8,84%
- l’imponibile previdenziale può differire dalla RAL (buoni pasto, trasferte, fringe benefit entro soglia, TFR) e non può scendere sotto il minimale (1.511,38 €/mese nel 2026): una RAL di 15.000 € a tempo pieno è realistica solo come part-time
- il massimale contributivo 2026 (122.295 € per gli iscritti dal 1996) è sopra il tetto di 120.000 € accettato dall’interfaccia, quindi non è modellato
- in busta paga l’1% si applica mese per mese oltre 4.685 € e viene conguagliato a fine anno: il risultato annuo coincide

## 2. Imponibile fiscale

```text
imponibile = RAL − contributi dipendente
```

Il prototipo assume che tutta la RAL inserita sia retribuzione ordinaria imponibile. Nel profilo standard imponibile fiscale, reddito complessivo e reddito imponibile coincidono.

## 3. IRPEF lorda 2026

L’imposta è progressiva (art. 11 TUIR come modificato dalla L. 199/2025):

- 23% fino a 28.000 €
- 33% sulla parte tra 28.000 € e 50.000 €
- 43% sulla parte oltre 50.000 €

Ogni aliquota si applica solo alla porzione di imponibile compresa nello scaglione. Ogni segmento è arrotondato al centesimo prima della somma, così i segmenti mostrati coincidono sempre con il totale.

## 4. Detrazione da lavoro dipendente

Art. 13 c. 1 e 1.1 TUIR:

- fino a 15.000 €: 1.955 €
- da 15.000 € a 28.000 €: `1.910 + 1.190 × (28.000 − reddito) / 13.000`
- da 28.000 € a 50.000 €: `1.910 × (50.000 − reddito) / 22.000`
- oltre 50.000 €: 0 €

Tra 25.000 € e 35.000 € viene aggiunta la maggiorazione di 65 €. La detrazione fruita è limitata all’IRPEF lorda; la detrazione teorica (non limitata) serve al test di capienza del trattamento integrativo.

## 5. Misure sul cuneo fiscale

L. 207/2024, art. 1 c. 4–7. Per imponibili fino a 20.000 € viene stimata la somma non imponibile:

- 7,1% fino a 8.500 €
- 5,3% oltre 8.500 € e fino a 15.000 €
- 4,8% oltre 15.000 € e fino a 20.000 €

Oltre 20.000 € viene calcolata l’ulteriore detrazione:

- 1.000 € oltre 20.000 € e fino a 32.000 €
- riduzione lineare da 1.000 € a 0 € oltre 32.000 € e fino a 40.000 €
- 0 € oltre 40.000 €

Il trattamento integrativo (D.L. 3/2020) di 1.200 € spetta fino a 15.000 € di reddito se l’imposta lorda supera la detrazione teorica art. 13 diminuita di 75 €. Le detrazioni non possono generare IRPEF negativa.

Effetti da conoscere: a 16.518 € di RAL l’imponibile è 15.000 € e spetta il trattamento integrativo; a 16.519 € si perde il bonus ma la detrazione sale da 1.955 a circa 3.100 €, per un salto netto di −129 €.

## 6. Addizionale regionale

Sono presenti le aliquote 2026 di 19 Regioni e delle Province autonome di Trento e Bolzano: 21 giurisdizioni fiscali. Sono state confrontate a mano, il 2 settembre 2026, con il CSV delle addizionali regionali scaricato quel giorno dal MEF (non versionato nel repository): coincidono tutte, comprese le variazioni in corso d'anno di Puglia, pubblicata il 28 maggio 2026, e Molise, pubblicata il 19 giugno 2026. Il calcolo progressivo usa gli stessi confini di reddito pubblicati dal MEF.

Sono gestite esplicitamente anche le regole che non si riducono a quattro aliquote:

- Friuli Venezia Giulia: 0,70% sull’intero reddito fino a 15.000 €, 1,23% sull’intero reddito oltre la soglia
- Valle d’Aosta: esenzione fino a 15.000 €, poi 1,23% sull’intero reddito
- Provincia di Trento: deduzione di 30.000 € fino a quella soglia (a 30.000,01 € l’addizionale passa da 0 a 369 €)
- Lazio: aliquota 1,73% sull’intero reddito fino a 28.000 € e detrazione di 60 € tra 28.001 € e 30.000 €
- Umbria: aliquota 1,23% sull’intero reddito fino a 28.000 € e detrazione di 150 € tra 28.001 € e 50.000 €
- Provincia di Bolzano: detrazione standard di 430,50 € fino a 90.000 € e ulteriore detrazione progressiva fino a 125 € oltre 50.000 €

Le agevolazioni regionali per figli, disabilità o altre condizioni personali sono fuori dal profilo standard. Le aliquote regionali sono mantenute nel codice, non nella pipeline: un cambio in corso d’anno richiede un aggiornamento manuale.

## 7. Addizionale comunale

Il Comune scelto porta con sé:

- codice catastale, provincia e giurisdizione regionale
- anno della regola applicata (2026, 2025 oppure 0 se nessuna regola è disponibile)
- soglia di esenzione generale
- aliquota unica o scaglioni progressivi
- indicatore di caso specifico

Se il reddito non supera una soglia di esenzione generale, l’addizionale è zero sull’intero imponibile: la soglia non è trattata come franchigia. Altrimenti vengono applicate le aliquote pubblicate sull’intero imponibile.

Se il MEF non espone una delibera 2026 (`0*`), la pipeline usa la regola 2025 dello stesso codice e la marca con l’anno 2025. Non è una stima: quando un Comune non delibera, aliquote e soglie «si intendono prorogate di anno in anno» (L. 296/2006, art. 1 c. 169) e una nuova delibera vale per l’anno solo se pubblicata sul portale MEF entro il 20 dicembre (D.Lgs. 23/2011, art. 14 c. 8). L’interfaccia mostra sempre l’anno della regola e apre la scheda MEF su quell’anno.

Il tetto ordinario è 0,8% (D.Lgs. 360/1998, art. 1 c. 3). Roma applica 0,9% (D.L. 78/2010, art. 14 c. 14); i capoluoghi con accordo di risanamento con lo Stato (L. 234/2021, c. 572; D.L. 50/2022, art. 43) arrivano fino a 1,2%. Il dato viene preso dal registro MEF così com’è, ma la pipeline segnala e i test bloccano qualsiasi aliquota sopra lo 0,8% per un Comune fuori dall’elenco delle deroghe note: dodici in tutto nello snapshot corrente.

I casi specifici MEF restano segnalati in UI e sono interpretati per il profilo standard. Se un record non ha regola (anno 0), il netto viene calcolato senza addizionale comunale e l’interfaccia lo dichiara.

## 8. Condizione di debenza

Le addizionali locali vengono calcolate solo quando resta IRPEF netta positiva dopo la detrazione art. 13 e l’ulteriore detrazione (D.Lgs. 360/1998, art. 1 c. 4; D.Lgs. 446/1997, art. 50 c. 2). Nel profilo standard la condizione è sempre vera sopra circa 9.360 € di RAL.

## 9. Risultato e riconciliazione

```text
imposte = IRPEF netta + addizionale regionale + addizionale comunale
trattenute = contributi dipendente + imposte
netto annuale = RAL − trattenute + bonus fiscali
netto per mensilità = netto annuale / mensilità selezionate
```

Le 12, 13 o 14 mensilità cambiano solo la media. Il cedolino reale distribuisce diversamente:

- la tredicesima e la quattordicesima sono tassate con gli scaglioni divisi per 12 ma senza detrazioni (DPR 600/1973, art. 23 c. 2 lett. b, vigente per il 2026: Normattiva ne segna l'abrogazione con decorrenza 1° gennaio 2027, quando la disciplina passa al D.Lgs. 33/2025): su 35.000 € di RAL la tredicesima netta è circa 1.871 € contro i 2.002 € della media
- l’addizionale comunale si paga con un acconto del 30% in 9 rate (marzo–novembre) e un saldo in 11 rate l’anno successivo; la regionale solo a saldo l’anno successivo (D.Lgs. 360/1998, art. 1 c. 4–5; D.Lgs. 446/1997, art. 50 c. 4)
- il conguaglio di fine anno riallinea le ritenute mensili al dovuto annuo (con 13 mensilità produce tipicamente un piccolo debito)

La somma delle tredici buste ricostruite a norma coincide con il netto annuo del motore: il modello è esatto sulla competenza, la distribuzione è compito del payroll.

L’indicatore «prossimi 1.000 € lordi» ricalcola l’intero modello a `RAL + 1.000` e mostra la differenza di netto annuale. Non è una semplice aliquota marginale teorica: include la perdita o l’acquisizione delle detrazioni attraversate (a 35.000 € restano 420 €).

## 10. Costo azienda

`src/lib/employerCost.ts` è un modulo separato che **non importa `tax.ts`**: i due calcoli condividono la RAL, non la logica. Il netto poggia su norme fiscali pubblicate; il costo azienda su tabelle contributive che l'INPS non pubblica più in forma analitica aggiornata. Ogni voce del risultato porta quindi la propria fonte e il proprio livello di confidenza:

- `verified`: aliquota fissata da una norma citabile e in vigore
- `reconstructed`: aliquota presa dall'ultima tabella INPS analitica reperibile (gennaio 2012) e aggiornata a mano con le riforme successive

```text
costo azienda = RAL
              + contributi INPS a carico azienda
              + premio INAIL
              + TFR accantonato
              + fondi contrattuali
```

Aliquote a carico dell'azienda, sulla RAL:

| Voce | Commercio | Industria | Base |
| --- | ---: | ---: | --- |
| Pensione (IVS) | 23,81% | 23,81% | tabella INPS, entro il massimale di 122.295 € |
| Disoccupazione (NASpI) | 1,31% | 1,31% | L. 92/2012 art. 2 c. 25 |
| Formazione professionale | 0,30% | 0,30% | L. 845/1978 art. 25 |
| Fondo di garanzia del TFR | 0,20% | 0,20% | L. 297/1982 art. 2 |
| Assegni al nucleo familiare | 0,68% | 0,68% | tabella INPS |
| Indennità di malattia | 2,44% | — | tabella INPS; nell'industria l'impiegato non la versa perché la malattia la paga direttamente l'azienda |
| Maternità | 0,24% | 0,46% | tabella INPS |
| Cassa integrazione ordinaria | — | 1,70% | D.Lgs. 148/2015 art. 13, fino a 50 dipendenti |
| Fondo di integrazione salariale | 0,333% o 0,533% | — | D.Lgs. 148/2015 art. 29 c. 8: 0,50% fino a 5 dipendenti, 0,80% oltre, due terzi al datore |
| Cassa integrazione straordinaria | 0,60% oltre 15 dipendenti | 0,60% oltre 15 dipendenti | D.Lgs. 148/2015 art. 23: 0,90%, due terzi al datore |
| Premio INAIL | 0,40% | 0,50% | voce di tariffa 0722, lavoro d'ufficio: tasso medio prima dell'oscillazione |
| TFR accantonato | 6,907% | 6,907% | art. 2120 c.c. (1/13,5) meno lo 0,50% dell'art. 3 L. 297/1982, già compreso nell'IVS |

Il TFR è la trappola aritmetica del calcolo: l'accantonamento lordo è 7,41%, ma lo 0,50% è già dentro l'aliquota IVS a carico dell'azienda. Sommare 7,41% e l'aliquota INPS piena conterebbe due volte lo stesso mezzo punto.

Su RAL 35.000 €, impiegato del commercio in un'azienda da 6 a 15 dipendenti: contributi INPS 10.329,67 € (29,51%), INAIL 140 €, TFR 2.417,59 €, fondi contrattuali 191 €, **costo totale 48.078,26 €**, pari a 1,3737 volte la RAL.

### La metrica esposta in interfaccia

Il moltiplicatore costo/RAL è quasi una costante sotto il massimale: comunicarlo aggiunge poco. `summariseEmploymentCost()` unisce i due motori senza accoppiarli e calcola la quota che arriva davvero al dipendente, che invece cambia molto: 56,8% a RAL 30.000, 54,2% a 35.000, 45,6% a 60.000.

### Coerenza dichiarata tra i due motori

Il 9,19% usato per il netto è la quota del lavoratore in un'azienda senza contribuzione a fondi di integrazione salariale. Scegliendo uno scenario diverso, la quota implicita sale: 9,36% con il FIS ridotto, 9,46% con il FIS pieno, 9,49% e oltre dove c'è anche la CIGS. Il risultato espone `impliedEmployeeRate` e `matchesEngineEmployeeRate`, e l'interfaccia mostra un avviso invece di nascondere la differenza.

### Cosa resta fuori

Previdenza complementare, premi, welfare, quattordicesima, contributo addizionale NASpI sui contratti a termine, ticket di licenziamento, oscillazione del tasso INAIL per andamento infortunistico, apprendistato e qualifica dirigenziale, che dipende da fondi contrattuali non riconducibili a una percentuale. Gli esoneri contributivi non sono modellati: agiscono su una sola delle quattro voci, la quota INPS a carico azienda, con un tetto mensile riparametrato, e non toccano mai INAIL, TFR né la quota del lavoratore.

## Verifica automatica

I test coprono:

- tutti gli scaglioni IRPEF, la soglia contributiva aggiuntiva e la coerenza tra segmenti e totale
- transizioni delle detrazioni a 15.000 € (salto della detrazione art. 13), 20.000 € (dalla somma non imponibile all'ulteriore detrazione), 25.000-28.000 € (maggiorazione di 65 €), 36.000 € (fase decrescente) e 40.000 € (azzeramento), più il trattamento integrativo a RAL 16.518/16.519
- golden case calcolati a mano dalla norma: RAL 30.000, 35.000 e 60.000 a Milano, 35.000 a Roma
- esenzione comunale, aliquote pubblicate e scaglioni per città rappresentative, inclusi i record MEF ripristinati
- eccezioni di Friuli, Valle d’Aosta, Trento, Lazio, Umbria e Bolzano, con i relativi salti di soglia
- link alla scheda MEF sull’anno della regola, ricerca con apostrofi e omonimi
- invarianti del registro comunale (`src/lib/dataset.test.ts`)
- costo azienda: scomposizione voce per voce nei due settori, somma sempre uguale al totale, massimale IVS, aliquota implicita del lavoratore e quota di netto sul costo (`src/lib/employerCost.test.ts`)

## Limiti noti

- non è un motore mensile di payroll: netto per competenza, non per cassa
- nessun ragguaglio ai giorni di lavoro: detrazioni e somma non imponibile sono calcolate su anno intero (per un assunto a metà anno il netto è sovrastimato)
- nessuna gestione di familiari, oneri, altri redditi o bonus individuali
- nessuna distinzione per CCNL, qualifica, fondo o dimensione aziendale (9,19% come proxy del 9,49% CIGS)
- premi, welfare e fringe benefit restano fuori da entrambi i motori; il costo azienda vive in un modulo separato, con i limiti dichiarati al paragrafo 10
- non modellate le imposte sostitutive 2026 della L. 199/2025 (5% sugli incrementi da rinnovo CCNL per redditi ≤ 33.000 €, 15% su notturni, festivi e turni fino a 1.500 €, 1% sui premi di risultato fino a 5.000 €) né l’esonero IVS per le madri di tre o più figli (L. 213/2023, fino al 31 dicembre 2026)
- i casi comunali specifici sono una stima per il profilo standard, non una codifica integrale della delibera
- quattro voci non hanno una regola utilizzabile (Castegnero Nanto, di recente istituzione, e tre Comuni la cui delibera 2025 è dichiarata inapplicabile dal MEF): il netto è calcolato senza addizionale comunale e l'interfaccia lo dichiara
- riferimenti normativi validi per il periodo d’imposta 2026: dal 1° gennaio 2027 le stesse disposizioni sono ricodificate nel Testo unico delle imposte sui redditi (D.Lgs. 117/2026)

## Fonti primarie

- [Normattiva, Legge 199/2025 (bilancio 2026)](https://www.normattiva.it/eli/stato/LEGGE/2025/12/30/199/CONSOLIDATED)
- [Normattiva, Legge 207/2024 (somma e ulteriore detrazione)](https://www.normattiva.it/eli/stato/LEGGE/2024/12/30/207/CONSOLIDATED)
- [Normattiva, D.L. 3/2020 art. 1 (trattamento integrativo)](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legge:2020-02-05;3~art1)
- [Normattiva, D.Lgs. 360/1998 art. 1 (addizionale comunale)](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1998-12-28;360~art1)
- [Normattiva, D.Lgs. 446/1997 art. 50 (addizionale regionale)](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.legislativo:1997-12-15;446~art50)
- [Normattiva, DPR 600/1973 art. 23 (ritenute e conguaglio; vigente per il 2026, abrogato dal 1° gennaio 2027 e confluito nel D.Lgs. 33/2025)](https://www.normattiva.it/uri-res/N2Ls?urn:nir:stato:decreto.del.presidente.della.repubblica:1973-09-29;600~art23)
- [Legge 296/2006, art. 1 c. 169 (proroga delle aliquote)](https://www.parlamento.it/parlam/leggi/06296l.htm)
- [INPS, circolare n. 6 del 30 gennaio 2026, par. 5 e 6](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html)
- [Agenzia delle Entrate, circolare 4/E del 16 maggio 2025](https://www.agenziaentrate.gov.it/portale/documents/20143/8410823/Circolare+lavoro+dipendente+LB2025+DD+IRPEF+n.+4+del+16+maggio+2025.pdf/36979eaa-9fc5-a4ec-a7aa-136497c53f91)
- [MEF, addizionali regionali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/tabella.htm)
- [MEF, addizionali comunali](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm)
