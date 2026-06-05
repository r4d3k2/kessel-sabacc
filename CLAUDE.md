# CLAUDE.md — Kessel Sabacc

Kontext pro Claude Code. Přečti si tento soubor před každou prací na projektu.

## O projektu

Webová hra **Kessel Sabacc** — karetní hra inspirovaná minihrou ze Star Wars Outlaws.
Stack: **React + TypeScript + Vite + Tailwind CSS**, hostováno na GitHub (`r4d3k2/kessel-sabacc`) + Vercel (auto-deploy z `main`).
UI je celé v **češtině**, primární zařízení **mobil** (mobile-first).
Hra běží celá lokálně v prohlížeči — **žádný backend, žádné API, žádný localStorage**, stav hry žije v paměti po dobu partie.

## Branch disciplína (DŮLEŽITÉ)

- **Pracuj přímo na větvi `main`. Nevytvářej nové větve, nepoužívej git worktree.**
  (Work directly on the main branch, do not create new branches, do not use git worktree.)
- Claude Code má tendenci zakládat worktree/větve na každém projektu — tomu předcházej vždy.

## Git — jak začínat a commitovat

- **Před každou prací udělej `git pull`**, ať máš aktuální `main`.
- **Commituj a pushuj POUZE na můj explicitní pokyn** — když napíšu přesně frázi:
  **„Commit and push to main branch"**. Nikdy necommituj a nepushuj automaticky.
- Při vizuální iteraci (ladění vzhledu) nech být git, dokud to neschválím — řiď se pokynem **„NECOMMITUJ a NEPUSHUJ"**.
- **Commit message piš v češtině**, stručně a výstižně.

## Git — jak NEzačínat projekt (poučení z 4. 6. 2026)

- Tahle složka původně vznikla přes `git init` (neměla nastavený remote, historie se rozešla s GitHubem → musel se řešit force push).
- PŘÍŠTĚ: nový projekt vždy zakládej přes `git clone https://github.com/r4d3k2/<repo>.git` do složky `Projekty`, a teprve **dovnitř** naklonované složky pouštěj Vite a další příkazy.
- **Nikdy nespouštěj `git clone` ze složky, která už je repozitář** — vznikne vnořené repo (embedded git repository).
- Pokud `git status` ukáže „new file: <nazev-slozky>" bez přípony, je to nedopatřením přidané vnořené repo → `git rm --cached <nazev>`.

## Prostředí (Claude Code Desktop)

- Používám **Claude Code Desktop pro Windows**, ne CLI terminál.
- **Nespouštěj `npm run dev`** — dev server řídím přes Preview (Vite Dev Server, Server 1).
- **Nefetchuj `localhost`** — výsledek si zkontroluju sám v Preview.
- Příkazy na localhost / dev server tedy odmítej.

## Technická omezení

- **Žádné nové knihovny** (kromě už použitých: `lucide-react` je OK). Animace **jen CSS** transitions/transforms.
- **Žádné externí API, žádný `fetch`, žádný localStorage.**
- Herní logika patří do **čistých, testovatelných funkcí** v `src/lib/` (`sabacc.ts` = pravidla a vyhodnocení, `ai.ts` = heuristika soupeřů), oddělených od Reactu. Náhodu (míchání, kostka) drž **seedovatelnou / injektovatelnou**, ať jde testovat deterministicky.
- **Hlídej invariant:** každý hráč má vždy 1 kartu Sand + 1 kartu Blood.
- Nevymýšlej pravidla navíc — drž se přesně zadání dané fáze.

## Vizuální styl (zatím funkční placeholder)

- Karty jsou jednoduché barevné obdélníky: **Sand = žlutá/oranžová**, **Blood = červená**. Finální grafiku (šestiúhelníky, Star Wars motiv) ladíme později ve vizuální fázi — zatím vzhled karet nevylepšuj.
- **Akční barva = cyan-teal** (`#13a394` plocha tlačítek, `#2fd4c4` zvýraznění/okraje). Platí pro všechna primární akční tlačítka (Táhnout, Další kolo, …).
- **Žlutá a červená patří jen kartám** Sand/Blood — nikdy je nepoužívej na akční tlačítka, rámečky ani fokus. Tlačítko Stát = neutrální tmavé.
- Žádné emoji v UI.

## Pravidla hry — referenční stav (po F3a)

- Dva balíčky: Sand (žlutý), Blood (červený). Každý: hodnoty 1–6 po 3 kusech + 1 Sylop + 1 Imposter (laditelné konstanty).
- Hráč drží 1 Sand + 1 Blood. Hodnota ruky = absolutní rozdíl, **nižší je lepší**, 0 = Sabacc.
- **Sylop** se při revealu vyrovná hodnotě druhé karty. Dva Sylopy = **Pure Sabacc** (vyhrává jen aktuální kolo, ne partii).
- **Imposter** dostane hodnotu hodem kostkou (1–6) až při revealu. Když je v ruce Imposter + Sylop, nejdřív hod Imposteru, pak se Sylop vyrovná té hodnotě.
- Kolo: 3 tahy, akce **Táhnout** (stojí 1 čip, jde do potu) / **Stát** (zdarma). Draw bere z balíčku nebo z odhazovacího balíčku, odhazuje kartu stejné rodiny.
- Čipová ekonomika: vítěz kola dostane zpět vklad, prohrávající platí penále (= hodnota ruky; prohraný Sabacc = 1 čip), utracené čipy mizí ze hry. Kdo klesne na 0 čipů → vyřazen. Poslední hráč s čipy vyhrává partii.
- **Remíza:** shoda nejnižší hodnoty → nikdo nebere kolo, remízující dostanou vklad zpět.
- AI soupeři: lokální heuristika v `ai.ts`, bez API.
- Když vypadne lidský hráč a zbydou jen AI, kola se dohrají automaticky (s prodlevami), konec partie čeká na „Nová hra".

## Fázování

- F1: herní jádro + hot-seat ✅
- F2: čipová ekonomika + vyřazování + AI soupeři ✅
- F3a: speciální karty Sylop + Imposter ✅
- **Rozpracováno:** pořadí síly ruk (Pure Sabacc > 1/1 > 2/2 > … > 6/6 > nenulový rozdíl), remíza jen při identické ruce
- F3b: Shift Tokeny (později, vybraná podmnožina)
- F4: AI rádce přes Claude API (tlačítko Poradit)

## Po dokončení fáze

Zastav se, napiš krátké shrnutí (co přibylo, jak vyzkoušet v Preview, jaké soubory se změnily, na co při testu pozor) a počkej na moje schválení i na pokyn k commitu. Nepokračuj k další fázi sám.
