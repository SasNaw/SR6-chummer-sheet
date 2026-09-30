# SR6 Munitions- & Geister-Tracker — Anleitung

Eine mobilfreundliche Web-App, um im Shadowrun-6-Spiel den Überblick zu behalten:
Munition pro Waffe, Reservemunition, Drohnen-Bewaffnung und beschworene Geister —
für mehrere Charaktere, ohne App-Store, ohne Server.

**App-Adresse:** https://sasnaw.github.io/SR6-chummer-sheet/

---

## 1. Was die App kann

- Mehrere Charaktere verwalten (auch aus dem Genesis-Charakterbogen importieren).
- Pro Waffe die geladene Munition zählen: Feuermodi (SS/SA/BF/FA) per Knopf,
  manuelles **+ / −**, **Setzen** und **Nachladen** aus passenden Reservepools.
- Verschiedene Munitionstypen pro Waffentyp; Wechsel legt geladene Patronen
  zurück in ihren Pool.
- Waffen in **Ausgerüstet / Verstaut** trennen und Drohnen mit eigener Bewaffnung
  führen.
- Bei magischen Charakteren: Geister beschweren, ihre Werte (abhängig von der
  Kraftstufe), Kräfte und **Dienste** verwalten.
- Sprache **Deutsch / Englisch** umschaltbar (Standard: Englisch).

> **Wichtig:** Alle Daten werden **nur lokal im Browser** des jeweiligen Geräts
> gespeichert (kein Server, keine automatische Synchronisierung zwischen Geräten).
> Sicherung erfolgt über **JSON exportieren / importieren** (siehe Abschnitt 6).

---

## 2. Einrichtung

### 2.1 Im Browser öffnen

Die Adresse https://sasnaw.github.io/SR6-chummer-sheet/ in einem aktuellen
Browser (Chrome, Safari, Firefox, Edge) öffnen. Mehr ist nicht nötig — es gibt
keine Installation und kein Konto.

### 2.2 Als App installieren (optional, empfohlen für’s Handy)

Die Seite ist eine PWA und lässt sich wie eine App auf den Startbildschirm legen
und auch offline nutzen:

- **iPhone/iPad (Safari):** Teilen-Symbol → **„Zum Home-Bildschirm“**.
- **Android (Chrome):** Menü (⋮) → **„App installieren“** bzw. **„Zum
  Startbildschirm hinzufügen“**.
- **Desktop (Chrome/Edge):** Installations-Symbol in der Adressleiste.

Nach der Installation startet die App im Vollbild und funktioniert auch ohne
Internet. Updates werden beim nächsten Online-Start automatisch geladen.

### 2.3 Sprache umstellen

Auf dem Startbildschirm (Charakterauswahl) oben die **Sprache** auf **Deutsch**
stellen. Die Einstellung wird gespeichert.

---

## 3. Kataloge laden (Waffen & Geister)

Die App kennt nur wenige Waffen „ab Werk“. Für die echten Werte (Magazingrößen,
Feuermodi, Munitionstypen) sowie für die Geister-Werte gibt es zwei
**Katalog-Dateien**. Diese enthalten lizenziertes Regelmaterial und sind deshalb
**nicht** Teil der App — sie werden **lokal auf dem Gerät** geladen.

### 3.1 Katalogdateien herunterladen

Die Dateien liegen in der Dropbox:

**https://www.dropbox.com/home/Shadowrun%20Regelwerke/db?_p_luid=30255eea**

Dort findest du:

- `weapons-catalog.json` — Waffenkatalog (Waffen + Munitionstypen)
- `spirits-catalog.json` — Geisterkatalog (Geistertypen, Werte, Kräfte)

Beide Dateien auf das Gerät herunterladen, mit dem du die App nutzt.

> Hinweis: Der obige Link öffnet die Dropbox-Ablage. Falls er bei dir nur die
> eigene Dropbox-Startseite zeigt, lass dir von der Gruppe einen echten
> **Freigabe-Link** zu den beiden Dateien geben.

### 3.2 Kataloge in der App importieren

1. Startbildschirm (Charakterauswahl) öffnen.
2. Auf **„Waffenkatalog laden“** tippen und `weapons-catalog.json` auswählen.
   → Status zeigt z. B. „Waffenkatalog: 237 Waffen“.
3. Auf **„Geisterkatalog laden“** tippen und `spirits-catalog.json` auswählen.
   → Status zeigt z. B. „Geisterkatalog: 6 Geister“.

Die Kataloge bleiben auf dem Gerät gespeichert, bis du sie über **„Katalog
löschen“** bzw. **„Geisterkatalog löschen“** wieder entfernst. Mit **„Waffe
suchen (Katalog)“** kannst du beim Anlegen einer Waffe nach Namen suchen, und der
**+ Geist**-Knopf ist nur aktiv, wenn ein Geisterkatalog geladen ist.

> Die Kataloge müssen **pro Gerät** einmal geladen werden (sie wandern nicht mit
> der JSON-Sicherung mit). Nach einem Katalog-Update einfach die neue Datei
> erneut laden.

---

## 4. Charaktere verwalten

Auf dem Startbildschirm:

- **+ Neuer Charakter** — leeren Charakter anlegen (Name eingeben).
- **Umbenennen** / **Löschen** — pro Charakter.
- **XML importieren** — einen Charakter aus dem Genesis-Charakterbogen
  (`.sr6char`-Export als XML) einlesen. Dabei werden Waffen (auch auf Drohnen),
  Reservemunition und — sofern vorhanden — die magische Veranlagung übernommen.
  Ist ein Waffenkatalog geladen, werden die Waffenwerte daraus ergänzt.

Tippe einen Charakter an, um seinen Bogen zu öffnen. Mit **‹** oben links geht es
zurück zur Auswahl. Der zuletzt geöffnete Charakter wird beim nächsten Start
wieder angezeigt.

---

## 5. Der Charakterbogen

Oben gibt es Reiter: **Waffen** und — bei magischen Charakteren — **Magie**.
Der aktive Reiter ist farblich markiert (Waffen = bernstein, Magie = blau).

### 5.1 Waffen & Munition

Jede Waffe ist eine Karte mit:

- **Name** (oben) und Munitionszähler **geladen / Magazingröße**.
- **Munitions-Auswahl** (Dropdown): zeigt die passenden Reservepools mit
  Restmenge, z. B. „APDS (40)“. Hat der Waffentyp keinen Pool, erscheint das
  Dropdown in **Warnrot** mit „(0)“.
- **Feuermodi** (z. B. `SA (-1)`, `BF (-3)`, `FA (-6)`): ein Tipp zieht die
  entsprechende Patronenzahl ab.
- **− / +**: einzelne Patrone abziehen/hinzufügen. **Setzen**: geladene Menge
  direkt eingeben.
- **Nachladen**: füllt den geladenen Typ aus dem Reservepool bis zur
  Magazingröße auf. Ein Wechsel des Munitionstyps über das Dropdown legt die noch
  geladenen Patronen zuerst zurück in ihren Pool und lädt dann den neuen Typ.
- **✎** (neben dem Namen): einen **Anzeigenamen/Alias** vergeben. Anzeige dann
  „Alias (Waffenname)“.
- **🗑**: Waffe entfernen.

**Waffe hinzufügen:** In der Sektion **Waffen** auf **+ Waffe** tippen. Im Dialog:
Name, Waffentyp, max. Magazingröße und Feuermodi wählen. Mit geladenem
Waffenkatalog kannst du über **„Waffe suchen (Katalog)“** den Namen suchen — Typ,
Kapazität und Feuermodi werden automatisch ausgefüllt.

**Ausgerüstet / Verstaut:** Getragene Waffen sind in **Ausgerüstet** und
**Verstaut** unterteilt. Die Checkbox unten rechts auf der Karte schiebt eine
Waffe zwischen beiden — rein organisatorisch, die Karte bleibt voll bedienbar.

### 5.2 Drohnen

In der Sektion **Drohnen**:

- **+ Drohne** — neue Drohne anlegen (Name).
- Jede Drohne hat eine eigene Unterüberschrift mit **+ Waffe** (Waffe direkt an
  dieser Drohne montieren) und **🗑** zum Löschen der Drohne (inkl. ihrer Waffen,
  mit Rückfrage). Drohnenwaffen haben keine Ausgerüstet-Checkbox.

### 5.3 Reservemunition

In der Sektion **Reservemunition**:

- **+ Pool** — Pool anlegen: Waffentyp, Munitionstyp und Menge (nur Zahlen).
  Ein bestehender Pool gleichen Typs wird automatisch zusammengeführt (mit
  Vorschau-Hinweis).
- Pro Pool: **− / +** zum Anpassen und **🗑** zum Löschen (mit Rückfrage).

> **Hinweis zum XML-Import:** Im Genesis-Export sind Munitionsmengen in Einheiten
> zu je 10 Patronen angegeben — die App rechnet das beim Import automatisch um
> (z. B. „6“ → 60 Patronen). Magazingrößen sind bereits echte Patronenzahlen.

---

## 6. Sicherung: Daten exportieren & importieren

Da alles nur lokal liegt, ist die **JSON-Sicherung** der einzige Weg, Daten zu
sichern oder auf ein anderes Gerät zu übertragen:

- **JSON exportieren** — speichert alle Charaktere als Datei (`sr6-ammo-backup.json`).
- **JSON importieren** — liest eine solche Datei wieder ein. Der Import **führt
  zusammen**: Charaktere werden anhand ihrer ID aktualisiert bzw. ergänzt, nichts
  wird gelöscht.

Empfehlung: ab und zu exportieren, besonders vor dem Wechsel/Update des Geräts.
(Die Kataloge sind **nicht** Teil der Sicherung — auf einem neuen Gerät einmalig
neu laden, siehe Abschnitt 3.)

---

## 7. Magie: Geister beschwören

Der **Magie**-Reiter erscheint nur bei magischen Charakteren (beim XML-Import
automatisch erkannt). Voraussetzung ist ein **geladener Geisterkatalog** — sonst
ist **+ Geist** ausgegraut und ein Hinweis bittet darum, einen Katalog zu laden.

**Geist beschwören:** Auf **+ Geist** tippen. Im Dialog:

- **Name** (optional, z. B. „Ifrit“).
- **Geisttyp** — z. B. Feuergeist, Luftgeist, Erdgeist … (aus dem Katalog).
- **Kraftstufe** — über die **− / +**-Schalter einstellen. Daraus werden alle
  Attribute (Attribut = Kraftstufe + Modifikator, mindestens 1) und der
  **Zustandsmonitor** (8 + Kraftstufe/2, aufgerundet) berechnet.
- **Dienste** — Anfangszahl der geschuldeten Dienste (− / +).
- **Zusätzliche Kräfte** — auswählbar bis zur Obergrenze **Kraftstufe ÷ 3**
  (abgerundet); ist die Grenze erreicht, lassen sich keine weiteren ankreuzen.
  Eine Zeile zeigt „x von y ausgewählt“.

Danach erscheint eine **Geist-Karte** mit:

- Kopfzeile „Name (Geisttyp, Kraftstufe: x)“.
- Werte-Tabelle (Konstitution … Charisma, dazu Magie/Essenz und Zustandsmonitor).
- **Kräfte**, **Zusätzliche Kräfte**, **Fertigkeiten** und **Schwächen**.
- Unten rechts die **Dienste** mit **− / +**.
- **✎** zum Umbenennen, **🗑** zum Entlassen des Geistes.

> Geister speichern ihre Werte beim Beschwören mit ab und bleiben so auch nach
> einem Katalog-Wechsel lesbar; der angezeigte **Typname** wird aber, wenn ein
> Katalog geladen ist, stets aus dem aktuellen Katalog übernommen.

---

## 8. Tipps & Fehlerbehebung

- **Nach einem Update siehst du noch die alte Version?** Seite neu laden (ggf.
  „hart“ neu laden / Cache leeren). Als installierte App: einmal online starten.
- **Munitions-Auswahl ist rot mit „(0)“:** Für diesen Waffentyp gibt es noch
  keinen Reservepool — unter **Reservemunition** mit **+ Pool** anlegen.
- **„+ Geist“ ist ausgegraut:** Es ist (noch) kein Geisterkatalog geladen — siehe
  Abschnitt 3.
- **Daten weg nach Browser-Reinigung?** Der lokale Speicher wurde gelöscht.
  Deshalb regelmäßig per **JSON exportieren** sichern.
- **Anderes Gerät/Browser:** Daten über JSON übertragen und die Kataloge dort
  einmalig neu laden. `localhost` und die Online-Adresse haben getrennte Speicher.
