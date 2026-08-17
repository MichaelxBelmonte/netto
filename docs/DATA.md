# Provenienza e qualità dei dati

Questa nota rende riproducibile lo snapshot territoriale usato dal prototipo.

## Snapshot

- anno fiscale: 2026
- generato: 17 agosto 2026
- registro comunale: 7.897 righe MEF
- regole pubblicate per il 2026: 3.015
- fallback dichiarati al 2025: 4.881
- casi specifici segnalati: 1.487
- righe irrisolte: 1
- addizionali regionali: ultimo aggiornamento MEF 19 giugno 2026

Il conteggio del registro fiscale non coincide con il numero dei Comuni correnti. [ISTAT indica 7.894 Comuni](https://www.istat.it/classificazione/codici-dei-comuni-delle-province-e-delle-regioni/) dal 21 febbraio 2026; il file MEF conserva anche codici coinvolti nelle fusioni amministrative.

## Fonti acquisite

La pipeline usa esclusivamente file istituzionali:

1. [CSV MEF addizionali comunali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno=2026)
2. [CSV MEF addizionali comunali 2025](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/download.php?anno=2025)
3. [CSV MEF addizionali regionali 2026](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/addregirpef/download/download.php?anno=2026&tipo=reg)

Il [MEF documenta il formato](https://www1.finanze.gov.it/finanze2/dipartimentopolitichefiscali/fiscalitalocale/nuova_addcomirpef/download/tabella.htm), i valori `FLAG_NUOVA` e il significato di `0*`. Prima del 20 dicembre, `0*` può indicare che la delibera dell’anno non è ancora pubblicata; il prototipo non lo interpreta automaticamente come aliquota zero.

## Trasformazione

`scripts/build-tax-data.mjs`:

1. scarica o legge i CSV 2026 e 2025
2. normalizza denominazioni, importi e percentuali italiane
3. collega ogni provincia a una delle 21 giurisdizioni regionali
4. interpreta aliquota unica, soglia generale e scaglioni IRPEF
5. usa il 2026 quando è pubblicato
6. in assenza del 2026, cerca lo stesso codice nel 2025 e marca il record come fallback
7. conserva un flag per delibere con condizioni specifiche
8. genera il JSON applicativo e un file di metadati verificabile

Esecuzione:

```bash
npm run data:update
```

Output:

- `src/data/municipal-tax-2026.json`
- `src/data/tax-data-meta.json`

## Politica sui casi speciali

Le delibere possono prevedere esenzioni per ISEE, pensione, disabilità, nucleo o specifiche categorie reddituali. Il parser applica solo le soglie riconoscibili come generali per il lavoratore standard. Le condizioni personali non vengono assunte.

Un record speciale:

- resta selezionabile
- mostra “caso speciale” accanto alla provenienza
- rimanda alla scheda MEF del Comune
- va considerato una stima standard, non la trascrizione integrale della delibera

## Fallback e fusioni

Il fallback 2025 è un’operazione di prodotto esplicita, utile durante l’anno mentre il registro 2026 viene completato. L’interfaccia mostra sempre l’anno effettivamente usato.

Castegnero Nanto, istituito nel 2026, non può ereditare automaticamente una delle due aliquote dei Comuni preesistenti perché erano diverse. Il record resta quindi marcato come “dato in aggiornamento” invece di inventare una regola.

## Aggiornabilità

Lo snapshot è versionato nel repository per rendere build e test deterministici. Un aggiornamento dei CSV produce un diff leggibile nei metadati e può essere verificato prima del rilascio.
