# Coffee Break Monza — Configurazione Supabase

## Scopo

## Cloudflare Workers e OpenNext — CB-010C.2

Il progetto è stato predisposto localmente con `@opennextjs/cloudflare` 1.20.2 e Wrangler 4.124.0, mantenendo Next.js 16.3.0. `website/wrangler.jsonc` usa l'output `.open-next/worker.js`, il nome `coffee-break-monza`, la compatibility date `2026-08-15` e i flag `nodejs_compat` e `global_fetch_strictly_public`. Non contiene account ID, dominio, valori ambiente, secret, binding R2 o Durable Objects. `website/open-next.config.ts` usa la configurazione minima senza cache incrementale esterna.

Le variabili pubbliche da configurare in futuro sul Worker sono `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` e `NEXT_PUBLIC_TURNSTILE_SITE_KEY`. I secret server-only sono `SUPABASE_SECRET_KEY` e `TURNSTILE_SECRET_KEY`. Nessun valore reale è stato inserito nella configurazione Cloudflare.

La build Next.js 16.3.0 continua a riuscire. La build OpenNext eseguita su Windows nativo ha invece interrotto la trasformazione dopo la build Next perché `src/proxy.ts` viene compilato come Node.js Proxy Middleware, non ancora supportato da OpenNext 1.20.2. L'adapter ha inoltre ricordato che il supporto Windows non è completo e raccomanda WSL o CI Linux. Non è stato modificato il flusso Supabase Auth per aggirare il problema: prima di una preview o di un deploy serve una revisione mirata della strategia di refresh sessione/proxy oppure un aggiornamento dell'adapter che supporti il Node Proxy di Next.js 16.

Poiché la build OpenNext non ha prodotto il Worker finale, dimensione compressa, compatibilità con il limite Free e preview delle route non sono ancora misurabili. Non è stato eseguito alcun deploy. Il rate limiter resta intenzionalmente in-memory; Durable Objects e il secret HMAC non sono stati introdotti in questa attività.

## Middleware Edge Supabase — CB-010C.3B

Il Node.js Proxy `website/src/proxy.ts` è stato sostituito con `website/src/middleware.ts`, usando la convenzione Edge legacy ancora supportata da Next.js 16. Il middleware mantiene esattamente il matcher `/admin/:path*` e riutilizza `updateSupabaseSession()`: legge i cookie della request, chiama `supabase.auth.getClaims()`, aggiorna i cookie inoltrati ai Server Components e restituisce i nuovi cookie e header nella response. Non aggiunge redirect o controlli di autorizzazione e non importa API Node.

La protezione amministrativa non dipende dal middleware: il layout `(protected)` continua a eseguire `requireAdmin()`, tutte le Server Action amministrative ripetono lo stesso controllo e RLS con `private.is_admin()` resta autoritativa. Login, logout, client Supabase browser e Broadcast non sono stati modificati. La convenzione `middleware.ts` è deprecata in Next.js 16 e viene usata esclusivamente come ponte temporaneo finché OpenNext non supporterà il Proxy Node oppure verrà adottato un flusso Auth alternativo capace di persistere correttamente i cookie.

La build Next.js è stata completata correttamente e il manifest colloca il middleware nei chunk Edge. La build OpenNext non riporta più il precedente errore sul Node.js Middleware: completa la build Next, impacchetta il middleware e raggiunge la generazione del server bundle. Su Windows nativo si interrompe però durante la creazione di un collegamento simbolico con errore `EPERM`; questo nuovo limite ambientale non è stato aggirato automaticamente. Serve ripetere `pnpm cf:build` in WSL o CI Linux prima di misurare il Worker e avviare la preview. Nessun deploy è stato eseguito.

## Idempotenza atomica degli ordini — CB-010B.2D.1

Il form `/ordine` genera con `crypto.randomUUID()` una chiave UUID v4 casuale quando nasce un tentativo di ordine. La chiave non deriva da nome, telefono, email, IP o altri dati personali e resta esclusivamente nello stato React: non viene salvata in `localStorage` o `sessionStorage`. Un refresh della pagina genera quindi un nuovo tentativo e non recupera la chiave precedente.

In caso di errore o risposta persa, il form conserva la stessa chiave mentre azzera il token Turnstile e resetta il widget. Il retry richiede un nuovo token monouso, supera nuovamente Siteverify e invia la stessa chiave alla Server Action. Dopo un successo definitivo viene generata una nuova chiave per l'ordine successivo.

La Server Action valida obbligatoriamente l'UUID v4 e calcola nel backend fidato Next.js un fingerprint SHA-256 deterministico del payload già normalizzato: modalità, dati cliente, data e ora, recapito, note e righe ordinate per ID con quantità e note. Prezzi, totali, token Turnstile e chiave di idempotenza non fanno parte del fingerprint. Il browser non lo genera, non lo invia e non lo riceve; eventuali proprietà aggiuntive inviate da un client non vengono usate nel payload RPC.

La migrazione revisionabile `database/migrations/014_order_idempotency.sql` aggiunge a `public.orders` le colonne nullable `idempotency_key uuid` e `request_fingerprint text`, mantenendo compatibili eventuali righe storiche, e impone unicità della chiave, presenza congiunta dei due valori e formato esadecimale SHA-256. Non è richiesta `pgcrypto` né un'altra estensione.

La nuova firma di `public.create_public_order` riceve dalla Server Action chiave e fingerprint prima dei parametri facoltativi. PostgreSQL non calcola il fingerprint: ne verifica il formato esadecimale a 64 caratteri e lo confronta con il valore persistito, all'interno del confine fidato garantito da `service_role`. La migrazione elimina esplicitamente la vecchia firma e ricrea un unico overload con `EXECUTE` riservato a `service_role`; `PUBLIC`, `anon` e `authenticated` restano esclusi. Un advisory lock transazionale derivato dalla chiave serializza richieste concorrenti, mentre il vincolo UNIQUE protegge l'invariante persistente. Il confronto e l'unicità usano sempre l'UUID completo, non l'hash del lock.

La prima richiesta valida inserisce una testata e le relative righe. Un retry con la stessa chiave e lo stesso fingerprint restituisce gli stessi `order_id`, `order_number` e `total` prima di qualsiasi nuovo INSERT, quindi non consuma un altro numero ordine e non attiva un secondo Broadcast. La stessa chiave con fingerprint diverso produce esclusivamente `IDEMPOTENCY_CONFLICT`, mappato a un messaggio controllato. Restano possibili i normali gap della identity causati da inserimenti falliti o da altri flussi, ma non dal percorso idempotente serializzato.

Il check `database/checks/014_verify_order_idempotency.sql` contiene soltanto query di lettura per colonne, vincoli, firma, overload, sicurezza, privilegi, RLS e struttura atomica. La migrazione 014 risulta applicata e il check è stato superato; gli esiti del test controllato successivo sono documentati di seguito.

### Test database idempotenza dopo applicazione della migrazione 014

Il 18 agosto 2026 il nucleo database è stato verificato realmente partendo da `orders = 0`, `order_items = 0` e badge pari a zero. Un ordine pickup fittizio creato tramite la RPC server-only ha prodotto una sola testata e una sola riga, con numero e totale corretti. Il retry sequenziale con stessa chiave e stesso payload ha restituito gli stessi identificativi, numero e totale senza nuovi inserimenti. La stessa chiave con quantità differente ha restituito `IDEMPOTENCY_CONFLICT` e ha lasciato invariato l'ordine originale.

Due chiamate realmente concorrenti con stessa chiave e stesso payload sono entrambe terminate con successo restituendo lo stesso ordine e lo stesso numero. È stata creata una sola nuova testata, una sola nuova riga e non è stato esposto alcun errore UNIQUE. La chiamata anonima è rimasta bloccata con errore di permesso, mentre il percorso `service_role` ha eseguito la nuova firma.

La subscription Broadcast aperta dal test tecnico con credenziale server ha restituito `CHANNEL_ERROR`; il browser integrato non era disponibile per verificare il normale flusso `/ordine`, il nuovo token Turnstile, il channel amministrativo autenticato e la singola notifica. Questi punti non vengono dichiarati superati e richiedono un retest end-to-end con area admin aperta.

I due ordini fittizi sono stati eliminati esclusivamente tramite i rispettivi ID e `ON DELETE CASCADE` ha rimosso le righe collegate. I conteggi finali sono `orders = 0`, `order_items = 0` e badge pari a zero; non sono stati usati `TRUNCATE`, DELETE diretto sulle righe o modifiche alla sequence. Nessuna chiave, fingerprint, UUID o PII è stata inserita nella documentazione.

## Cloudflare Turnstile ordini — CB-010B.2C

Il form `/ordine` integra Cloudflare Turnstile con rendering esplicito dello script ufficiale `https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit`. Il widget deve essere creato in modalità Managed nel pannello Cloudflare e usa l'azione stabile `order_submit`. La Site Key pubblica viene letta da `NEXT_PUBLIC_TURNSTILE_SITE_KEY`; la Secret Key viene letta esclusivamente lato server da `TURNSTILE_SECRET_KEY` e non deve mai usare il prefisso `NEXT_PUBLIC_`.

Il token resta soltanto nello stato React del form: non viene mostrato, registrato, salvato in cookie, `localStorage` o `sessionStorage`. Successo, scadenza ed errore del widget sono gestiti esplicitamente. Dopo ogni invio che può avere consumato il token, il form azzera il token e resetta il widget; un nuovo tentativo richiede quindi una nuova verifica.

La Server Action mantiene l'ordine difensivo: limite payload di 32 KB, honeypot, rate limiter in-memory, validazione completa, verifica Turnstile e infine RPC server-only. L'helper `website/src/lib/orders/turnstile.ts`, marcato `server-only`, esegue una sola richiesta POST form-urlencoded a `https://challenges.cloudflare.com/turnstile/v0/siteverify`, con timeout di 5 secondi e senza retry automatico. Non invia `remoteip`, non registra token o risposte e accetta soltanto una risposta ben formata con `success = true`, azione `order_submit` e hostname non vuoto. Le restrizioni degli hostname restano configurate sul widget Cloudflare, così localhost può usare credenziali di test dedicate senza indebolire la produzione.

Il controllo è fail-closed: Secret Key mancante, timeout, errore di rete, risposta HTTP o JSON non valida, token assente, scaduto, riutilizzato o rifiutato impediscono la chiamata alla RPC e restituiscono un messaggio sanitizzato. Il confine della migrazione 013 resta invariato: `PUBLIC`, `anon` e `authenticated` non possono eseguire direttamente `create_public_order`, mentre il client server-only usa `service_role` soltanto dopo il superamento di Turnstile.

Per sviluppo e test automatici vanno configurate tramite env le chiavi di test ufficiali Cloudflare; non sono hardcoded e non devono essere confuse con le credenziali di produzione. Un test reale pickup/delivery resta necessario dopo la configurazione delle env. Turnstile tratta segnali tecnici del browser e della rete e dovrà essere citato nella revisione privacy. Una futura Content Security Policy dovrà consentire le risorse necessarie da `challenges.cloudflare.com`; la CSP non viene introdotta in questa attività.

Il rate limiter resta in-memory e non distribuito. Redis/KV non è stato implementato.

### Test reale Turnstile CB-010B.2C

Il collaudo end-to-end del 14 agosto 2026 ha verificato il caricamento dello script ufficiale, la visualizzazione del widget Managed configurato, l'azione `order_submit` e la generazione transitoria del token senza esposizione nell'interfaccia. Un ordine pickup e un ordine delivery fittizi sono passati attraverso Server Action, Siteverify e RPC server-only; i totali sono risultati corretti, inclusa la tariffa delivery di 2,50 euro. Broadcast, notifiche amministrative, badge, elenco e dettaglio ordine si sono aggiornati correttamente.

Dopo il pickup il form di conferma non conteneva più widget o response input; avviando un nuovo ordine il widget ha generato una nuova verifica. Il token precedente non è stato riutilizzato. Con le chiavi di test configurate il widget completa automaticamente la verifica, quindi il caso UI senza token non è stato forzato né è stato manipolato il provider; il blocco e il messaggio restano verificati staticamente.

Un test reale separato con token deliberatamente invalido ha ottenuto `success = false` da Siteverify e non ha creato ordini. La catena fail-closed della Server Action, l'assenza di retry e il posizionamento della RPC dopo la verifica sono stati ricontrollati staticamente. Token e Secret Key non sono stati mostrati o registrati; non risultano persistenza browser, `remoteip` o PII nella richiesta Siteverify.

I due ordini fittizi sono stati eliminati esclusivamente tramite i rispettivi ID; `ON DELETE CASCADE` ha rimosso le righe figlie. I conteggi finali sono `orders = 0`, `order_items = 0` e badge nuovi ordini pari a zero. Redis/KV resta non implementato.

## Confine fidato per la creazione ordini — CB-010B.2B

La Server Action chiama `public.create_public_order` tramite il client server-only e la Secret Key configurata esternamente. La migrazione 013 è stata applicata il 14 agosto 2026: `PUBLIC`, `anon` e `authenticated` non possono più eseguire la RPC, mentre `service_role` è l'unico ruolo applicativo autorizzato. Il bypass diretto dalla Data API pubblica è quindi chiuso e honeypot, limite applicativo, controllo della dimensione e il futuro CAPTCHA restano confinati nella Server Action.

La strategia scelta usa una Secret Key Supabase dedicata al backend Next.js. La chiave resta in `SUPABASE_SECRET_KEY`, non usa il prefisso `NEXT_PUBLIC_`, non viene letta da componenti client e crea un client `@supabase/supabase-js` separato, senza cookie o persistenza della sessione. La chiave opera tramite il ruolo PostgreSQL `service_role`, che deve ricevere `EXECUTE` sulla sola firma prevista della RPC.

La migrazione revisionabile `database/migrations/013_lock_public_order_rpc.sql` revoca `EXECUTE` a `PUBLIC`, `anon` e `authenticated` e lo concede a `service_role`. Non modifica la funzione `SECURITY DEFINER`, il relativo owner, le tabelle, RLS, prezzi, calcoli o validazioni. Il check `database/checks/013_verify_lock_public_order_rpc.sql` è esclusivamente di lettura e controlla firma, overload, proprietario, modalità di sicurezza, privilegi, RLS di `orders` e assenza di privilegi tabellari per `anon`.

La migrazione 013 e il relativo check di sola lettura sono stati eseguiti con esito positivo. La firma prevista è unica, i privilegi effettivi corrispondono al modello atteso, RLS su `orders` resta attiva e `anon` non possiede privilegi diretti su `orders` o `order_items`. Una chiamata reale con la Publishable Key è stata rifiutata con errore di permesso prima di raggiungere la logica applicativa; nessuna riga è stata creata.

Il percorso server-only è stato verificato dopo la migrazione con un ordine pickup e un ordine delivery fittizi: entrambi sono stati creati tramite `service_role`, i totali sono risultati corretti e la consegna ha applicato la tariffa di 2,50 euro. Gli ordini di test sono stati eliminati esclusivamente per ID e `order_items` è stata ripulita tramite `ON DELETE CASCADE`; i conteggi finali sono zero. `createPublicOrderAction` continua a usare `createOrderServerSupabaseClient()`, mentre il vecchio client anonimo non è importato dall'azione.

## Collegamento Server Action server-only — CB-010B.2B.1

La modifica applicativa sostituisce esclusivamente il costruttore del client usato per `supabase.rpc("create_public_order", rpcPayload)`. Limite di 32 KB, honeypot, rate limiter, validazione TypeScript, hook CAPTCHA, whitelist, mapping degli errori, parsing tipizzato e autorità economica della RPC restano invariati. Non sono stati aggiunti INSERT diretti su `orders` o `order_items`.

`order-server.ts` conserva `import "server-only"`, legge `SUPABASE_SECRET_KEY` esclusivamente da `process.env` e non è importato da Client Component. La credenziale è configurata esternamente in `.env.local`, esclusa dal versionamento, e non è stata letta, mostrata o registrata durante l'attività.

Il collaudo post-migrazione ha confermato il percorso RPC server-only per pickup e delivery e il blocco della chiamata anonima. Il browser di automazione non ha consentito un nuovo collaudo visuale su `localhost`; Broadcast e dashboard, già verificati end-to-end prima della migrazione, non sono stati modificati dalla 013. Turnstile e un rate limiter distribuito restano volutamente non implementati.

Rollout senza interruzioni:

1. creare una Secret Key dedicata e configurare `SUPABASE_SECRET_KEY` in ogni ambiente server, senza inserirla nei file versionati;
2. verificare in sola lettura se `service_role` possiede già `EXECUTE`; se non lo possiede, applicare prima soltanto il `GRANT EXECUTE` previsto, mantenendo temporaneamente `anon` attivo;
3. collegare e distribuire la Server Action al client server-only, quindi verificare la creazione di un ordine esclusivamente attraverso il flusso pubblico;
4. applicare integralmente la migrazione 013, eseguire il check 013 e verificare che una chiamata diretta con Publishable Key venga rifiutata;
5. solo dopo la chiusura del bypass, attivare Turnstile nella Server Action e ripetere i test anti-abuso.

`CREATE OR REPLACE FUNCTION` conserva i privilegi esistenti. Un futuro `DROP`/`CREATE` oppure un nuovo overload può invece riapplicare il privilegio PostgreSQL predefinito `EXECUTE` a `PUBLIC`: ogni modifica futura della RPC deve quindi restare transazionale con la revoca e deve ripetere il check 013.

Next.js 16.3.0 usa attualmente il limite predefinito di 1 MB per le Server Action. Il payload applicativo viene già rifiutato oltre 32 KB; per una futura difesa di trasporto è consigliato `serverActions.bodySizeLimit: '64kb'`, lasciando margine alla serializzazione. La configurazione non viene modificata in questa fase per non alterare il flusso pubblico prima della revisione.

## Ordini consegna e ritiro — CB-009A

La migrazione revisionabile `database/migrations/007_orders.sql` predispone `orders` e `order_items`. Il controllo associato e `database/checks/007_verify_orders.sql`; il seed `database/seeds/007_orders.example.sql` e interamente commentato e contiene soltanto dati fittizi.

CB-009A adotta la strategia B: `anon` non riceve privilegi o policy sulle tabelle degli ordini. La sola RLS non puo garantire in sicurezza che un visitatore anonimo inserisca esclusivamente le righe del proprio ordine appena creato e non alteri prezzi o totali. Il futuro flusso pubblico dovra quindi usare un'operazione server-side transazionale con input validato, senza esporre `service_role` nel frontend.

Gli utenti `authenticated` possono operare soltanto se il loro UUID e presente in `admin_users`. Non sono previste policy pubbliche di lettura o autorizzazioni basate su email, telefono o altri dati personali.

Prima dell'attivazione reale devono essere definite gestione privacy, conservazione e cancellazione dei dati. Il sistema pubblico continua a usare `menu_items`; homepage, `/menu`, `/tv` e dashboard non sono stati modificati da CB-009A.

Ordine futuro delle attivita sugli ordini:

1. revisione della migrazione;
2. applicazione SQL;
3. esecuzione dei controlli di sola lettura;
4. progettazione dell'inserimento ordine transazionale;
5. form pubblico;
6. dashboard ordini;
7. gestione degli stati ordine;
8. notifiche;
9. privacy e conservazione dei dati.

## Configurazione generale

## Creazione transazionale ordine — CB-009B.1

La migrazione `database/migrations/008_create_order_function.sql` ha predisposto `public.create_public_order` come RPC atomica inizialmente richiamabile da `anon`. Dopo l'applicazione della migrazione 013, la funzione è eseguibile soltanto dal ruolo applicativo `service_role`; `PUBLIC`, `anon` e `authenticated` non possiedono `EXECUTE`. Il ruolo anonimo continua a non avere privilegi diretti su `orders`, `order_items` o `admin_users`.

La funzione accetta esclusivamente dati cliente, modalità e data richieste e un array di identificativi piatto, quantità e note. Nomi, prezzi, disponibilità, subtotale, tariffa e totale sono determinati dal database. Solo i piatti disponibili vengono accettati e nome e prezzo vengono congelati in `order_items`.

`SECURITY DEFINER` permette l'inserimento atomico senza indebolire RLS o grants. La funzione usa `search_path` vuoto, riferimenti qualificati, nessun SQL dinamico e nessun accesso ad account Auth. La tariffa consegna iniziale è una costante interna pari a 2,50 euro e non viene ricevuta dal client.

La funzione non implementa rate limiting. Prima del lancio pubblico serviranno rate limiting nella Server Action o nell'infrastruttura, CAPTCHA o protezione anti-bot, limiti di payload e un controllo della frequenza che non esponga dati personali.

Ordine futuro delle attività:

1. revisione della funzione;
2. applicazione SQL;
3. test manuali in ambiente controllato;
4. Server Action;
5. rate limiting e CAPTCHA;
6. form pubblico;
7. pagina di conferma;
8. dashboard ordini.

## Configurazione Supabase generale

## Test controllato motore ordini — CB-009B.3

Il motore ordini è stato verificato realmente tramite Data API con il ruolo `anon` e dati esclusivamente fittizi. Sono stati creati un ordine con ritiro e uno con consegna, controllando la singola testata e la singola riga associate a ciascuna chiamata.

Le verifiche amministrative hanno confermato modalità e metodo di pagamento, tariffa di consegna pari a zero per il ritiro e 2,50 euro per la consegna, dati di consegna null per il ritiro, snapshot di nome e prezzo, totale riga, subtotale e totale complessivo. I valori restituiti dalla RPC corrispondevano a quelli salvati.

Sono stati rifiutati quantità zero e cento, UUID inesistente, ID duplicato, data passata, consegna senza indirizzo e proprietà JSON aggiuntive `price` e `total`. Un payload misto con una riga non valida non ha lasciato ordini parziali o righe orfane. Il caso relativo a un piatto terminato non è stato eseguito perché al momento del test non esistevano piatti con `available = false`.

La Server Action CB-009B.2 è stata verificata staticamente: usa il client anon senza cookie, inoltra una whitelist senza prezzi o totali e restituisce errori sanitizzati. Non è stata creata alcuna UI o route temporanea per invocarla.

Al termine sono stati eliminati esclusivamente i due ordini creati dal test tramite i rispettivi ID; `ON DELETE CASCADE` ha rimosso le righe associate. È stata verificata l'assenza di ordini di test residui e righe orfane. Nessun UUID o dato cliente di test è conservato nella documentazione.

## Server Action ordini — CB-009B.2

La Server Action `createPublicOrderAction` costituisce il solo livello applicativo predisposto per la futura creazione pubblica degli ordini. Riceve un input TypeScript esplicito, applica nuovamente le validazioni principali e costruisce tramite whitelist il payload destinato a `public.create_public_order`.

Prezzi, nomi dei piatti, disponibilità, subtotale, tariffa di consegna e totale non vengono accettati o calcolati dal codice applicativo. La RPC resta l'autorità finale e restituisce soltanto identificativo, numero ordine e totale. Il totale viene normalizzato come stringa monetaria, senza effettuare calcoli floating point.

La chiamata usa il client Supabase server-only dedicato agli ordini, configurato con URL e `SUPABASE_SECRET_KEY`, senza cookie o sessione utente. La Secret Key non è disponibile al browser e la RPC resta l'unico percorso di inserimento: non vengono eseguite query dirette a `orders` o `order_items`, API route o scritture alternative. Dopo l'applicazione della migrazione 013, `anon`, `authenticated` e `PUBLIC` non possiedono `EXECUTE`; il solo ruolo applicativo autorizzato è `service_role`.

I codici controllati restituiti dalla funzione vengono mappati a messaggi italiani. Dettagli, hint, SQLSTATE, payload, UUID degli articoli e dati personali non sono restituiti né registrati. Errori sconosciuti producono esclusivamente un messaggio generico.

CB-009B.2 non aggiunge interfacce: non esistono ancora pagina ordine, form, carrello o conferma. Prima del lancio pubblico restano obbligatori rate limiting, protezione anti-bot/CAPTCHA, limite della dimensione della richiesta e altre protezioni contro gli abusi.

Questa configurazione prepara il progetto Next.js a comunicare con Supabase tramite client server e browser. In questa fase non vengono create tabelle, eseguite query o configurata l’autenticazione.

## Variabili richieste

Il sito usa queste variabili pubbliche:

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`

Il client ordini server-only predisposto richiederà, al momento dell'attivazione:

- `SUPABASE_SECRET_KEY`

Questa variabile non deve mai usare il prefisso `NEXT_PUBLIC_` e non deve essere esposta al browser.

## Configurazione locale

1. Aprire il file `website/.env.local`.
2. Inserire il Project URL nella variabile `NEXT_PUBLIC_SUPABASE_URL`.
3. Inserire la Publishable Key nella variabile `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.
4. Salvare il file e riavviare il server di sviluppo.

Il file `.env.local` è escluso dal controllo versione. Il file `.env.local.example` documenta soltanto la struttura richiesta e non deve contenere credenziali reali.

## Sicurezza

Non utilizzare mai la chiave `service_role` nel frontend o nelle variabili `NEXT_PUBLIC_*`. Non inserire password del database, secret key o access token personali nel progetto.

La Publishable Key consente l’accesso previsto per il frontend e non deve essere trattata come una chiave amministrativa.

## Lettura del menu pubblico

Homepage, pagina menu e modalità TV leggono categorie e piatti lato server tramite la Publishable Key e le policy RLS. Se la configurazione locale manca o la lettura non riesce, le pagine mostrano uno stato di errore controllato senza dettagli tecnici.

Anche la route `/admin` utilizza la stessa lettura server-side protetta da RLS. La dashboard richiede autenticazione e opera esclusivamente in lettura.

## Test dell’autenticazione amministratore

Per testare CB-007E.1 serve un utente creato manualmente nella sezione Authentication del progetto Supabase. Non è disponibile una registrazione pubblica. Da CB-007E.3 l’autenticazione da sola non consente l’accesso alla dashboard: serve anche l’associazione in `admin_users`.

## Autorizzazione amministratore — CB-007E.2

La migrazione per `admin_users` è stata applicata manualmente e l’amministratore è stato associato tramite il suo UUID Auth. Non inserire UUID, email, password o altre credenziali nella documentazione o nei file versionati.

## Controllo autorizzazione nel sito — CB-007E.3

L’autenticazione conferma l’identità dell’utente, mentre l’autorizzazione stabilisce se quell’utente può accedere alla dashboard. Il sito esegue entrambi i controlli lato server prima di mostrare i dati amministrativi.

Dopo la verifica della sessione, il server cerca esclusivamente la riga personale dell’utente in `admin_users`. La policy RLS consente a ogni account autenticato di leggere soltanto la propria associazione. Una riga esistente autorizza l’accesso; un account autenticato senza riga viene indirizzato alla pagina di accesso non autorizzato. In caso di errore tecnico, l’accesso resta chiuso.

Per aggiungere in futuro un amministratore occorre creare manualmente l’utente in Supabase Auth e associare manualmente il relativo UUID in `admin_users`, seguendo il modello SQL predisposto e senza salvare identificativi reali nel progetto.

La dashboard rimane in sola lettura: nessuna funzione CRUD del menu è attiva.

## Policy di scrittura amministrative — CB-007F.0

Le policy di scrittura sono state applicate manualmente al database. Il ruolo `authenticated` da solo non autorizza alcuna modifica: ogni operazione richiede anche la presenza della riga personale dell’utente in `admin_users`.

La migrazione riguarda esclusivamente `menu_items` e `menu_item_allergens`. `categories`, `allergens` e `settings` restano in sola lettura secondo le policy esistenti. Non viene utilizzata la chiave `service_role`.

La revisione e l’applicazione manuale sono state completate. Restano da eseguire i test reali di scrittura con un amministratore e di rifiuto con un utente autenticato non amministratore.

## Creazione di un piatto — CB-007F.1

Il form protetto è disponibile in `/admin/piatti/nuovo`. La pagina carica le categorie lato server e la Server Action ricontrolla l’amministratore prima di elaborare qualsiasi dato.

L’inserimento viene eseguito con il client Supabase SSR associato alla sessione dell’utente e rispetta le policy RLS, senza utilizzare `service_role`. Nome, categoria, prezzo e disponibilità vengono validati lato server; la categoria viene verificata nuovamente nel database e il piatto viene accodato alla categoria tramite `display_order`.

Dopo un inserimento riuscito vengono invalidati i percorsi `/`, `/menu`, `/tv` e `/admin`, quindi l’amministratore viene reindirizzato alla dashboard. Gli allergeni non sono ancora gestiti e non vengono create associazioni in `menu_item_allergens`.

## Modifica di un piatto — CB-007F.2

La modifica è disponibile tramite il percorso dinamico `/admin/piatti/[id]/modifica`. La pagina è protetta dal layout amministrativo, valida l’ID e carica lato server il piatto e le categorie prima di mostrare il form precompilato.

La Server Action riceve l’ID associato lato server, ricontrolla l’amministratore e verifica nuovamente piatto, categoria e campi. L’UPDATE utilizza il client Supabase SSR della sessione e rispetta la RLS senza `service_role`. Il payload esplicito contiene soltanto `name`, `description`, `category_id`, `price` e `available`; `display_order`, immagini e campi tecnici restano invariati.

Dopo una modifica riuscita vengono invalidati `/`, `/menu`, `/tv`, `/admin` e la pagina dinamica del piatto, quindi avviene il redirect alla dashboard. Non sono state aggiunte gestione allergeni o eliminazione dei piatti.

## Eliminazione di un piatto — CB-007F.3

La conferma protetta è disponibile nel percorso dinamico `/admin/piatti/[id]/elimina`. La pagina ricontrolla l’amministratore, valida l’UUID e carica lato server il piatto per mostrarne il nome e l’avviso di eliminazione definitiva.

La Server Action riceve l’ID associato lato server, ripete il controllo amministratore e verifica l’esistenza del piatto. Il DELETE utilizza il client Supabase SSR della sessione, rispetta la RLS, è filtrato sulla chiave primaria e verifica che sia stata eliminata esattamente la riga prevista. Non viene utilizzata `service_role`.

La foreign key `menu_item_allergens.menu_item_id` usa `ON DELETE CASCADE`: le eventuali associazioni del piatto vengono rimosse automaticamente dal database, senza DELETE manuali sulla tabella ponte. Dopo il successo vengono invalidati `/`, `/menu`, `/tv`, `/admin` e i percorsi dinamici di modifica ed eliminazione, quindi avviene il redirect alla dashboard.

## Gestione allergeni nei form — CB-007F.4A

Le pagine amministrative di creazione e modifica caricano lato server gli allergeni da `allergens`, ordinati per codice e nome. Il form condiviso mostra checkbox accessibili e, in modifica, carica separatamente dal database le associazioni correnti in `menu_item_allergens`.

La Server Action legge gli ID con `FormData.getAll()`, accetta soltanto stringhe UUID, elimina i duplicati e verifica con il client Supabase SSR autenticato che ogni allergene esista. Un elenco vuoto è valido. La creazione inserisce prima il piatto, ne recupera l'ID e inserisce nella tabella ponte soltanto `menu_item_id` e `allergen_id`; se l'inserimento delle associazioni fallisce, tenta di eliminare il nuovo piatto e si affida a `ON DELETE CASCADE` per eventuali righe collegate.

La modifica legge lo stato corrente, calcola le sole differenze, aggiunge prima le associazioni mancanti e rimuove poi quelle obsolete con filtri sul piatto e sugli allergeni interessati. Se la rimozione fallisce dopo un'aggiunta riuscita, tenta di eliminare soltanto le nuove associazioni come compensazione.

Queste operazioni rispettano RLS e le policy amministrative esistenti, senza `service_role`, nuove policy, migrazioni o RPC. Le query multiple non costituiscono una vera transazione SQL: le compensazioni riducono il rischio di uno stato parziale, ma possono a loro volta fallire e il limite resta esplicito.

## Visualizzazione pubblica allergeni — CB-007F.4B

Homepage, `/menu` e `/tv` leggono gli allergeni lato server insieme al menu pubblico. Il livello dati esegue un numero fisso di query in parallelo su `categories`, `menu_items`, `menu_item_allergens` e `allergens`, quindi ricostruisce in memoria la relazione `menu_items → menu_item_allergens → allergens` senza effettuare query per ogni piatto.

Il tipo pubblico `MenuItem` contiene un array esplicito di allergeni con i soli campi `id`, `code` e `name`. Le associazioni vengono deduplicate e ordinate stabilmente per codice crescente e nome crescente; relazioni mancanti o nomi vuoti vengono ignorati e un piatto senza allergeni riceve sempre un array vuoto.

Un Server Component condiviso mostra la riga testuale “Allergeni:” nell'anteprima della homepage, nel menu completo e in formato compatto nella modalità TV. Non sono stati introdotti client component, richieste browser o scritture. La lettura usa il client Supabase SSR e le policy SELECT esistenti, senza `service_role`, modifiche al database o alle policy.

## Riordinamento piatti — CB-007F.5A

La dashboard mostra per ogni piatto i pulsanti “Sposta su” e “Sposta giù”. I limiti vengono calcolati all'interno di ogni categoria: il primo elemento non può salire, l'ultimo non può scendere e un elemento solo ha entrambi i comandi disabilitati.

La Server Action ricontrolla l'amministratore, valida UUID e direzione e ricava dal database categoria, ordine e piatto vicino. Il riordinamento rimane nella stessa categoria e modifica soltanto `display_order` su un massimo di due piatti. Ogni UPDATE è filtrato per ID, categoria e ordine atteso e ne verifica la riga restituita. Gli ordini duplicati vengono resi non ambigui per la coppia con valori interi consecutivi e non negativi.

Lo scambio usa due UPDATE separati e non costituisce una vera transazione SQL. Se il secondo aggiornamento fallisce, viene tentato il ripristino del primo; anche la compensazione può fallire e l'errore resta chiuso e generico nell'interfaccia. Il client Supabase SSR opera con la sessione utente e rispetta la RLS amministrativa, senza `service_role`, RPC o migrazioni. Dopo il successo vengono invalidati `/`, `/menu`, `/tv` e `/admin`.

## Creazione e modifica categorie — CB-007F.6A

La pagina protetta `/admin/categorie` elenca le categorie ordinate per `display_order` e nome, mostrando slug e numero di piatti collegati senza query N+1. Da questa pagina l'amministratore può aprire il form condiviso per creare una categoria o modificare nome e slug di una categoria esistente. Non sono disponibili eliminazione o riordinamento delle categorie.

Nome e slug vengono validati definitivamente lato server. Lo slug viene normalizzato in minuscolo, accetta soltanto lettere `a-z`, numeri e trattini, non ammette spazi, doppi trattini o trattini alle estremità e viene verificato rispetto al vincolo univoco. In creazione, `display_order` viene calcolato come massimo corrente più uno oppure zero; in modifica resta invariato.

Entrambe le Server Action eseguono `requireAdmin()`, usano il client Supabase SSR della sessione e invalidano `/`, `/menu`, `/tv`, `/admin` e `/admin/categorie`. Non viene utilizzata `service_role` e non sono state aggiunte scritture dal browser.

Le policy INSERT e UPDATE non erano presenti nelle migrazioni applicate. La migrazione revisionabile `004_category_write_policies.sql` e il relativo controllo di sola lettura sono stati predisposti, ma non eseguiti. La migrazione conserva SELECT, concede INSERT e UPDATE soltanto ad `authenticated` e richiede la riga personale in `admin_users`; non concede DELETE.

## Riordinamento categorie — CB-007F.6B.1

La pagina protetta `/admin/categorie` mostra i pulsanti “Sposta su” e “Sposta giù”. La prima categoria non può salire, l’ultima non può scendere e, con una sola categoria, entrambi i pulsanti sono disabilitati.

La Server Action ricontrolla l’amministratore, valida UUID e direzione e carica lato server tutte le categorie ordinate per `display_order` e nome. La categoria vicina viene ricavata dal database; il client non invia ordine, posizione o ID della vicina. Lo scambio modifica esclusivamente `display_order` sulle due categorie coinvolte tramite due UPDATE filtrati e verificati.

Se i due valori sono uguali, alla coppia vengono assegnati due interi consecutivi, deterministici e non negativi, nell’ordine richiesto. I due UPDATE non costituiscono una vera transazione SQL: se il secondo fallisce viene tentato il ripristino del primo, ma anche la compensazione può fallire.

L’operazione usa il client Supabase SSR della sessione, esegue `requireAdmin()`, rispetta RLS e non usa `service_role`. Dopo il successo vengono invalidati `/`, `/menu`, `/tv`, `/admin` e `/admin/categorie`, quindi la pagina categorie viene ricaricata con i dati reali.

## Eliminazione categorie — CB-007F.6B.2

L’eliminazione è disponibile soltanto per categorie vuote. La pagina di conferma protetta carica la categoria e conta lato server i piatti collegati; se il conteggio è maggiore di zero non mostra il pulsante definitivo e non rende possibile alcun DELETE dal form.

La Server Action esegue nuovamente `requireAdmin()`, verifica la categoria e ripete il conteggio immediatamente prima del DELETE. Questo secondo controllo gestisce i cambiamenti avvenuti dopo l’apertura della pagina; la foreign key `menu_items.category_id → categories.id` con `ON DELETE RESTRICT` resta l’ultima protezione contro eliminazioni concorrenti di categorie non vuote.

La migrazione revisionabile `005_category_delete_policy.sql` concede DELETE ad `authenticated`, lo revoca a `PUBLIC` e `anon` e limita l’operazione agli utenti presenti in `admin_users` tramite RLS. Non viene utilizzata `service_role` e la migrazione non viene applicata automaticamente.

Il DELETE è filtrato per ID e verifica la singola riga restituita. Non vengono spostati o eliminati automaticamente i piatti e non vengono normalizzati i `display_order` delle categorie rimaste: eventuali spazi tra i valori non compromettono l’ordinamento per `display_order` e nome. Dopo il successo vengono invalidati `/`, `/menu`, `/tv`, `/admin` e `/admin/categorie`.

## Menu programmati per data — CB-008A

La migrazione revisionabile `006_daily_menus.sql` predispone `daily_menus` e `daily_menu_items` senza modificare il sistema corrente. Homepage, `/menu`, `/tv` e dashboard continuano a leggere direttamente categorie e piatti esistenti.

Un menu programmato identifica una data di servizio Europe/Rome memorizzata come PostgreSQL `date` e può restare in `draft` oppure essere impostato su `published`. Soltanto i menu pubblicati e le relative associazioni sono leggibili pubblicamente; gli amministratori verificati tramite `admin_users` possono leggere le bozze e usare le policy separate di scrittura.

Disponibilità, prezzo sostitutivo e ordine appartengono alla singola data e non modificano i campi corrispondenti in `menu_items`. La migrazione riutilizza `public.set_updated_at()`, non usa `service_role`, non contiene logiche basate su `CURRENT_DATE` e non viene applicata automaticamente.

Ordine futuro delle attività:

1. revisione integrale della migrazione SQL;
2. applicazione manuale della migrazione;
3. esecuzione dei controlli di sola lettura;
4. implementazione della dashboard per data;
5. collegamento del menu pubblico alla data corrente Europe/Rome;
6. gestione del fallback quando il menu del giorno non esiste.

## Gestione menu giornalieri — CB-008B.1

La sezione protetta `/admin/menu-giornalieri` legge lato server tutti i record di `daily_menus` tramite il client Supabase SSR e li ordina per `service_date` crescente. Data, titolo facoltativo e stato vengono mostrati senza richieste client-side; `draft` appare come “Bozza” e `published` come “Pubblicato”.

La pagina `/admin/menu-giornalieri/nuovo` permette di inserire la data civile del servizio, un titolo facoltativo e note facoltative. La data viene conservata nel formato `YYYY-MM-DD`, validata senza conversioni timestamp e interpretata come giorno di servizio Europe/Rome. Titolo e note vengono normalizzati con trim e salvati come `null` quando vuoti.

La Server Action ricontrolla l’amministratore, verifica l’unicità della data e inserisce un payload esplicito con stato sempre impostato lato server a `draft`. Il vincolo UNIQUE su `service_date` resta la protezione finale contro inserimenti concorrenti. La scrittura usa la sessione SSR e RLS, senza `service_role`.

In questa fase non vengono letti o modificati `daily_menu_items`, non è possibile pubblicare o modificare un menu e il sito pubblico continua a usare direttamente `menu_items`.

## Sospensione menu giornalieri

La funzionalità amministrativa dei menu giornalieri è sospesa. Il collegamento è stato rimosso dalla navigazione e le route `/admin/menu-giornalieri` e `/admin/menu-giornalieri/nuovo` restituiscono uno stato non trovato, quindi elenco e form non sono raggiungibili dall’interfaccia.

Non è stato eseguito alcun rollback: `daily_menus`, `daily_menu_items`, migrazione 006, controlli, seed e policy RLS restano invariati. I file applicativi sono conservati ma non esposti, così la funzionalità potrà essere riattivata in futuro.

Homepage, `/menu` e `/tv` continuano a leggere il menu corrente da `menu_items`; nessuna query pubblica è stata collegata alle tabelle dei menu programmati.

## Attività successive

Drag & drop e CRUD degli allergeni verranno affrontati in attività successive.

## Form pubblico ordini — CB-009C.1

La route `/ordine` carica lato server categorie e piatti da `menu_items` tramite la lettura pubblica esistente e trasferisce al componente interattivo soltanto ID, nome, prezzo visualizzato, categoria e nomi degli allergeni. I piatti non disponibili non vengono proposti nel form.

Il carrello e i campi di consegna o ritiro sono gestiti nel browser per l'esperienza utente. Il totale mostrato prima dell'invio è esplicitamente indicativo: il payload inviato alla Server Action contiene soltanto ID dei piatti, quantità, note e dati cliente. Prezzi, eventuale tariffa di consegna e totale definitivo vengono ricalcolati dalla funzione `create_public_order` nel database e soltanto il risultato validato della RPC viene mostrato nella conferma.

La modalità ritiro non invia campi di indirizzo. In caso di validazione o indisponibilità di un piatto, il form conserva selezione e dati già inseriti; dopo un successo il carrello viene svuotato e vengono mostrati numero ordine e totale definitivo.

I dati cliente sono usati esclusivamente per gestire la richiesta. Prima di rendere il form disponibile in produzione restano obbligatori rate limiting, limite infrastrutturale del payload e una protezione anti-bot/CAPTCHA. CB-009C.1 non modifica database, RPC, RLS, autenticazione o area amministrativa.

## Anti-abuso ordini — CB-009C.2

Il form `/ordine` contiene un honeypot posizionato fuori viewport e sottratto alla navigazione da tastiera e agli screen reader. La Server Action verifica il campo prima della validazione principale e non chiama la RPC quando risulta valorizzato, restituendo soltanto un errore generico.

La dimensione JSON UTF-8 dell'input viene controllata prima degli altri controlli e non può superare 32 KB. Questo limite è difensivo e complementare ai limiti di lunghezza e quantità già applicati dalla validazione TypeScript e dalla RPC; il payload non viene mai registrato.

Il rate limiting applicativo consente al massimo 5 tentativi in una finestra di 10 minuti. Usa il primo IP sintatticamente valido ricavabile da `x-forwarded-for` o `x-real-ip`, con lunghezza limitata, oppure un bucket condiviso prudente quando l'IP non è disponibile. L'IP resta soltanto come chiave volatile nella memoria del processo: non viene scritto nel database né nei log e nome, telefono ed email non vengono utilizzati dal limiter.

La Map in-memory è esclusivamente una protezione best-effort. Non è persistente, non è condivisa tra istanze e può essere azzerata da riavvii o ambienti serverless; non costituisce da sola un rate limiting robusto per una distribuzione ad alto traffico. Prima di tale lancio servirà una protezione distribuita o infrastrutturale.

Un hook neutro, eseguito dopo la validazione e prima della RPC, identifica il punto destinato a una futura integrazione CAPTCHA. Nessun CAPTCHA è attivo e non vengono creati o inviati token fittizi.

La conferma conserva nel solo stato React numero ordine, totale definitivo, modalità, data e orario facoltativo. Non usa `localStorage`, `sessionStorage`, cookie nuovi o tracking e non mostra UUID o dati personali. L'azione “Fai un nuovo ordine” azzera interamente lo stato locale senza inviare richieste o ricaricare la pagina.

## Test reale anti-abuso ordini — CB-009C.2

Il 13 agosto 2026 CB-009C.2 è stato verificato realmente in un'unica istanza locale e con dati esclusivamente fittizi. Gli ordini pickup e delivery sono stati accettati e la conferma ha mostrato numero ordine, totale definitivo, modalità e data senza UUID o dettagli tecnici. Per la consegna è stata confermata la tariffa database di 2,50 euro.

Una richiesta con honeypot valorizzato e una richiesta di poco superiore a 32 KB sono state respinte prima della RPC, senza creare `orders` o `order_items`. Il form ha mantenuto quantità, note, dati cliente, modalità, data e ora, azzerando soltanto l'honeypot. I messaggi restituiti sono rimasti generici e sanitizzati.

Nella stessa istanza/processo il limiter ha consentito cinque tentativi nella finestra di 10 minuti e ha bloccato quello successivo con `TOO_MANY_REQUESTS`. Questo test conferma il comportamento locale della Map, non fornisce alcuna garanzia distribuita o di persistenza in ambiente serverless.

Sono stati inoltre verificati il blocco del doppio invio, il testo e la disabilitazione durante il pending, il focus sulla conferma, il reset completo “Fai un nuovo ordine”, l'assenza di CAPTCHA attivo e token fittizi e il posizionamento dell'hook prima della RPC. Nessun payload, IP o dato cliente è stato trovato nei log applicativi; non sono presenti storage browser, cookie o tracking aggiunti dal flusso ordine.

Al termine sono stati eliminati soltanto gli ordini fittizi creati dal test usando la selezione puntuale delle relative righe. `ON DELETE CASCADE` ha rimosso le associazioni in `order_items`; è stata verificata l'assenza di residui del test e nessun dato preesistente è stato modificato.

## Dashboard ordini — CB-009D.1

La route `/admin/ordini` si trova sotto il layout amministrativo protetto e richiede un utente autenticato e autorizzato tramite `admin_users`. La pagina è un Server Component dinamico e usa il client Supabase SSR della sessione, quindi la lettura di `orders` continua a rispettare la policy RLS amministrativa senza `service_role`.

Il layer dati esegue una sola query e seleziona esclusivamente ID tecnico per la chiave React, numero ordine, modalità, stato, nome cliente, data e ora richieste, totale e data di creazione. L'ordinamento usa `created_at` decrescente e `order_number` decrescente. Non vengono interrogate `order_items` e non sono presenti query per riga, fetch browser, polling o Realtime.

La pagina mostra le statistiche Ordini totali, Nuovi, In lavorazione e Completati. “In lavorazione” comprende `confirmed`, `preparing`, `ready` e `out_for_delivery`; `cancelled` non viene contato come completato.

La lista visualizza numero ordine, data e ora di creazione Europe/Rome, nome cliente, Consegna/Ritiro, data e ora richieste, totale già salvato in `orders.total` e stato tradotto in italiano. Non mostra UUID, email, indirizzo, note cliente o righe dell'ordine. Valori inattesi ricevono etichette controllate e il database vuoto mostra “Nessun ordine ricevuto.” mantenendo le statistiche a zero.

Il controllo “Dettagli” è predisposto ma disabilitato per evitare un collegamento verso una route inesistente. `/admin/ordini/[id]` sarà implementata esclusivamente in CB-009D.2. CB-009D.1 non permette cambi di stato, modifiche o eliminazioni e non modifica database, policy, RPC o grants.

## Test reale dashboard ordini — CB-009D.1

Il 13 agosto 2026 la dashboard è stata verificata realmente con database inizialmente vuoto e due ordini interamente fittizi: uno di ritiro e uno di consegna. Sono risultati corretti empty state, statistiche, ordinamento per creazione decrescente, modalità e stati in italiano, data e ora richieste, totale salvato e controllo “Dettagli” disabilitato.

La verifica statica ha confermato una sola query SSR su `orders`, nessuna lettura da `order_items`, nessuna query per riga e nessuna esposizione nell’elenco di UUID, email, indirizzi, note cliente o dettagli dei piatti. Non è stato creato un secondo account per il test negativo di autorizzazione.

Al termine sono stati eliminati puntualmente soltanto i due ordini fittizi. `ON DELETE CASCADE` ha rimosso le relative righe da `order_items`; i conteggi finali sono `orders = 0` e `order_items = 0`. Nessuna migrazione, policy, RPC o sequence è stata modificata.

## Dettaglio ordine admin — CB-009D.2

La route protetta `/admin/ordini/[id]` mostra il dettaglio in sola lettura di un singolo ordine. L’identificativo viene validato come UUID; un valore non valido o un ordine assente produce `notFound()`, mentre gli errori tecnici mostrano un messaggio controllato senza informazioni Supabase.

Il caricamento usa il client Supabase SSR della sessione amministrativa ed esegue al massimo due query fisse: la prima legge la testata da `orders` filtrata per ID, la seconda legge tutte le righe da `order_items` filtrate per `order_id` e ordinate stabilmente. Non sono presenti query N+1, join a `menu_items`, richieste browser o `service_role`; le policy RLS amministrative restano l’unico accesso ai dati.

La pagina mostra nome, telefono ed email facoltativa esclusivamente nell’area cliente. Per la consegna visualizza indirizzo, città e CAP; per il ritiro omette il blocco di recapito. Date, orari, note cliente e amministrative sono presentati solo quando disponibili.

Le righe usano esclusivamente gli snapshot `item_name`, `unit_price`, `quantity`, `line_total` e `customer_notes`. Subtotale, costo di consegna e totale provengono direttamente dai campi economici di `orders` e non vengono ricalcolati. CB-009D.2 non introduce cambio stato, modifica o eliminazione dell’ordine e non modifica database, migrazioni, policy o RPC.

## Test reale dettaglio ordine admin — CB-009D.2

Il 13 agosto 2026 la pagina di dettaglio è stata verificata realmente tramite due casi validi creati dal flusso pubblico con dati esclusivamente fittizi: un pickup senza email, orario o note e una delivery con email, orario, note e recapito completo. Entrambi i dettagli sono stati aperti dal collegamento della lista amministrativa.

Il test ha confermato rendering condizionale dei campi, stato e modalità in italiano, date Europe/Rome, snapshot delle righe, quantità, prezzi, subtotale, tariffa di consegna e totale letti dai dati salvati. Non sono stati rilevati UUID visibili, ricalcoli da `menu_items`, query browser, storage client o PII nei log.

Un UUID formalmente valido ma inesistente e un ID non valido hanno prodotto la pagina 404 controllata senza dettagli tecnici. Il desktop è stato verificato realmente senza overflow; il comportamento mobile è stato verificato staticamente perché il browser di collaudo non esponeva un controllo viewport. Il test con utente non-admin non è stato eseguito perché non era disponibile un account già predisposto.

Al termine sono stati eliminati puntualmente gli ordini fittizi. `ON DELETE CASCADE` ha eliminato le righe collegate e i conteggi finali sono `orders = 0` e `order_items = 0`. Sequence, schema, policy, RLS, RPC e migrazioni sono rimasti invariati.

## Gestione stato ordini — CB-009D.3

La pagina protetta `/admin/ordini/[id]` consente all’amministratore di avanzare lo stato dell’ordine o annullarlo. Le transizioni sono definite in un helper TypeScript condiviso e vengono sempre ricalcolate lato server usando lo stato e la modalità letti direttamente da `orders`.

Il percorso standard è `new → confirmed → preparing → ready`. Un ordine con ritiro passa da `ready` a `completed`; un ordine con consegna passa da `ready` a `out_for_delivery` e quindi a `completed`. L’annullamento è consentito da ogni stato non terminale. `completed` e `cancelled` non consentono ulteriori transizioni, non sono ammessi salti o ritorni indietro e `new` non è un target accettato.

La Server Action esegue `requireAdmin()`, valida UUID e target e usa il client Supabase SSR della sessione. L’UPDATE modifica esclusivamente `status` ed è filtrato sia per ID sia per stato corrente: se una modifica concorrente ha già cambiato lo stato, nessun dato più recente viene sovrascritto e l’interfaccia richiede di aggiornare la pagina.

La policy `orders_update_admin` esistente è sufficiente e continua a richiedere l’associazione in `admin_users`. Non vengono usati `service_role`, nuove policy, migrazioni, RPC o aggiornamenti browser. Importi, dati cliente, fulfillment e righe ordine restano invariati. Dopo il successo vengono invalidate `/admin`, `/admin/ordini` e la pagina di dettaglio interessata.

La UI mostra soltanto le azioni consentite, disabilita i controlli durante l’aggiornamento e richiede una conferma inline prima dell’annullamento. Il Client Component riceve esclusivamente ID tecnico, stato corrente e modalità, senza PII.

## Test reale gestione stato ordini — CB-009D.3

Il 13 agosto 2026 sono stati verificati realmente i percorsi completi di un ordine con ritiro e uno con consegna, oltre all’annullamento da stato iniziale. Avanzamenti, badge, statistiche, distinzione tra completamento pickup e passaggio `out_for_delivery` della delivery, stati terminali, pending e conferma inline sono risultati corretti. Il doppio click non ha prodotto salti multipli.

Il test con due viste simultanee ha confermato che lo stato più recente non viene sovrascritto. È tuttavia emersa una difformità nel messaggio: il secondo tentativo basato sul vecchio stato riceve “Transizione di stato non consentita” invece di “Lo stato dell’ordine è cambiato. Aggiorna la pagina e riprova.” Il problema non è stato corretto durante il collaudo e CB-009D.3 richiede una revisione mirata prima di essere considerato completamente superato.

Il fix successivo introduce `expectedCurrentStatus`, inviato dalla UI come token di concorrenza ottimistica. Il valore viene validato ma non è autoritativo: la Server Action legge comunque stato e fulfillment reali, confronta lo stato reale con quello atteso e restituisce immediatamente il messaggio specifico quando differiscono. Solo dopo il confronto verifica la transizione contro lo stato reale; l’UPDATE resta filtrato per ID e stato atteso e il caso di zero righe aggiornate resta classificato come concorrenza.

Il test mirato successivo ha usato due viste contemporanee dello stesso ordine. Dopo il passaggio reale da `new` a `confirmed`, la seconda vista basata ancora su `new` ha ricevuto esattamente il messaggio di concorrenza previsto; lo stato `confirmed` è rimasto invariato. La distinzione dalle transizioni realmente vietate resta garantita dall’ordine dei controlli e dall’helper condiviso. L’unico ordine fittizio è stato poi eliminato per ID e la cascata ha riportato `orders` e `order_items` a zero.

## Notifiche interne ordini — CB-009E.1

La verifica iniziale del 13 agosto 2026 aveva rilevato la publication `supabase_realtime` priva di tabelle. La migrazione 009 è stata successivamente revisionata e applicata manualmente, rendendo `public.orders` disponibile per la subscription Postgres Changes amministrativa.

La migrazione `database/migrations/009_orders_realtime.sql` è stata applicata manualmente: `public.orders` appartiene ora alla publication esistente. Il controllo `database/checks/009_verify_orders_realtime.sql` verifica in sola lettura l’esistenza della publication, il supporto INSERT e l’appartenenza della tabella.

Il frontend usa il browser client Supabase già disponibile e la sessione amministrativa autenticata. La subscription vive soltanto nel layout protetto, ascolta esclusivamente INSERT su `public.orders`, rispetta la policy SELECT basata su `admin_users` e non utilizza `service_role`, secret key, endpoint pubblici o polling.

Postgres Changes consegna per un INSERT la riga pubblicata, che comprende anche campi personali. Questo è un limite del meccanismo scelto: il futuro componente dovrà estrarre immediatamente soltanto `id`, `order_number`, `fulfillment_type`, `total`, `status` e `created_at`, senza mostrare, conservare o propagare telefono, email, indirizzo, note o nome completo. Se sarà richiesto un payload realmente minimale a livello di trasporto, servirà una progettazione separata basata su Broadcast e trigger, non inclusa in CB-009E.1.

La UI mostra al massimo tre avvisi, deduplicati in memoria per ID, chiama `router.refresh()` una volta per ogni nuovo ordine e offre un suono Web Audio disattivato per impostazione predefinita. Soltanto la preferenza booleana del suono viene salvata in `localStorage`; nessun dato ordine viene persistito. Il badge della sidebar legge il conteggio degli ordini `new` direttamente dal database dopo il refresh, senza incrementi locali. Non sono previste notifiche email, WhatsApp, SMS, push native o service worker.

Il test non-admin non è stato eseguito perché non era disponibile un account già predisposto. Al termine, tutti gli ordini fittizi sono stati eliminati puntualmente e `ON DELETE CASCADE` ha ripulito `order_items`; i conteggi finali sono zero. Nessun dato reale, sequence, schema, policy, RLS, RPC o migrazione è stato modificato.

## Test reale frontend Realtime — CB-009E.1B

Il collaudo end-to-end è partito con `orders = 0`, `order_items = 0`, badge a zero, nessuna notifica e suono disattivato. Con l’area admin autenticata mantenuta aperta è stato creato dalla pagina pubblica un ordine fittizio con ritiro.

L’ordine è stato salvato correttamente in `orders` e `order_items`, ma il client amministrativo non ha ricevuto l’evento INSERT: non sono comparsi avvisi e non sono stati eseguiti il refresh automatico o l’aggiornamento del badge. Una verifica di sola lettura ha confermato che `public.orders` appartiene alla publication `supabase_realtime` e che la publication pubblica gli INSERT.

Poiché il problema interessa il percorso fondamentale della subscription, il test è stato interrotto senza applicare correzioni. Gli scenari su collegamento al dettaglio, chiusura, suono attivo, limite di tre notifiche, deduplicazione reale, UPDATE e reconnect restano da ripetere dopo una diagnosi mirata.

L’unico ordine fittizio è stato eliminato con filtro sul suo ID e `ON DELETE CASCADE` ha rimosso la riga collegata. I conteggi finali sono `orders = 0` e `order_items = 0`; nessuna PII o UUID del test è stata registrata nella documentazione.

## Helper RLS orders per Realtime — CB-009E.1C

La diagnosi successiva ha confermato che browser admin, sessione, JWT Realtime, channel, publication e grant SELECT sono corretti. Il callback riceve l’INSERT, ma l’autorizzazione Realtime della policy `orders_select_admin` basata sulla sottoquery diretta verso `public.admin_users` produce un record nuovo vuoto. La stessa sessione continua a superare la SELECT REST.

La migrazione revisionabile `database/migrations/010_orders_admin_rls_helper.sql` introduce `private.is_admin()`. La funzione non accetta parametri e restituisce soltanto un booleano verificando l’esistenza di `auth.uid()` in `public.admin_users`. È `STABLE`, `SECURITY DEFINER`, posseduta da `postgres`, usa `search_path` vuoto e riferimenti completamente qualificati; non legge `auth.users`, non usa SQL dinamico o `service_role` e non restituisce dati amministrativi.

Lo schema `private` è già presente e non è incluso negli schemi esposti dalla Data API. Per consentire esclusivamente la valutazione della policy, `authenticated` riceve `USAGE` sullo schema ed `EXECUTE` sulla funzione, ma non `CREATE`; `PUBLIC` e `anon` non possono eseguire l’helper e non ricevono accesso allo schema. La funzione non è una RPC pubblica.

La migrazione sostituisce esclusivamente `orders_select_admin` con `(select private.is_admin())`. RLS su `orders`, grant SELECT per `authenticated` e assenza di SELECT per `anon` restano invariati. Le policy `orders_insert_admin`, `orders_update_admin` e `orders_delete_admin` conservano per ora la sottoquery diretta: una futura uniformazione può migliorare manutenzione e coerenza, ma non è necessaria per correggere la lettura Realtime e non fa parte di CB-009E.1C.

Il file `database/checks/010_verify_orders_admin_rls_helper.sql` esegue esclusivamente verifiche catalogo e non invoca la funzione. Dopo revisione e applicazione manuale della migrazione 010 devono essere verificati: SELECT REST consentita all’admin, SELECT REST negata a un utente authenticated non-admin, SELECT negata ad `anon`, INSERT Realtime con `payload.new` valorizzato, assenza di PII nell’interfaccia, notifica visuale, singolo `router.refresh()` e aggiornamento autoritativo del badge.

### Retest dopo applicazione della migrazione 010

La migrazione 010 risulta applicata e il check 010 è stato eseguito con esito corretto. Il retest end-to-end è partito con `orders = 0`, `order_items = 0`, badge a zero, admin autenticato aperto e suono disattivato. È stato creato un solo ordine fittizio con ritiro tramite il flusso pubblico.

L’ordine è stato registrato correttamente, ma senza refresh manuale non sono comparsi notifica, aggiornamento dell’elenco o aggiornamento del badge. Dopo un refresh manuale, l’ordine risultava leggibile nell’area amministrativa con i dati e il totale attesi. Il test non consente quindi di confermare ricezione INSERT, valorizzazione di `payload.new`, accettazione del parser o esecuzione di `router.refresh()`.

Non sono state applicate correzioni a frontend, database, publication, policy, RLS o RPC. I test dipendenti dal percorso fondamentale — link della notifica, UPDATE senza nuova notifica, suono attivo e deduplicazione runtime — restano da ripetere dopo una nuova diagnosi mirata. L’ordine fittizio è stato eliminato puntualmente e la cascata ha riportato `orders` e `order_items` a zero; nessuna PII o UUID è stata inserita nella documentazione.

## Broadcast privato ordini — CB-009E.2A

I test reali hanno confermato che Postgres Changes su `public.orders` non è affidabile per questo flusso: publication, INSERT, sessione, JWT, channel, SELECT amministrativa, RLS e helper `private.is_admin()` risultano configurati, ma la notifica non raggiunge correttamente il frontend. Non verranno introdotte ulteriori modifiche al percorso Postgres Changes.

Supabase indica Broadcast come opzione raccomandata per scalabilità e sicurezza quando si inoltrano cambiamenti del database. La migrazione revisionabile `database/migrations/011_orders_broadcast.sql` usa `realtime.send()` da una funzione trigger privata, perché questa primitiva permette di costruire un payload custom invece di serializzare l’intera riga dell’ordine.

`private.broadcast_new_order()` viene eseguita soltanto da un trigger di riga `AFTER INSERT` su `public.orders`. La funzione è `SECURITY DEFINER`, owner `postgres`, usa `search_path` vuoto e riferimenti schema-qualified; l’esecuzione diretta è revocata a `PUBLIC`, `anon` e `authenticated`. Non modifica l’ordine, non esegue query esterne o SQL dinamico e invia un messaggio privato con evento `new_order` sul topic costante `admin:orders`.

Il payload contiene esclusivamente `order_id`, `order_number`, `fulfillment_type`, `total`, `status` e `created_at`. Non include nome, telefono, email, indirizzo, città, CAP, note cliente o note amministrative e non usa `row_to_json(NEW)`, `to_jsonb(NEW)` o equivalenti. Il topic non deriva da input cliente e non contiene UUID o dati personali.

La ricezione usa Realtime Authorization su `realtime.messages`. La policy `orders_broadcast_receive_admin` permette SELECT soltanto al ruolo `authenticated` quando l’estensione è `broadcast`, `realtime.topic()` è esattamente `admin:orders` e `private.is_admin()` restituisce vero. Non viene concessa una policy INSERT al client: l’invio avviene dal trigger database. Anon e utenti autenticati non presenti in `admin_users` non possono entrare nel canale privato.

`AdminOrderNotifications` crea `supabase.channel("admin:orders", { config: { private: true } })` e ascolta `broadcast` con evento `new_order`. Parser, deduplicazione in memoria, massimo tre notifiche, `router.refresh()`, collegamento al dettaglio e suono opzionale restano invariati; nessuna PII viene copiata nello stato o nei log.

La migrazione 011 è stata applicata manualmente e `database/checks/011_verify_orders_broadcast.sql` è stato eseguito. Il check è esclusivamente di sola lettura e ha verificato funzione, `SECURITY DEFINER`, owner, `search_path`, privilegi, trigger `AFTER INSERT`, payload esplicito, assenza PII, policy sul topic, helper admin, RLS e permanenza temporanea della publication precedente.

Il test end-to-end Broadcast è stato completato con esito positivo. `public.orders` resta ancora nella publication `supabase_realtime` soltanto fino alla revisione e applicazione manuale della migrazione 012; il client non usa più Postgres Changes.

## Frontend notifiche Broadcast — CB-009E.2B

Il componente `AdminOrderNotifications` usa ora un canale Supabase Broadcast privato con topic `admin:orders` ed evento `new_order`. La sessione amministrativa esistente viene propagata automaticamente a Realtime dal browser client Supabase installato; non vengono usati token hardcoded, `service_role` o secret key. La precedente subscription client `postgres_changes` è stata rimossa.

Il parser accetta esclusivamente il payload minimo della migrazione 011: `order_id`, `order_number`, `fulfillment_type`, `total`, `status` e `created_at`. UUID, numero ordine, modalità, totale, stato e data vengono validati prima di aggiornare lo stato; payload non validi vengono ignorati senza log e senza eccezioni visibili. Nessun nome, telefono, email, indirizzo o nota viene copiato nello stato o persistito nel browser.

Restano invariati deduplicazione in memoria per `order_id`, limite di tre notifiche, singolo `router.refresh()` per evento valido, badge server-side degli ordini `new`, link al dettaglio e suono Web Audio opzionale con preferenza booleana in `localStorage`. Il channel gestisce gli stati `SUBSCRIBED`, `CHANNEL_ERROR`, `TIMED_OUT` e `CLOSED` ed è rimosso al cleanup.

La migrazione 011 e la configurazione database Broadcast risultano applicate e verificate. Il test reale end-to-end con admin autenticato ha confermato ricezione, parser, refresh, badge, link, suono e deduplicazione. `public.orders` resta temporaneamente nella publication `supabase_realtime`, ma il frontend non usa più Postgres Changes.

### Test reale Broadcast CB-009E.2B

Il collaudo end-to-end del 14 agosto 2026 è partito con `orders = 0`, `order_items = 0`, badge a zero e suono disattivato. Con l'area admin autenticata già aperta, un ordine pickup fittizio ha prodotto una sola notifica `new_order` sul channel privato `admin:orders`, senza refresh manuale. Modalità e totale erano corretti, il badge è passato a uno e l'ordine è comparso nell'elenco amministrativo.

Il collegamento della notifica ha aperto il dettaglio corretto senza mostrare l'UUID come testo. Il passaggio da `new` a `confirmed` ha aggiornato il badge a zero e non ha generato notifiche o suoni aggiuntivi. Un secondo ordine delivery, creato con il suono attivato esplicitamente, ha prodotto una sola notifica, un solo percorso audio Web Audio, modalità e totale corretti.

Refresh e re-render non hanno duplicato le notifiche. La deduplicazione resta basata esclusivamente sul `Set` in memoria; nessun ID ordine viene persistito. Il payload completo non viene loggato, nessuna PII viene copiata nello stato e il browser conserva soltanto la preferenza booleana del suono in `localStorage`; `sessionStorage` non è usato dal componente.

I due ordini fittizi sono stati eliminati puntualmente dall'editor dati selezionando le sole righe create dal test. `ON DELETE CASCADE` ha ripulito `order_items`; i conteggi finali sono `orders = 0` e `order_items = 0`, il badge è tornato a zero e il suono è stato ripristinato su OFF. Nessun SQL, schema, policy, RLS, RPC, trigger, publication o dato reale è stato modificato.

## Rimozione Postgres Changes ordini — CB-009E.3

Supabase Broadcast, testato realmente sul topic privato `admin:orders` e sull'evento `new_order`, è la strategia Realtime definitiva del progetto per i nuovi ordini. Il frontend non contiene più subscription `postgres_changes`; la precedente appartenenza di `public.orders` alla publication `supabase_realtime` è deprecata e resta soltanto come configurazione ereditaria finché la migrazione 012 non viene applicata manualmente.

La migrazione revisionabile `database/migrations/012_remove_orders_postgres_changes.sql` verifica l'esistenza della publication e rimuove esclusivamente `public.orders` quando ancora presente. Il controllo preventivo rende la migrazione ragionevolmente rieseguibile; l'operazione usa `ALTER PUBLICATION` statico e non richiede SQL dinamico.

Il check `database/checks/012_verify_remove_orders_postgres_changes.sql` contiene soltanto query di lettura. Dopo l'applicazione attende `orders_postgres_changes_count = 0` e verifica che restino funzione e trigger Broadcast, topic, evento, policy `orders_broadcast_receive_admin`, helper `private.is_admin()`, RLS su `realtime.messages` e `public.orders` e le quattro policy amministrative degli ordini.

La migrazione 012 non è stata applicata e nessun SQL è stato eseguito durante CB-009E.3. Non vengono modificati dati, ordini, schema, grants, RLS, policy, RPC, trigger, funzioni Broadcast o frontend. Dopo la futura applicazione manuale, Broadcast resterà l'unico percorso Realtime per i nuovi ordini.

## Aggiornamento dipendenze pre-produzione — CB-010B.1

L'aggiornamento controllato ha portato `next` ed `eslint-config-next` dalla versione 16.2.12 alla 16.3.0. La nuova versione di Next.js risolve la catena runtime aggiornando `sharp` da 0.34.5 a 0.35.3 e rimuovendo `postcss` 8.4.31 in favore della versione 8.5.23.

La rigenerazione mirata del lockfile ha inoltre aggiornato `brace-expansion` 1.1.16 a 1.1.18, `js-yaml` 4.3.0 a 4.3.1 e `nanoid` 3.3.16 a 3.3.18. Per la sola catena `@typescript-eslint` → `minimatch`, che continuava a risolvere `brace-expansion` 5.0.8, `pnpm-workspace.yaml` applica un override circoscritto alla patch 5.0.9 compatibile con il range già dichiarato. Non sono stati effettuati major upgrade.

Il confronto finale è passato da 10 vulnerabilità note, di cui 8 high e 2 moderate, a zero vulnerabilità. `pnpm install`, `pnpm lint` e la build di produzione con Next.js 16.3.0 sono stati completati correttamente. Nessun file in `website/src`, database, migrazione, policy, RLS, RPC o configurazione Broadcast è stato modificato e nessun SQL è stato eseguito.

## Build OpenNext su Linux — CB-010C.4

Il workflow `.github/workflows/cloudflare-build.yml` è predisposto nella cartella `Coffee Break`, scelta come futura root Git perché contiene insieme `website`, `database` e `docs`. Al momento la cartella non è un repository Git e non dispone di branch o remote; non è stata inizializzata automaticamente.

La pipeline è avviabile soltanto manualmente con `workflow_dispatch` e usa `ubuntu-latest`, Node.js 24 e pnpm 11.18.0. Dalla directory `website` esegue, nell'ordine, installazione con `--frozen-lockfile`, lint, audit, build Next.js e `pnpm cf:build`. In questo modo la build OpenNext può essere verificata su Linux, evitando il limite dei symlink incontrato su Windows.

Al termine il workflow controlla l'esistenza di `.open-next/worker.js`, misura l'output completo, il Worker principale e la sua dimensione gzip, quindi carica `.open-next` e il solo report dimensionale come artifact con conservazione di sette giorni. Il runner non riceve file `.env.local`, valori Supabase, chiavi Turnstile o token Cloudflare.

La configurazione usa esclusivamente `contents: read`, disabilita la persistenza delle credenziali del checkout e non contiene deploy, preview, accesso al database, SQL o trigger `pull_request_target`. La verifica eseguita in CB-010C.4 è statica: per il collaudo reale occorre inizializzare e pubblicare il repository nella root scelta, quindi avviare manualmente il workflow e controllare job, misure e artifact.
