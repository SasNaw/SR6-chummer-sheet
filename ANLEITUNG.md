# SR6 Munitions- & Geister-Tracker — Anleitung

Eine mobilfreundliche Web-App, um im Shadowrun-6-Spiel den Überblick zu behalten:
Munition pro Waffe, Reservemunition, Drohnen-Bewaffnung und beschworene Geister —
für mehrere Charaktere, ohne App-Store, ohne Server.

**App-Adresse:** https://sasnaw.github.io/SR6-chummer-sheet/

---

## 1. Was die App kann

- Mehrere Charaktere verwalten (auch aus dem Genesis-Charakterbogen importieren).
- Pro Waffe die geladene Munition zählen: Feuermodi (EM/HM/SM/AM) per Knopf,
  manuelles **+ / −** und **Nachladen** aus passenden Reservepools.
- Verschiedene Munitionstypen pro Waffentyp; Wechsel legt geladene Patronen
  zurück in ihren Pool.
- Waffen in **Ausgerüstet / Verstaut** trennen.
- Drohnen mit Werten, Autosofts, Fertigkeiten, Zustandsmonitor und eigener
  Bewaffnung führen, dazu die Riggerkonsole (RCC) mit Programmen und geslavten
  Drohnen.
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

## 3. Kataloge laden (Waffen, Geister & Drohnen)

Die App kennt nur wenige Waffen „ab Werk“. Für die echten Werte (Magazingrößen,
Feuermodi, Angriffswerte, Munitionstypen), die Geister-Werte und die
Drohnen-Werte gibt es drei **Katalog-Dateien**. Diese enthalten lizenziertes
Regelmaterial und sind deshalb **nicht** Teil der App — sie werden **lokal auf
dem Gerät** geladen.

### 3.1 Katalogdateien besorgen

Die Dateien bekommst du **von deiner Gruppe** (sie werden privat geteilt, nicht
über diese Seite):

- `weapons-catalog.json` — Waffenkatalog (Waffen + Munitionstypen)
- `spirits-catalog.json` — Geisterkatalog (Geistertypen, Werte, Kräfte)
- `drones-catalog.json` — Drohnenkatalog (Drohnen, Autosofts, Riggerkonsolen)

Die Dateien auf das Gerät herunterladen, mit dem du die App nutzt.

### 3.2 Kataloge in der App importieren

1. Startbildschirm (Charakterauswahl) öffnen.
2. Auf **„Waffenkatalog laden“** tippen und `weapons-catalog.json` auswählen.
   → Status zeigt z. B. „Waffenkatalog: 237 Waffen“.
3. Auf **„Geisterkatalog laden“** tippen und `spirits-catalog.json` auswählen.
   → Status zeigt z. B. „Geisterkatalog: 6 Geister“.
4. Auf **„Drohnenkatalog laden“** tippen und `drones-catalog.json` auswählen.
   → Status zeigt „Drohnenkatalog: … Drohnen“.

Die Kataloge bleiben auf dem Gerät gespeichert, bis du sie über **„Katalog
löschen“**, **„Geisterkatalog löschen“** bzw. **„Drohnenkatalog löschen“** wieder
entfernst. Mit **„Waffe suchen (Katalog)“** kannst du beim Anlegen einer Waffe
nach Namen suchen, und der **+ Geist**-Knopf ist nur aktiv, wenn ein
Geisterkatalog geladen ist.

> Die Kataloge müssen **pro Gerät** einmal geladen werden (sie wandern nicht mit
> der JSON-Sicherung mit). Nach einem Katalog-Update einfach die neue Datei
> erneut laden.
>
> **Drohnenwerte kommen beim XML-Import:** Lade den Drohnenkatalog **vor** dem
> Import der Charakter-XML. Wurde der Charakter ohne Katalog importiert (oder vor
> diesem App-Update), fehlen Werte, Autosofts und RCC — dann die XML erneut
> importieren.
>
> **Waffenmodifikationen:** Genesis speichert in der XML nur, *welche* Zubehörteile
> und Modifikationen (z. B. Smartgun, Schulterpolster, Vordergriff) an einer
> Waffe hängen und welche ihrer Bedingungen angehakt sind — nicht den fertigen
> Angriffswert. Die App rechnet die Boni beim Import mit dem Waffenkatalog nach.
> Dafür braucht es einen Waffenkatalog **ab Oktober 2026** (mit Modifikationen);
> mit einem älteren Katalog werden nur die Grundwerte übernommen.

---

## 4. Charaktere verwalten

Auf dem Startbildschirm:

- **+ Neuer Charakter** — leeren Charakter anlegen (Name eingeben).
- **Umbenennen** / **Löschen** — pro Charakter.
- **XML importieren** — einen Charakter aus dem Genesis-Charakterbogen
  (`.sr6char`-Export als XML) einlesen. Dabei werden Waffen, Reservemunition,
  Drohnen (mit Autosofts und ihren Waffen), die Riggerkonsole und — sofern
  vorhanden — die magische Veranlagung übernommen. Geladene Kataloge ergänzen
  Waffen- und Drohnenwerte; also die Kataloge **vor** dem Import laden.
  Ein erneuter Import legt einen **neuen** Charakter an — der alte (mit
  verschossener Munition usw.) bleibt bestehen.

Tippe einen Charakter an, um seinen Bogen zu öffnen. Mit **‹** oben links geht es
zurück zur Auswahl. Der zuletzt geöffnete Charakter wird beim nächsten Start
wieder angezeigt.

---

## 5. Der Charakterbogen

Oben gibt es Reiter: **Waffen**, **Drohnen** und — bei magischen Charakteren —
**Magie**. Der aktive Reiter ist farblich markiert (Waffen = bernstein,
Drohnen = grün, Magie = blau). Rechts daneben sitzt der passende Knopf zum
Hinzufügen (**+ Waffe** bzw. **+ Drohne**).

### 5.1 Waffen & Munition

Im Reiter **Waffen** stehen die getragenen Waffen. Jede Waffe ist eine Karte mit:

- **Name** (oben) mit **✎** (Waffe bearbeiten) und **🗑** (Waffe entfernen, mit
  Rückfrage).
- **AW** — Angriffswert für die fünf Entfernungsstufen; „—“ heißt: kein Wert in
  dieser Entfernung.
- Munitionszähler **geladen / Magazingröße** und der geladene Munitionstyp.
- **Wechseln** — Munitionstyp wechseln: Pool aus der Liste wählen. Die noch
  geladenen Patronen wandern zuerst zurück in ihren Pool, dann wird aus dem
  gewählten Pool geladen. Hat der Waffentyp keinen Pool, ist der Knopf
  **warnrot**.
- **Feuermodi** (z. B. `EM (-1)`, `HM (-2)`, `SM (-4)`, `AM (-10)`): ein Tipp
  zieht die entsprechende Patronenzahl ab.
- **− / +**: einzelne Patrone abziehen/hinzufügen.
- **Nachladen**: füllt den geladenen Typ aus dem Reservepool bis zur
  Magazingröße auf.

**Waffe hinzufügen / bearbeiten:** **+ Waffe** bzw. **✎** öffnet denselben Dialog:
Name, optionaler **Alias** (Anzeige dann „Alias (Waffenname)“), Waffentyp,
Magazingröße, Feuermodi und Angriffswerte. Mit geladenem Waffenkatalog kannst du
über **„Waffe suchen (Katalog)“** den Namen suchen — die Werte werden automatisch
ausgefüllt.

**Ausgerüstet / Verstaut:** Getragene Waffen sind in **Ausgerüstet** und
**Verstaut** unterteilt. Die Checkbox unten rechts auf der Karte schiebt eine
Waffe zwischen beiden — rein organisatorisch, die Karte bleibt voll bedienbar.

### 5.2 Drohnen

Der Reiter **Drohnen** zeigt von oben nach unten:

- **RCCs** — die Riggerkonsole (falls vorhanden) mit ihren Werten und:
  - **Aktiv / Installiert**: Programme und Autosofts der Konsole. Ein Tipp
    startet bzw. beendet ein Programm; mehr als die Programmplätze erlauben
    lassen sich nicht starten.
  - **Geslavte Drohnen** (z. B. 5/12, Maximum = Gerätestufe × 3): ein Tipp auf
    eine Drohne slavt sie an die Konsole bzw. löst sie. Nur geslavte Drohnen
    nutzen die aktiven Autosofts der Konsole.
- **Drohnen** — eine Karte pro Drohne mit **✎** (bearbeiten) und **🗑** (löschen
  inkl. ihrer Waffen, mit Rückfrage):
  - **Werte** (Handling, Beschleunigung, Rumpf, Panzerung, Pilot, Sensor, …).
  - **Initiative** sowie die **Autosofts** der Drohne und der Konsole
    („Autosofts (RCC)“) und laufende **Programme**.
  - **Fertigkeiten**: Ausweichen (Pilot + Ausweichen), Wahrnehmung
    (Sensor + Clearsight), Steuern (Pilot + Manövrieren), Heimlichkeit
    (Pilot + Stealth). Fehlt das Autosoft, zählt es als 0.
  - **AW** (Manövrieren + Sensor), **VW** (Manövrieren + Panzerung) und
    **Schaden widerstehen** (Rumpf; Steel Lynx +3 für die Keramikpanzerung).
  - **Zustandsmonitor**: Kästchen antippen, um Schaden einzutragen.
  - Darunter die **Waffen der Drohne** als eigene Karten (wie im Reiter Waffen,
    ohne Ausgerüstet-Checkbox). Hat die Drohne ein Zielerfassungs-Autosoft für
    diese Waffe, steht dort **Zielerfassung** (Sensor + Zielerfassung).
    **+ Waffe** montiert eine weitere Waffe an dieser Drohne.
- **Reservemunition** — dieselben Pools wie im Reiter Waffen (siehe 5.3).

Ohne Drohnenkatalog beim Import zeigt eine Drohne statt der Werte einen Hinweis
(siehe 3.2).

### 5.3 Reservemunition

In der Sektion **Reservemunition** (in den Reitern Waffen und Drohnen):

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

- **Nach einem Update siehst du noch die alte Version?** Die App lädt Updates im
  Hintergrund — beim **nächsten** Öffnen bzw. Neuladen ist die neue Version da.
  Als installierte App: einmal online starten, schließen, erneut öffnen.
- **„Wechseln“ ist rot:** Für diesen Waffentyp gibt es noch keinen
  Reservepool — unter **Reservemunition** mit **+ Pool** anlegen.
- **Drohne zeigt „Keine Werte“ oder es fehlt die RCC:** Drohnenkatalog laden und
  die Charakter-XML erneut importieren (siehe 3.2).
- **Roter Hinweis oben zum Speicher:** Die App konnte nicht speichern (Speicher
  voll oder gesperrt) oder musste gespeicherte Daten wiederherstellen. Sofort per
  **JSON exportieren** sichern; bei „App startet leer“ den letzten JSON-Export
  importieren.
- **„+ Geist“ ist ausgegraut:** Es ist (noch) kein Geisterkatalog geladen — siehe
  Abschnitt 3.
- **Daten weg nach Browser-Reinigung?** Der lokale Speicher wurde gelöscht.
  Deshalb regelmäßig per **JSON exportieren** sichern. Auf dem iPhone löscht
  Safari die Daten einer Webseite, die 7 Tage nicht geöffnet wurde — als App auf
  dem Home-Bildschirm (siehe 2.2) passiert das nicht.
- **Anderes Gerät/Browser:** Daten über JSON übertragen und die Kataloge dort
  einmalig neu laden. `localhost` und die Online-Adresse haben getrennte Speicher.
