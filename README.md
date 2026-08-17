# netto.

Un prototipo nazionale che trasforma una RAL in una stima leggibile del netto 2026, mostrando contributi, IRPEF e addizionali del luogo di residenza.

[Apri la demo live](https://michaelxbelmonte.github.io/netto/)

Il progetto nasce per il task Product Builder di Jet HR. La scelta distintiva è portare la provenienza del dato dentro l’esperienza: ogni Comune mostra l’anno della regola usata e rimanda alla relativa scheda MEF.

## Cosa fa

- calcola netto annuale e medio su 12, 13 o 14 mensilità
- cerca la residenza fiscale nell’intero registro MEF: 7.897 voci fiscali
- applica le regole 2026 delle 21 giurisdizioni regionali italiane
- espone contributi INPS, imponibile, IRPEF, addizionali e benefici fiscali
- confronta la stessa RAL tra città e rende visibile l’effetto della fiscalità locale
- offre un atlante fiscale interattivo, visibile anche senza aver scelto un Comune
- permette di filtrare un’area e applicare un Comune direttamente dalla mappa
- mostra quanto resta dei successivi 1.000 € lordi
- collega norme, dataset e scheda del Comune selezionato
- funziona in italiano e inglese, con un flusso mobile dedicato

“Quanto vali?” è dichiaratamente una preview: il risultato resta mascherato finché non esiste un dataset retributivo difendibile. Non vengono inventati benchmark per riempire una demo.

## Copertura dei dati

Snapshot generato il 17 agosto 2026:

| Voce | Copertura |
| --- | ---: |
| Righe nel registro fiscale MEF | 7.897 |
| Regole comunali pubblicate per il 2026 | 3.015 |
| Regole 2025 usate come fallback dichiarato | 4.881 |
| Voci senza addizionale nel dato interpretato | 966 |
| Regole specifiche segnalate in UI | 1.487 |
| Nuova entità senza storico omogeneo | 1 |

ISTAT conta 7.894 Comuni correnti dal 21 febbraio 2026. Il registro fiscale MEF contiene anche codici legati alle fusioni; per questo l’interfaccia parla correttamente di “voci fiscali”, non di Comuni correnti.

La pipeline riproducibile è descritta in [docs/DATA.md](docs/DATA.md). Le formule e le eccezioni regionali sono in [docs/MODEL.md](docs/MODEL.md).

## Perimetro del prototipo

Il caso calcolato è un dipendente del settore privato, a tempo indeterminato, impiegato per l’intero anno e senza familiari a carico, altri redditi o detrazioni personali.

La residenza non è più fissata a Milano: l’utente sceglie il Comune. Restano esclusi TFR, premi, welfare, fringe benefit, contribuzione datoriale, fondi e aliquote previdenziali speciali. Le regole locali legate a condizioni personali sono segnalate come casi speciali e calcolate sul profilo standard.

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

Per rigenerare lo snapshot comunale dai CSV ufficiali:

```bash
npm run data:update
```

Per rigenerare i confini geografici dal pacchetto ufficiale ISTAT:

```bash
npm run map:update
```

## Architettura

- `src/lib/tax.ts`: motore nazionale, funzione pura senza dipendenze dalla UI
- `src/lib/localTaxes.ts`: aliquote regionali, ricerca e calcolo comunale
- `src/components/TaxMap.tsx`: proiezione SVG, distribuzione e selezione territoriale
- `src/data/`: snapshot fiscali, metadati e confini ISTAT semplificati
- `scripts/build-tax-data.mjs`: download, normalizzazione, fallback e quality flags
- `scripts/build-map-data.mjs`: download, riproiezione e semplificazione dei confini
- `src/lib/*.test.ts`: test di soglie nazionali, eccezioni regionali e cambio residenza

React e TypeScript gestiscono l’interfaccia; Vite e Vitest coprono build e test. Tutti i dati restano nel browser: la ricerca del Comune non invia la RAL a un backend.

## Fonti primarie

- [Normattiva — Legge 199/2025, aliquote IRPEF 2026](https://www.normattiva.it/eli/stato/LEGGE/2025/12/30/199/CONSOLIDATED)
- [Normattiva — Legge 207/2024, detrazioni e cuneo fiscale](https://www.normattiva.it/eli/stato/LEGGE/2024/12/30/207/CONSOLIDATED)
- [INPS — circolare n. 6/2026](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html)
- [MEF — registro delle addizionali comunali](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm)
- [MEF — addizionali regionali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/tabella.htm)
- [ISTAT — codici delle unità amministrative](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/)
- [ISTAT — confini amministrativi al 1° gennaio 2026](https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/)

## Brand

Il marchio è stato generato con GPT Image 2 e rifinito per funzionare come segno minimale anche a piccole dimensioni. Il file di produzione è `src/assets/netto-mark-v3-crop.png`.

## Avvertenza

Il risultato è una proiezione informativa e annuale. Non sostituisce un cedolino, un preventivo payroll o una consulenza fiscale.
