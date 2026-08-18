# Database Coffee Break Monza

## CB-009A - Ordini con consegna e ritiro

La migrazione `migrations/007_orders.sql` predispone `orders` e `order_items`; il controllo associato e `checks/007_verify_orders.sql`. Il seed `seeds/007_orders.example.sql` e interamente commentato, usa soltanto dati fittizi e non viene eseguito automaticamente.

Applicare questi file soltanto dopo le migrazioni precedenti: revisionare la migrazione 007, applicarla manualmente nell'ambiente corretto e infine eseguire le query di sola lettura del controllo 007.

`orders` conserva stato, modalita di evasione, contatti, consegna, data richiesta e importi. `order_items` conserva quantita e snapshot di nome e prezzo del piatto. Le righe vengono eliminate insieme all'ordine; se il piatto originale viene eliminato, il riferimento facoltativo a `menu_items` diventa `null` e lo snapshot storico resta disponibile.

Le modalita sono `pickup` e `delivery`; gli stati sono `new`, `confirmed`, `preparing`, `ready`, `out_for_delivery`, `completed` e `cancelled`. Il pagamento e previsto al ritiro o alla consegna, coerentemente con la modalita scelta.

RLS e abilitata su entrambe le tabelle. CB-009A adotta la strategia B: `anon` non dispone di lettura o scrittura; gli utenti `authenticated` operano soltanto se presenti in `admin_users`. La creazione pubblica resta sospesa finche non verra progettata un'operazione server-side transazionale che validi righe, prezzi e totali senza esporre privilegi diretti o `service_role`.

Gli ordini contengono informazioni personali. Prima dell'uso reale devono essere definiti informativa, accessi operativi, tempi di conservazione e procedure di cancellazione. Il seed non deve essere usato per inserire dati reali. CB-009A non modifica il frontend.

## Obiettivo

## CB-009B.1 - Creazione transazionale degli ordini

La migrazione `migrations/008_create_order_function.sql` predispone la funzione RPC `public.create_public_order`. La funzione riceve modalità di evasione, dati essenziali del cliente, data e ora richieste e un array JSON di soli identificativi dei piatti, quantità e note di riga.

Nome, prezzo, disponibilità e importi non vengono accettati dal client: sono letti e calcolati lato database. La funzione seleziona i piatti disponibili in modo set-based, congela nome e prezzo nelle righe, calcola `subtotal`, applica una tariffa consegna interna di 2,50 euro e calcola `total`. Ordine e righe vengono inseriti nella stessa chiamata; qualsiasi errore annulla l'intera operazione.

La funzione usa `SECURITY DEFINER` perché `anon` continua a non avere accesso diretto a `orders` e `order_items`. La superficie è limitata dalla validazione rigorosa, non usa SQL dinamico e imposta `search_path` vuoto; tabelle, tipi e funzioni sono referenziati con schema esplicito. `EXECUTE` è revocato a `PUBLIC` e `authenticated` e concesso soltanto ad `anon`. Lo schema `private` non è esposto e non contiene funzioni pubbliche.

La tariffa di consegna è intenzionalmente una costante interna e dovrà diventare configurabile in una fase successiva. Prima del lancio pubblico sono inoltre necessari rate limiting nella futura Server Action o nell'infrastruttura, protezione anti-bot/CAPTCHA, limiti di payload e controllo della frequenza. La funzione SQL non simula queste protezioni e non registra dati personali.

Il controllo `checks/008_verify_create_order_function.sql` contiene soltanto query di lettura e non invoca la funzione. I 15 casi in `tests/008_test_create_order_function.example.sql` sono interamente commentati e richiedono un ambiente di test controllato.

## Panoramica generale

Questa cartella contiene lo schema PostgreSQL revisionabile per il futuro collegamento del sito a Supabase. I file non sono stati eseguiti su un database remoto.

## Ordine di esecuzione

Eseguire manualmente nel Supabase SQL Editor, dopo aver revisionato il contenuto:

1. `migrations/001_initial_schema.sql`
2. `seeds/001_initial_data.sql`
3. `checks/001_verify_schema.sql`

La migrazione e il seed sono racchiusi in transazioni. Il file di verifica contiene esclusivamente query di lettura.

Per CB-008A, dopo che le migrazioni 001–005 risultano applicate e verificate:

1. revisionare integralmente `migrations/006_daily_menus.sql`;
2. applicare manualmente la migrazione 006;
3. eseguire `checks/006_verify_daily_menus.sql` e confrontare i risultati attesi;
4. usare `seeds/006_daily_menus.example.sql` soltanto come riferimento documentale: tutte le istruzioni sono commentate.

## Tabelle

- `categories`: categorie ordinate del menu, identificate stabilmente tramite `slug`.
- `menu_items`: piatti, prezzo numerico, disponibilità e ordine di visualizzazione.
- `allergens`: elenco dei 14 allergeni codificati.
- `menu_item_allergens`: relazione molti-a-molti tra piatti e allergeni.
- `settings`: impostazioni estendibili in formato JSON, con distinzione tra valori pubblici e privati.
- `daily_menus`: un menu programmato per una data di servizio univoca, in stato `draft` o `published`.
- `daily_menu_items`: associazioni tra menu programmati e piatti dell’archivio, con ordine, disponibilità e prezzo specifici per la data.

## Relazioni

Ogni piatto appartiene a una categoria. L’eliminazione di una categoria è limitata quando contiene piatti. Le associazioni piatto-allergene vengono invece eliminate automaticamente quando viene eliminato uno dei record collegati.

Il seed non crea associazioni tra piatti e allergeni perché il progetto non contiene ancora dati affidabili in merito.

Descrizioni e immagini dei piatti restano `null` perché `website/src/data/menu.ts` non contiene ancora questi valori.

## Menu programmati per data

`daily_menus.service_date` usa il tipo PostgreSQL `date`: rappresenta il giorno di servizio nel fuso Europe/Rome senza memorizzare un orario o una timezone. Ogni data può comparire una sola volta. Lo stato `draft` mantiene il menu riservato agli amministratori, mentre `published` abilita la futura lettura pubblica.

`daily_menu_items` collega un menu giornaliero ai piatti già presenti in `menu_items`. La chiave primaria composta impedisce di aggiungere due volte lo stesso piatto allo stesso menu. Eliminando un menu giornaliero vengono eliminate automaticamente le sue associazioni; un piatto già usato in un menu programmato resta invece protetto da `ON DELETE RESTRICT`.

I campi giornalieri non modificano l’archivio dei piatti:

- `available` indica la disponibilità soltanto per la data e non cambia `menu_items.available`;
- `price_override`, quando nullo, lascia usare `menu_items.price`; quando valorizzato definisce il prezzo della sola giornata e non cambia il prezzo base;
- `display_order` stabilisce l’ordine nel menu della data e non cambia `menu_items.display_order`.

Il vincolo UNIQUE su `daily_menus.service_date` crea già l’indice per la data. Gli indici aggiuntivi coprono stato/data, ordine dei piatti nel menu e ricerca delle associazioni per piatto, senza duplicare gli indici delle chiavi primarie.

## Aggiornamento automatico

La funzione trigger `public.set_updated_at()` aggiorna `updated_at` prima di ogni modifica a categorie, piatti, allergeni e impostazioni. La funzione usa i privilegi dell’utente chiamante e un `search_path` limitato.

La migrazione 006 riutilizza la stessa funzione per `daily_menus` e `daily_menu_items`, senza creare funzioni duplicate.

## Row Level Security e privilegi

RLS è abilitata su tutte le cinque tabelle. I ruoli Supabase `anon` e `authenticated` possono leggere:

- tutte le categorie;
- tutti i piatti, inclusi quelli terminati;
- tutti gli allergeni;
- tutte le associazioni piatto-allergene;
- soltanto le impostazioni con `is_public = true`.

I due ruoli ricevono esclusivamente il privilegio `SELECT`. Non sono presenti policy o grant pubblici per inserimento, modifica o eliminazione. Le policy amministrative saranno progettate insieme all’autenticazione.

Sulle due tabelle dei menu programmati, `anon` e gli utenti autenticati non amministratori leggono soltanto i menu `published` e le relative associazioni. Gli amministratori presenti in `admin_users` possono leggere anche le bozze e dispongono di policy separate per INSERT, UPDATE e DELETE. RLS filtra tutte le operazioni; non viene usata `service_role` e non esiste alcuna logica RLS basata su `CURRENT_DATE`.

CB-008A predispone soltanto schema e policy. Homepage, `/menu`, `/tv` e dashboard continuano a usare direttamente il sistema attuale e non sono ancora collegate a `daily_menus` o `daily_menu_items`.

## Sicurezza delle impostazioni

La tabella `settings` non deve mai contenere password, token, chiavi API, credenziali del database, secret key o chiavi `service_role`. I valori pubblici iniziali sono limitati a nome, indirizzo e servizio del locale.

## Esecuzione manuale nel Supabase SQL Editor

1. Aprire il progetto corretto nella dashboard Supabase.
2. Aprire SQL Editor.
3. Creare una nuova query e incollare integralmente la migrazione.
4. Revisionare ed eseguire la migrazione.
5. Ripetere la procedura con il seed.
6. Eseguire infine il file di verifica e confrontare i risultati con i valori attesi nei commenti.

Non sono richiesti password del database, chiavi segrete o token per incollare manualmente questi file nel SQL Editor di un progetto già aperto dall’utente.

## Rollback manuale

Non viene fornito né eseguito automaticamente uno script distruttivo. Se fosse necessario annullare lo schema in un ambiente di prova, revisionare prima dipendenze e dati, quindi rimuovere manualmente gli oggetti in ordine inverso: policy e privilegi, trigger, funzione, tabella ponte, impostazioni, allergeni, piatti e categorie.

Questa procedura deve essere valutata dall’utente e usata soltanto su un database appropriato, dopo un backup quando necessario.

## Passaggio successivo

CB-007C collegherà il frontend ai dati Supabase soltanto dopo l’esecuzione manuale e la verifica positiva di questi file.
