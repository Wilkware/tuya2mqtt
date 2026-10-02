# Changelog

Alle nennenswerten Änderungen an tuya2mqtt werden in dieser Datei dokumentiert.
Das Format basiert auf [Keep a Changelog](https://keepachangelog.com/de/1.1.0/), die Versionierung folgt [Semantic Versioning](https://semver.org/lang/de/).

## 1.5.0 - 2026-10-01

### Hinweise zum Update

- **Docker:** Der Container läuft nicht mehr als root, sondern als Benutzer `node` (UID 1000). `config.json` und `devices.conf` müssen auf dem Host für diesen Benutzer lesbar sein, z. B. `sudo chown 1000:1000 config.json devices.conf`. Andernfalls startet der Container nicht.
- **Status-Topics** (`<topic>/<gerät>/status` und das neue `<topic>/bridge/status`) werden jetzt immer mit Retain-Flag publiziert. Im Broker bleibt daher stets der letzte Status gespeichert.
- **Subscriptions:** tuya2mqtt abonniert nur noch die Command-Topics (`+/command`, `+/+/command`, `+/dps/+/command`) statt `<topic>#`.
- **Node.js** ab Version 18 erforderlich.

### Hinzugefügt

- Eigener Status der Bridge unter `<topic>bridge/status` (`online`/`offline`), abgesichert über MQTT Last Will: Bricht die Verbindung unerwartet ab, setzt der Broker den Status automatisch auf `offline`.
- Beim Beenden (SIGINT/SIGTERM) melden alle Geräte und die Bridge `offline`, danach wird die MQTT-Verbindung geordnet geschlossen.
- Umgebungsvariable `CONFIG_DIR`, um das Verzeichnis für `config.json` und `devices.conf` festzulegen (Standard: Programmverzeichnis).
- Optionen `qos` und `retain` in `config.json` werden jetzt tatsächlich verwendet und sind dokumentiert.
- Das Basis-Topic darf mehrstufig sein (z. B. `home/tuya/`), ein fehlender abschließender `/` wird ergänzt.
- Docker-Images für `linux/amd64`, `linux/arm64` und `linux/arm/v7` (z. B. Raspberry Pi) auf `ghcr.io/wilkware/tuya2mqtt`, mit Versions-Tags bei Git-Tags `v*`.

### Geändert

- Verbindungsaufbau zu Geräten überarbeitet: nur noch eine Retry-Schleife pro Gerät, Timeout für den Verbindungsaufbau (inkl. Session-Key-Aushandlung bei Protokoll 3.4/3.5), Aufräumen hängender Verbindungen und ein Watchdog, der ein Gerät nie ohne aktiven Reconnect offline lässt.
- Ist ein Gerät nicht erreichbar, verdoppelt sich die Wartezeit zwischen den Verbindungsversuchen nach jedem Fehlversuch (10 s bis maximal 5 min). Nach einer erfolgreichen Verbindung beginnt sie wieder bei 10 s. Fehlgeschlagene Versuche werden nur beim ersten und danach bei jedem 10. Versuch geloggt, so bleibt das Log auch bei längerer Abwesenheit eines Geräts klein.
- Werte werden nur noch publiziert, wenn sie sich tatsächlich geändert haben – auch bei `issueGenericDpsTopics: false`.
- `issueRefreshOnConnect` und `issueRefreshOnPing` werden jetzt auch bei Geräten ohne feste IP aus der Konfiguration übernommen (die bisherigen Standardwerte bleiben gleich).
- Dockerfile: Start direkt mit `node` (Signale kommen beim Prozess an), Info- und Fehlerausgaben standardmäßig aktiv (`DEBUG=tuya2mqtt:info,tuya2mqtt:error`), unnötiges `EXPOSE 3000` entfernt, schlankeres Image durch erweiterte `.dockerignore`.
- `mathjs` von 8.1.1 auf 15.2.0 aktualisiert, `tuyapi` exakt auf 7.7.1 festgelegt.
- README: Status-Topic korrekt als `status` (statt `state`) dokumentiert, Konfigurationsoptionen und Docker-Betrieb ergänzt.

### Behoben

- Nach einem Reconnect zum MQTT-Broker wurden alle Geräte erneut angelegt. Das führte zu doppelten Verbindungen zum selben Gerät, die sich gegenseitig getrennt haben.
- Ein fehlgeschlagener Befehl (z. B. Timeout bei einem nicht erreichbaren Gerät) oder eine fehlgeschlagene Geräteabfrage während der Initialisierung hat die gesamte Anwendung beendet.
- Beantwortete ein Gerät nicht jede einzelne DPS-Abfrage (beim Verbinden oder per `get-states`), blieb die Abfrage ohne Timeout hängen. Danach wurden für dieses Gerät keine Werte mehr publiziert und die Heartbeat-Überwachung war deaktiviert. Alle DPS werden jetzt mit einer einzigen Abfrage und 5 s Timeout gelesen, anschließend werden alle bekannten Werte publiziert. Das gilt auch für die Schema-Abfrage beim generischen Gerät und die automatische Erkennung beim RGBTW-Licht. Antwortet ein Gerät mit einer Sequenznummer, die TuyAPI der Abfrage nicht zuordnen kann, wird die Antwort trotzdem sofort übernommen.
- RGBTW-Licht: Die automatische Erkennung der DPS-Belegung hat nie gegriffen, eine teilweise manuelle Konfiguration führte zum Absturz.
- RGBTW-Licht: Die Farbtemperatur (`color_temp_state`) ließ sich nicht setzen.
- Topic-Typ `rgbToHsb` hat beim Publizieren einen Fehler ausgelöst; die Umrechnung wird jetzt beim Befehl ausgeführt.
- `toggle` vor dem ersten bekannten Zustand und Farbbefehle vor dem ersten empfangenen Farbwert führten zu Fehlern.
- DPS-Werte ohne Inhalt haben das Publizieren der DPS-Topics abgebrochen.
- Befehle an unbekannte Geräte werden jetzt sauber protokolliert statt einen Fehler auszulösen.
- Bei einem unerwarteten Fehler wurde die Anwendung mit Exit-Code 0 beendet, jetzt mit 1 (wichtig für Restart-Policies).
- Der lokale Geräteschlüssel (local key) wurde im Debug-Log ausgegeben.

### Entfernt

- Ungenutzte Abhängigkeit `color-convert`.
- Reste der Home-Assistant-Anbindung aus dem ursprünglichen Fork (`deviceData`, `republish()`), ungenutzte Imports sowie wirkungslose Konfigurationswerte (`humidityScale`, `humidityStep`, `tempScale`, `tempStep`, `volumnScale`, `volumnStep`).

## 1.4.0 - 2026-07-20

- Betrieb als Docker-Container (siehe Commit-Historie).

Ältere Versionen sind in der [Commit-Historie](https://github.com/Wilkware/tuya2mqtt/commits/main) dokumentiert.
