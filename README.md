# Kessel Sabacc

Webová karetní hra **Kessel Sabacc**, inspirovaná minihrou ze Star Wars Outlaws.
Hraješ proti 1–3 AI soupeřům, celá hra běží lokálně v prohlížeči. UI je česky,
navržené primárně pro mobil (mobile-first).

- **Stack:** React + TypeScript + Vite + Tailwind CSS (ikony `lucide-react`).
- **Bez backendu:** žádné API, žádný `fetch`, žádný `localStorage` — stav hry žije
  jen v paměti po dobu jedné partie.
- **Náhoda** (míchání balíčků, kostka u Imposteru) je injektovatelná, takže je
  herní logika deterministicky testovatelná.

---

## Jak spustit

```bash
npm install        # instalace závislostí
npm run dev        # vývojový server (Vite) – výchozí http://localhost:5173
npm run build      # produkční build (tsc + vite)
npm run preview    # náhled produkčního buildu
npm test           # jednotkové testy herní logiky (node:test)
```

> Pozn.: vývojový server bývá řízen přes Claude Code Desktop Preview.

---

## Pravidla hry

### Karty a balíčky
- Dva balíčky: **Sand** (žlutý) a **Blood** (červený).
- Každý balíček má **20 karet**: hodnoty 1–6 po 3 kusech (18) + **1 Sylop** + **1 Imposter**.
- Každý hráč drží vždy **1 Sand + 1 Blood** kartu.

### Hodnota ruky
- Hodnota ruky = **absolutní rozdíl** hodnot obou karet. **Nižší je lepší.**
- Rozdíl **0 = Sabacc**.

### Speciální karty
- **Sylop** — nemá pevnou hodnotu; při odhalení se **vyrovná druhé kartě** v ruce.
- **Imposter** — hodnota se určí **hodem kostkou (1–6) až při odhalení** (jednou za kolo).
  Když je v ruce Imposter i Sylop, nejdřív se hodí Imposter, pak se Sylop vyrovná té hodnotě.
- **Pure Sabacc** — dva Sylopy v ruce. Nejlepší možná ruka; **vyhrává jen aktuální kolo**, ne celou partii.

### Pořadí síly ruky (od nejlepší po nejhorší)
1. **Pure Sabacc** (dva Sylopy)
2. **Sabacc** (rozdíl 0) podle hodnoty karet: **1/1 nejlepší → 6/6 nejhorší**
   (Sylop+1 = jako 1/1 „Prime Sabacc“, Sylop+4 = jako 4/4 …)
3. **Nenulový rozdíl**: menší rozdíl je lepší (1 < 2 < 3 …); při shodě rozhoduje nižší součet karet.

**Remíza** nastává jen při **zcela shodné síle ruky** (např. dva hráči 3/3).

### Průběh kola
- Kolo má **3 tahy** (cykly); hráči se střídají v pevném pořadí.
- Na začátku kola se zamíchají oba balíčky, každý hráč dostane 1 Sand + 1 Blood
  a dealer otočí **jednu úvodní kartu z každého balíčku** na příslušnou odhazovací hromádku.
- V každém tahu hráč zvolí jednu akci:
  - **Táhnout** — vezme kartu z balíčku Sand/Blood nebo z vrchu odhozu, a odhodí
    jednu kartu stejné rodiny (zůstává mu 1 Sand + 1 Blood). **Stojí 1 čip** (jde do potu).
  - **Stát** — nic nemění, zdarma; v tomto kole už dál nehraje.
- Po 3 tazích (nebo když všichni stojí) se odhalí ruce a kolo se vyhodnotí.

### Čipová ekonomika
- Každý hráč začíná s **4 / 6 / 8 čipy** (volitelné na úvodní obrazovce).
- **Vítěz kola** dostane zpět své investované čipy.
- **Remízující** (shodná nejlepší ruka) také dostanou vklad zpět, bez penále.
- **Prohrávající** platí **penále = hodnota ruky** (prohraný Sabacc = 1 čip), seříznuté na zásobu.
- **Pot se vyprázdní** — nevrácené vklady i penále mizí ze hry (vítěz pot **nebere**).
  Cílem není sbírat čipy, ale přežít nejdéle.
- Kdo klesne na **0 čipů → vyřazen** (řeší se po revealu). **Poslední hráč s čipy vyhrává partii.**

### Shift Tokeny (čipové triky)
Každý hráč si **před partií vybere 3 ze 6** tokenů (AI náhodně). Jsou **jednorázové**
(po zahrání zmizí) a smí se zahrát **max 1 za kolo**, vždy **před** akcí Táhnout/Stát.
Ovlivňují **jen čipy**, nikdy karty:

| Token | Efekt |
|---|---|
| **Free Draw** | Tento tah táhneš zdarma (neplatíš čip). |
| **Refund** | Vrať si 2 čipy z potu (jen cos sám vsadil). |
| **Extra Refund** | Vrať si 3 čipy z potu (jen cos sám vsadil). |
| **Embezzlement** | Vezmi 1 čip od každého soupeře. |
| **General Tariff** | Všichni soupeři platí 1 čip do potu. |
| **Target Tariff** | Vybraný soupeř platí 2 čipy do potu. |

### AI soupeři
Lokální heuristika (žádné API). AI rozhoduje Táhnout/Stát podle odhadu ruky
(Sylop ≈ 0, Imposter ≈ 3,5) a rozumně hraje Shift Tokeny. Když je lidský hráč
vyřazen a zbývají jen AI, partie se **dohraje automaticky** (s krátkými prodlevami).

---

## Vývoj po fázích

Projekt vznikal po fázích; níže je přehled, co která přinesla.

### F1 — Herní jádro a hot-seat
- Datový model karet a balíčků, rozdání, 3 tahy na kolo, akce Táhnout/Stát.
- Výpočet hodnoty ruky, vyhodnocení vítěze kola, skóre přes víc kol.
- Hot-seat pro 2–4 lidi u jednoho zařízení s předávací obrazovkou.

### F2 — Čipová ekonomika + AI soupeři
- Nahrazení bodového modelu **čipovou ekonomikou** (vklad za draw, pot, penále,
  vyprázdnění potu, vyřazování, poslední hráč vyhrává).
- **AI soupeři** (`ai.ts`) — 1 člověk vs 1–3 AI. Hot-seat pro víc lidí nahrazen.
- AI hraje bez předávací obrazovky, s logem akcí a krátkými prodlevami.

### F2 — Drobné opravy
- **Akční barva cyan-teal** (`#13a394` / `#2fd4c4`) pro tlačítko Táhnout, výběr
  zdroje a interaktivní prvky — aby se nepletla se žlutou Sand / červenou Blood kartou.
- **Auto-průběh:** když lidský hráč vypadne a zbývají jen AI, kola se dohrávají
  sama (s pauzami), konec partie čeká na „Nová hra“.
- Oprava rubů balíčků (Sand „S“ / Blood „B“) a pořadí sloupců na stole
  (Odhoz S → Braní S → Braní B → Odhoz B).

### F3a — Speciální karty Sylop a Imposter
- Do každého balíčku přidán 1 Sylop a 1 Imposter (balíček = 20 karet).
- Čistá funkce `resolveHand(hand, roll)` (Imposter hod kostkou, Sylop vyrovnání,
  Pure Sabacc), `previewHandValue` pro živý náhled.
- AI umí se speciálními kartami zacházet (odhad hodnoty).

### Pořadí síly ruk (tie-break)
- Vítěz kola se určuje přes `handScore` / `compareHandScore` (Pure Sabacc >
  Sabacc dle hodnoty karet > nenulový rozdíl). Výrazně ubylo remíz — remíza
  nastává jen při zcela shodné síle ruky.
- Na revealu se u Sabaccu ukazuje jeho síla („Sabacc 2/2“ vs „Sabacc 5/5“).

### Úvodní odhoz
- Při rozdávání každého kola dealer otočí **jednu kartu z každého balíčku** na
  odhazovací hromádky, takže od prvního tahu je z čeho brát i z odhozu.

### F3b — Shift Tokeny (čipové)
- 6 čipových tokenů (viz tabulka výše), výběr 3 na partii, jednorázové, max 1 za kolo.
- Logika v `tokens.ts` (čisté funkce), AI rozhodování o tokenech v `ai.ts`.

---

## Struktura kódu

```
src/
  lib/
    sabacc.ts        # herní jádro: typy, balíčky, rozdání, tahy, vyhodnocení, skóre ruky
    tokens.ts        # Shift Tokeny: definice + aplikace efektů (čisté funkce)
    ai.ts            # heuristika AI (Táhnout/Stát + tokeny), bez API
    sabacc.test.ts   # jednotkové testy herní logiky (node:test)
  components/
    SetupScreen.tsx     # úvodní obrazovka (jméno, počet AI, čipy, výběr tokenů)
    TurnScreen.tsx      # tah lidského hráče (ruka, zdroje, akce, tokeny)
    AiTurnScreen.tsx    # tah AI (log, prodleva)
    RevealScreen.tsx    # vyhodnocení kola (ruce, hodnota, změny čipů, vítěz)
    GameOverScreen.tsx  # konec partie (pořadí, vítěz, Nová hra)
    PlayingCard.tsx     # karta / rub (placeholder vzhled)
    TableInfo.tsx       # čipy, pot, dlaždice soupeřů, log
  App.tsx            # stavový automat (useReducer) + řízení AI tahů
```

Herní logika je oddělená od Reactu v `src/lib/` jako čisté, testovatelné funkce.
Spuštění testů: `npm test`.

---

## Stav

Hotové fáze: **F1, F2 (+ opravy), F3a, pořadí síly ruk, úvodní odhoz, F3b**.
Vzhled karet je zatím funkční **placeholder** (barevné obdélníky) — finální grafika
(šestiúhelníky, Star Wars motiv) přijde v pozdější vizuální fázi.
