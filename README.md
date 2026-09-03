# netto.

Un prototipo nazionale che trasforma una RAL in una stima leggibile del netto 2026, mostrando contributi, IRPEF e addizionali del luogo di residenza.

[Apri la demo live](https://michaelxbelmonte.github.io/netto/)

Il progetto nasce per il task del ruolo AI Builder di Jet HR. La scelta distintiva è portare la provenienza del dato dentro l’esperienza: ogni Comune mostra l’anno della regola usata, spiega perché, e rimanda alla relativa scheda MEF aperta su quell’anno.

## Cosa fa

- calcola netto annuale e medio su 12, 13 o 14 mensilità, dichiarando la formula
- cerca la residenza fiscale nell’intero registro MEF: 7.897 voci fiscali, con le denominazioni ufficiali ISTAT e gli alias d’uso comune (Reggio Emilia, Bozen)
- applica le regole 2026 delle 21 giurisdizioni regionali italiane
- espone contributi INPS, imponibile, IRPEF, addizionali e bonus fiscali in busta
- confronta la stessa RAL tra città e rende visibile l’effetto della fiscalità locale
- offre un atlante fiscale interattivo, visibile anche senza aver scelto un Comune
- mostra quanto resta dei successivi 1.000 € lordi
- confronta due RAL mantenendo invariati Comune e mensilità
- scarica un report PDF visuale con riconciliazione, confronto RAL e Comuni, costo aziendale e grafici
- offre una pagina “Chiedi a netto.”: risposte rapide deterministiche e tre modelli locali selezionabili via WebGPU — Gemma 3 270M, Qwen 2.5 0.5B e Qwen 3.5 0.8B
- affianca il costo per l’azienda: contributi a suo carico, INAIL e TFR per settore e dimensione, e la quota del costo che arriva netta al dipendente
- collega norme, dataset e scheda MEF del Comune selezionato
- genera un link condivisibile del calcolo (`?ral=35000&comune=F205&mensilita=13`, con `&lang=en` per l’inglese)
- funziona in italiano e inglese, con un flusso mobile dedicato

## Copertura dei dati

Snapshot generato il 3 settembre 2026. Il registro MEF cambia ogni giorno: i valori valgono per quella data e vivono in `src/data/tax-data-meta.json`.

| Voce | Copertura |
| --- | ---: |
| Righe nel registro fiscale MEF | 7.897 |
| Regole con delibera 2026 acquisita | 3.133 |
| Regole 2025 prorogate per legge | 4.760 |
| Voci senza addizionale nel dato interpretato | 969 |
| Regole specifiche segnalate in UI | 1.490 |
| Scaglioni ricostruiti da una fascia MEF duplicata | 2 |
| Voci senza regola utilizzabile | 4 |

ISTAT conta 7.894 Comuni correnti dal 21 febbraio 2026. Il registro fiscale MEF ne elenca 7.897 perché conserva anche i codici delle aggregazioni recenti: Castegnero e Nanto, confluiti in Castegnero Nanto, e Lirio, incorporato in Montalto Pavese. Per questo l’interfaccia parla di «voci fiscali», non di Comuni correnti.

Quando un Comune non delibera, aliquote e soglie «si intendono prorogate di anno in anno» (L. 296/2006, art. 1 c. 169) e una nuova delibera vale per l’anno solo se pubblicata sul portale MEF entro il 20 dicembre. Le regole 2025 non sono quindi una stima ma il comportamento previsto dalla legge; l’interfaccia lo spiega accanto a ogni risultato.

La pipeline riproducibile è descritta in [docs/DATA.md](docs/DATA.md). Le formule, le eccezioni regionali e i limiti sono in [docs/MODEL.md](docs/MODEL.md).

## Perimetro del prototipo

Il caso calcolato è un dipendente del settore privato, a tempo indeterminato, impiegato per l’intero anno e senza familiari a carico, altri redditi o detrazioni personali. Il risultato è un netto per competenza annuale: il cedolino distribuisce le stesse somme in modo diverso (tredicesima senza detrazioni, addizionali in acconto e saldo, conguaglio).

La residenza non è fissata a Milano: l’utente sceglie il Comune. Restano esclusi premi, welfare, fringe benefit, fondi e aliquote previdenziali speciali (il 9,19% è la regola generale; nelle aziende soggette a CIGS è 9,49%). Le regole locali legate a condizioni personali sono segnalate come casi speciali e calcolate sul profilo standard.

Il costo azienda è calcolato a parte, su RAL 35.000 € vale 48.078 € per un impiegato del commercio in un’azienda da 6 a 15 dipendenti. Le aliquote a carico del datore non sono però pubblicate dall’INPS in una tabella analitica aggiornata: le voci ricostruite dall’ultima disponibile sono marcate come tali nell’interfaccia, e gli esoneri contributivi non sono modellati.

## Avvio e verifica

```bash
npm install
npm run dev
```

```bash
npm run check
npm test
npm run build
```

Per rigenerare lo snapshot comunale dai CSV ufficiali (download automatico, oppure con file locali):

```bash
npm run data:update
node scripts/build-tax-data.mjs comunali-2026.csv comunali-2025.csv Elenco-comuni-italiani.csv
```

Per rigenerare i confini geografici dal pacchetto ufficiale ISTAT:

```bash
npm run map:update
```

## Architettura

- `src/lib/tax.ts`: motore nazionale, funzione pura senza dipendenze dalla UI
- `src/lib/localTaxes.ts`: aliquote regionali, ricerca per rilevanza e calcolo comunale
- `src/lib/employerCost.ts`: costo del lavoro a carico dell’azienda, con la fonte e il livello di confidenza di ogni voce
- `src/lib/salaryComparison.ts`: differenze tra due proiezioni sullo stesso profilo fiscale
- `src/lib/salaryReport.ts`: modello e generazione lazy del riepilogo PDF
- `src/lib/assistantContext.ts`: contesto verificato e risposte rapide dell’assistente
- `src/workers/nettoAssistant.worker.ts`: caricamento e inferenza locale di Gemma fuori dal thread della UI
- `src/components/AssistantPage.tsx`: pagina chat, consenso al download e fallback senza WebGPU
- `src/components/TaxMap.tsx`: proiezione SVG, distribuzione e selezione territoriale
- `src/data/`: snapshot fiscali, metadati e confini ISTAT semplificati
- `scripts/build-tax-data.mjs`: download, normalizzazione, validazione degli scaglioni, regola 2025 e quality flags
- `scripts/build-map-data.mjs`: download, riproiezione e semplificazione dei confini
- `src/lib/*.test.ts`: golden case calcolati dalla norma, soglie nazionali, eccezioni regionali, ricerca e invarianti del registro

React e TypeScript gestiscono l’interfaccia; Vite e Vitest coprono build e test. Tutti i dati restano nel browser: la ricerca del Comune non invia la RAL a un backend.

L’assistente non calcola tasse autonomamente: interpreta la richiesta, estrae uno o più scenari e li fa ricalcolare dai motori verificati. Il modello locale selezionato riceve la domanda originale, i risultati autorevoli e una bozza numerica deterministica, e li trasforma in una risposta naturale senza poter sostituire i valori del motore. I follow-up mantengono gli input precedenti, mentre la lingua viene rilevata a ogni messaggio con italiano predefinito nei casi ambigui. Se il modello è spento, WebGPU non è disponibile o l’output contiene numeri non autorizzati, l’interfaccia usa il fallback deterministico verificato. La chat importa Transformers.js 4.2.0 da una CDN versionata e permette di scegliere tra `onnx-community/gemma-3-270m-it-ONNX`, `onnx-community/Qwen2.5-0.5B-Instruct` e `onnx-community/Qwen3.5-0.8B-ONNX-OPT`, in formato Q4F16. Il download avviene solo dopo consenso e resta nella cache del browser. Gemma è il default più leggero; i due Qwen privilegiano qualità e instruction following con download maggiori. Nessuna RAL viene inviata a un servizio di inferenza; senza WebGPU resta disponibile il fallback deterministico.

## Verifica del 2 e 3 settembre 2026

Il 2 e 3 settembre 2026 il motore è stato riletto contro le fonti primarie (TUIR artt. 11 e 13, L. 199/2025, L. 207/2024, D.L. 3/2020, circolare INPS 6/2026) e i risultati per RAL 30.000, 35.000 e 60.000 a Milano e 35.000 a Roma sono stati ricalcolati a mano dalla norma, voce per voce, con differenza nulla; quei valori sono ora fissati nei test come golden case. Le 21 aliquote regionali sono state confrontate con il CSV MEF scaricato in quei giorni e i venti Comuni più popolosi con le rispettive righe del registro. Nessuna delle due verifiche è versionata nel repository: i CSV non sono committati. Correzioni applicate nella stessa verifica:

- link alla scheda MEF con l’anno della regola (prima apriva una pagina vuota per i Comuni senza delibera 2026)
- validazione degli scaglioni nella pipeline, con il confine mancante ricostruito dalla descrizione della fascia successiva (tre record MEF con fasce duplicate o formato numerico anomalo)
- delibere dichiarate «inapplicabili» dal MEF scartate in entrambi gli anni: cinque Comuni, di cui tre restano senza regola invece di ereditare un’aliquota mai entrata in vigore
- importi come «185,92» non più letti come 18.592 €: due soglie di esenzione erano quattro volte il valore reale
- soglia di allarme della pipeline portata al tetto ordinario dello 0,8%, con l’elenco esplicito dei Comuni in deroga
- trattamento integrativo verificato sulla detrazione teorica: sotto circa 9.360 € di RAL (imponibile 8.500 €) il bonus veniva riconosciuto anche a chi per legge non ne ha diritto, fuori dall’intervallo accettato dall’interfaccia ma sbagliato nel motore
- ricerca tollerante ad apostrofi tipografici, ordinata per rilevanza e con alias: le denominazioni ufficiali ISTAT non rendono più introvabili Reggio Emilia, Reggio Calabria e i Comuni bilingui
- testi dell’interfaccia: data dello snapshot al posto di «aggiornamento quotidiano», spiegazione della regola locale, formula del netto mensile
- link condivisibile, contrasto dei colori su sfondo chiaro, mappa non più nel percorso da tastiera

## Fonti primarie

- [Normattiva — Legge 199/2025, aliquote IRPEF 2026](https://www.normattiva.it/eli/stato/LEGGE/2025/12/30/199/CONSOLIDATED)
- [Normattiva — Legge 207/2024, detrazioni e cuneo fiscale](https://www.normattiva.it/eli/stato/LEGGE/2024/12/30/207/CONSOLIDATED)
- [INPS — circolare n. 6/2026, par. 5 (prima fascia 56.224 €) e 6 (massimale 122.295 €)](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html)
- [MEF — registro delle addizionali comunali](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm)
- [MEF — addizionali regionali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/tabella.htm)
- [ISTAT — codici delle unità amministrative](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/)
- [ISTAT — elenco dei Comuni italiani](https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv)
- [ISTAT — confini amministrativi al 1° gennaio 2026](https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/)

## Brand

Il marchio è stato generato con GPT Image 2 e rifinito per funzionare come segno minimale anche a piccole dimensioni. Il file di produzione è `src/assets/netto-mark-v3-crop.png`.

## Avvertenza

Il risultato è una proiezione informativa e annuale. Non sostituisce un cedolino, un preventivo payroll o una consulenza fiscale.
