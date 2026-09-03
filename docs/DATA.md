# Provenienza e qualità dei dati

Questa nota rende riproducibile lo snapshot territoriale usato dal prototipo.

## Snapshot

Valori dello snapshot versionato, generati il **3 settembre 2026** e leggibili in `src/data/tax-data-meta.json`:

- anno fiscale: 2026
- registro comunale: 7.897 righe MEF
- regole con delibera 2026 acquisita: 3.133
- regole 2025 prorogate per legge (nessuna delibera 2026 acquisita): 4.760
- voci senza addizionale nel dato interpretato: 969
- casi specifici segnalati: 1.490
- voci senza regola utilizzabile: 4
- scaglioni ricostruiti da una fascia MEF duplicata: 2 (Airuno, Bentivoglio)
- record in quarantena: 0
- denominazioni ufficiali ISTAT applicate: 7.896
- alias di ricerca generati: 135
- addizionali regionali: ultimo aggiornamento MEF 19 giugno 2026

Il registro MEF cambia ogni giorno: questi numeri valgono per la data di generazione, non in assoluto. Ogni `npm run data:update` li aggiorna nel file dei metadati, e questa sezione va riallineata insieme al JSON.

Il conteggio del registro fiscale non coincide con il numero dei Comuni correnti. [ISTAT indica 7.894 Comuni](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/) dal 21 febbraio 2026, mentre il registro MEF ne elenca 7.897 perché conserva anche i codici delle aggregazioni recenti: Castegnero (C056) e Nanto (F838), confluiti in Castegnero Nanto (M439), e Lirio (E608), incorporato in Montalto Pavese il 31 gennaio 2026. L'elenco ISTAT scaricato dalla pipeline contiene 7.896 voci, cioè la fotografia anteriore a quelle variazioni: l'unico codice MEF privo di nome ISTAT è M439, per il quale si usa la denominazione del registro fiscale.

### Le quattro voci senza regola

Tre Comuni (Capitignano, Pisano, Varco Sabino) hanno una delibera 2025 che il MEF marca «ALIQUOTE INAPPLICABILI»: varrebbe la regola 2024, che questa pipeline non scarica, quindi il record resta senza regola invece di mostrare un'aliquota mai entrata in vigore. Il quarto è Castegnero Nanto, istituito il 21 febbraio 2026 e non ancora presente nel registro con una propria delibera.

### Cosa è cambiato rispetto allo snapshot precedente

Confronto tra lo snapshot del 17 agosto 2026 (primo commit) e quello del 3 settembre:

| Differenza | Record |
| --- | ---: |
| Regola o soglia di esenzione cambiata | 22 |
| Solo anno della regola cambiato | 110 |
| Denominazione cambiata (adozione dei nomi ISTAT) | 436 |

Delle 22 regole cambiate, circa la metà deriva da nuove delibere pubblicate dal MEF nelle tre settimane, l'altra metà dalle correzioni della pipeline descritte più sotto. Nessuna riguarda un capoluogo di provincia.

## Fonti acquisite

La pipeline scarica automaticamente:

1. [CSV MEF addizionali comunali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno=2026)
2. [CSV MEF addizionali comunali 2025](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno=2025)
3. [Elenco dei Comuni italiani ISTAT](https://www.istat.it/storage/codici-unita-amministrative/Elenco-comuni-italiani.csv), per le denominazioni ufficiali e gli alias in lingua locale

Sono invece **consultate a mano e trascritte nel codice**, non scaricate da uno script:

4. [CSV MEF addizionali regionali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/tabella.htm): le 21 giurisdizioni regionali vivono in `src/lib/localTaxes.ts` perché sei di esse hanno regole (deduzioni, detrazioni fisse, aliquote sull'intero reddito) che non si riducono a una tabella di scaglioni. Un cambio in corso d'anno richiede un aggiornamento manuale.
5. [Confini amministrativi generalizzati ISTAT al 1° gennaio 2026](https://www.istat.it/notizia/confini-delle-unita-amministrative-a-fini-statistici-al-1-gennaio-2018-2/): li scarica `scripts/build-map-data.mjs`, non la pipeline fiscale.

Il [MEF documenta il formato](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm) e il significato di `0*`, che indica un Comune senza delibera acquisita per l'anno. La pipeline non legge quel marcatore: guarda il numero di delibera e la nota della riga, che sono i campi su cui il MEF stesso costruisce l'elenco.

## Trasformazione

`scripts/build-tax-data.mjs`, nell'ordine in cui opera:

1. scarica o legge i CSV comunali 2026 e 2025 e l'elenco ISTAT dei Comuni
2. per ogni codice catastale sceglie la riga da usare: quella 2026 se ha una delibera acquisita e non dichiarata inapplicabile, altrimenti quella 2025 alle stesse condizioni, altrimenti nessuna
3. interpreta la riga scelta: aliquota unica o scaglioni, soglia di esenzione generale, flag dei casi specifici, normalizzando gli importi in formato italiano (`15.000,00`), anglosassone (`15000.00`) o con spazio
4. valida gli scaglioni: limiti crescenti e ultimo scaglione aperto
5. se un limite è duplicato o mancante, lo ricostruisce dalla descrizione della fascia successiva, che cita il proprio limite inferiore; se non è ricostruibile, prova la riga dell'altro anno; se fallisce anche quella, mette il record in quarantena senza regola
6. collega la provincia a una delle 21 giurisdizioni regionali
7. sostituisce la denominazione MEF in maiuscolo con quella ufficiale ISTAT e conserva come alias di ricerca il nome MEF e la forma in lingua locale
8. ordina per nome e calcola i contatori sul risultato finale
9. avvisa se un'aliquota supera il tetto ordinario dello 0,8% senza una deroga nota, o se un importo del MEF risulta illeggibile
10. genera il JSON applicativo e il file di metadati

Esecuzione:

```bash
npm run data:update
# oppure, con file locali già scaricati:
node scripts/build-tax-data.mjs comunali-2026.csv comunali-2025.csv Elenco-comuni-italiani.csv
```

Output:

- `src/data/municipal-tax-2026.json`
- `src/data/tax-data-meta.json`

## Controlli di qualità

`src/lib/dataset.test.ts` verifica a ogni esecuzione dei test che il registro rispetti le proprietà su cui il motore si basa:

- codici catastali unici e contatori dei metadati coerenti con i record
- per ogni regola: scaglioni con limiti strettamente crescenti, ultimo scaglione aperto, aliquote entro il tetto ordinario dello 0,8% salvo i Comuni con deroga di legge riconosciuta
- i record senza regola utilizzabile restano vuoti, così non viene inventata alcuna addizionale
- registro ordinato per nome
- denominazioni ISTAT applicate, con Bolzano e non «Bolzano/Bozen» come etichetta, e Bozen tra gli alias
- ricercabilità dei nomi d'uso comune (Reggio Emilia, Reggio Calabria, Bozen)

I casi che hanno motivato questi controlli, tutti trovati rileggendo il registro il 2 e 3 settembre 2026:

- Airuno e Bentivoglio hanno nel CSV 2026 la fascia 15.000–28.000 ripetuta due volta per un errore di inserimento: il motore tassava la fascia 28.000–50.000 con l'aliquota massima.
- Dolcè scrive gli importi come `15000.00`: il parser li scartava e applicava una sola aliquota a tutto il reddito.
- Grumo Nevano e Pietrafitta indicano l'esenzione con un numero che il vecchio parser leggeva come 18.592 €, cioè quattro volte il valore reale.
- Bova e Campana hanno una delibera 2026 che il MEF dichiara inapplicabile, Capitignano, Pisano e Varco Sabino una del 2025.

## Geografia della mappa

`scripts/build-map-data.mjs` scarica il pacchetto generalizzato ISTAT 2026, usa il livello provinciale e delle città metropolitane, lo riproietta da UTM 32N a WGS84 e conserva l'8% dei vertici con mantenimento delle forme. Il risultato contiene 110 aree e viene salvato in `src/data/italy-provinces-2026.json`.

Il livello provinciale consente di trattare separatamente le Province autonome di Trento e Bolzano, che hanno regole fiscali regionali diverse. Il colore di ogni area rappresenta la mediana delle addizionali regionali e comunali dei record MEF collegati, ricalcolata nel browser sulla RAL corrente.

Nel 2026 i confini ISTAT della Sardegna riflettono il nuovo assetto provinciale, mentre alcuni record fiscali MEF usano ancora codici territoriali precedenti. Quando il join provinciale non è omogeneo, l'interfaccia mantiene il perimetro geografico ma filtra correttamente a livello regionale, senza inventare una corrispondenza tra codici.

Rigenerazione:

```bash
npm run map:update
```

## Politica sui casi speciali

Le delibere possono prevedere esenzioni per ISEE, pensione, disabilità, nucleo o specifiche categorie reddituali. Il parser applica solo le soglie riconoscibili come generali per il lavoratore standard. Le condizioni personali non vengono assunte.

Un record speciale:

- resta selezionabile
- mostra «caso speciale» accanto alla provenienza, con una riga di spiegazione
- rimanda alla scheda MEF del Comune, aperta sull'anno della regola usata
- va considerato una stima standard, non la trascrizione integrale della delibera

## Regola 2025 prorogata e fusioni

Quando un Comune non delibera entro il termine, «le tariffe e le aliquote si intendono prorogate di anno in anno» (L. 296/2006, art. 1 c. 169); una delibera di variazione ha effetto dal 1° gennaio solo se pubblicata sul sito MEF entro il 20 dicembre dello stesso anno (D.Lgs. 23/2011, art. 14 c. 8), e l'acconto in busta paga usa comunque le aliquote dell'anno precedente (D.Lgs. 360/1998, art. 1 c. 4). Usare la regola 2025 per i Comuni senza delibera 2026 è quindi il comportamento previsto dalla legge, non una stima: l'interfaccia mostra sempre l'anno della regola e ricorda che il Comune può ancora pubblicare entro il 20 dicembre.

Castegnero Nanto, istituito il 21 febbraio 2026, non può ereditare automaticamente una delle due aliquote dei Comuni preesistenti (0,65% e 0,75%). Il record resta marcato come «dato non disponibile»: il netto viene calcolato senza addizionale comunale e l'interfaccia lo dichiara. Nel registro MEF convivono ancora le tre voci, quindi cercando «Nanto» compaiono sia il Comune soppresso sia quello nuovo.

## Aggiornabilità

Lo snapshot è versionato nel repository per rendere build e test deterministici. Un aggiornamento dei CSV produce un diff leggibile nei metadati (`currentYearRules`, `fallbackRules`, `unresolved`, `repairedBrackets`, `quarantined`) e può essere verificato prima del rilascio. L'evoluzione naturale è un job notturno che riesegue la pipeline e apre una pull request con il diff, così i numeri di questa pagina non restano indietro rispetto al dato.
