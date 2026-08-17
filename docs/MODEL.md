# Modello di calcolo

Anno fiscale modellato: **2026**. Profilo: dipendente privato a tempo indeterminato, intero anno, nessun familiare a carico e nessun altro reddito o onere personale.

Il motore è implementato in `src/lib/tax.ts`; le regole territoriali sono isolate in `src/lib/localTaxes.ts`. Gli importi sono arrotondati ai centesimi dopo i passaggi principali.

## 1. Contributi del dipendente

Nel caso standard viene stimata una quota base del 9,19% della RAL. Alla parte eccedente 56.224 € viene aggiunto l’1%.

```text
contributi = RAL × 9,19% + max(0, RAL − 56.224) × 1%
```

È la principale semplificazione previdenziale: qualifica, dimensione aziendale, fondo, CCNL e aliquote speciali possono cambiare il valore reale.

## 2. Imponibile fiscale

```text
imponibile = RAL − contributi dipendente
```

Il prototipo assume che tutta la RAL inserita sia retribuzione ordinaria imponibile.

## 3. IRPEF lorda 2026

L’imposta è progressiva:

- 23% fino a 28.000 €
- 33% sulla parte tra 28.000 € e 50.000 €
- 43% sulla parte oltre 50.000 €

Ogni aliquota si applica solo alla porzione di imponibile compresa nello scaglione.

## 4. Detrazione da lavoro dipendente

- fino a 15.000 €: 1.955 €
- da 15.000 € a 28.000 €: `1.910 + 1.190 × (28.000 − reddito) / 13.000`
- da 28.000 € a 50.000 €: `1.910 × (50.000 − reddito) / 22.000`
- oltre 50.000 €: 0 €

Tra 25.000 € e 35.000 € viene aggiunta la maggiorazione di 65 €. La detrazione viene limitata all’IRPEF lorda disponibile.

## 5. Misure sul cuneo fiscale

Per imponibili fino a 20.000 € viene stimata la somma non imponibile prevista per il lavoro dipendente:

- 7,1% fino a 8.500 €
- 5,3% oltre 8.500 € e fino a 15.000 €
- 4,8% oltre 15.000 € e fino a 20.000 €

Oltre 20.000 € viene calcolata l’ulteriore detrazione:

- 1.000 € oltre 20.000 € e fino a 32.000 €
- riduzione lineare da 1.000 € a 0 € oltre 32.000 € e fino a 40.000 €
- 0 € oltre 40.000 €

Il trattamento integrativo è modellato nel caso standard fino a 15.000 €, con la verifica di capienza prevista dalla norma. Le detrazioni non possono generare IRPEF negativa.

## 6. Addizionale regionale

Sono presenti le aliquote 2026 di 19 Regioni e delle Province autonome di Trento e Bolzano: 21 giurisdizioni fiscali. Il calcolo progressivo usa gli stessi confini di reddito pubblicati dal MEF.

Sono gestite esplicitamente anche le regole che non si riducono a quattro aliquote:

- Friuli Venezia Giulia: 0,70% sull’intero reddito fino a 15.000 €, 1,23% sull’intero reddito oltre la soglia
- Valle d’Aosta: esenzione fino a 15.000 €, poi 1,23% sull’intero reddito
- Provincia di Trento: deduzione di 30.000 € fino a quella soglia
- Lazio: aliquota 1,73% sull’intero reddito fino a 28.000 € e detrazione di 60 € tra 28.001 € e 30.000 €
- Umbria: aliquota 1,23% sull’intero reddito fino a 28.000 € e detrazione di 150 € tra 28.001 € e 50.000 €
- Provincia di Bolzano: detrazione standard di 430,50 € fino a 90.000 € e ulteriore detrazione progressiva fino a 125 € oltre 50.000 €

Le agevolazioni regionali per figli, disabilità o altre condizioni personali sono fuori dal profilo standard.

## 7. Addizionale comunale

Il Comune scelto porta con sé:

- codice catastale, provincia e giurisdizione regionale
- anno della regola applicata
- soglia di esenzione generale
- aliquota unica o scaglioni progressivi
- indicatore di caso specifico

Se il reddito non supera una soglia di esenzione generale, l’addizionale è zero sull’intero imponibile: la soglia non è trattata come franchigia. Altrimenti vengono applicate le aliquote pubblicate.

Se il MEF non espone ancora una delibera 2026 (`0*`), la pipeline cerca la regola 2025 per lo stesso codice e la marca come **fallback 2025**. Non viene presentata come delibera 2026. I casi specifici MEF restano segnalati in UI e sono interpretati per il profilo standard; la scheda ufficiale è sempre raggiungibile dal risultato.

## 8. Condizione di debenza

Le addizionali locali vengono calcolate solo quando resta IRPEF netta positiva dopo le detrazioni modellate.

## 9. Risultato e riconciliazione

```text
tasse = IRPEF netta + addizionale regionale + addizionale comunale
trattenute = contributi dipendente + tasse
netto annuale = RAL − trattenute + benefici fiscali
netto per mensilità = netto annuale / mensilità selezionate
```

Le 12, 13 o 14 mensilità cambiano solo la distribuzione del netto annuale. Non viene simulata la diversa imposizione operativa delle singole buste paga o dei conguagli.

L’indicatore “prossimi 1.000 € lordi” ricalcola l’intero modello a `RAL + 1.000` e mostra la differenza di netto annuale. Non è una semplice aliquota marginale teorica: include la perdita o l’acquisizione delle detrazioni attraversate.

## Verifica automatica

I test coprono:

- tutti gli scaglioni IRPEF e la soglia contributiva aggiuntiva
- transizioni delle detrazioni a 20.000 €, 28.000 € e 40.000 €
- esenzione comunale e aliquote pubblicate per città rappresentative
- eccezioni di Friuli, Valle d’Aosta, Trento, Lazio, Umbria e Bolzano
- coerenza della riconciliazione annuale
- variazione del risultato al cambiare della residenza

## Limiti noti

- non è un motore mensile di payroll
- nessuna gestione di familiari, oneri, altri redditi o bonus individuali
- nessuna distinzione per CCNL, qualifica, fondo o dimensione aziendale
- esclusi TFR, premi, welfare, fringe benefit e contribuzione datoriale
- nessuna gestione del recupero delle addizionali su anni differenti
- i casi comunali specifici sono una stima per il profilo standard, non una codifica integrale della delibera
- il nuovo Comune di Castegnero Nanto non ha uno storico omogeneo nel registro: il dato è marcato in aggiornamento

## Fonti primarie

- [Normattiva, Legge 199/2025](https://www.normattiva.it/eli/stato/LEGGE/2025/12/30/199/CONSOLIDATED)
- [Normattiva, Legge 207/2024](https://www.normattiva.it/eli/stato/LEGGE/2024/12/30/207/CONSOLIDATED)
- [INPS, circolare n. 6 del 30 gennaio 2026](https://www.inps.it/it/it/inps-comunica/atti/circolari-messaggi-e-normativa/dettaglio.circolari-e-messaggi.2026.01.circolare-numero-6-del-30-01-2026_15151.html)
- [MEF, addizionali regionali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/tabella.htm)
- [MEF, addizionali comunali](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm)
