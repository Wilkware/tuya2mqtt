# tuya2mqtt

[![NodeJs](https://img.shields.io/badge/Node.js-339933?logo=node.js&logoColor=white&style=flat-square)](https://nodejs.org)
[![Version](https://img.shields.io/badge/Version-1.5.0-orange.svg?style=flat-square)](https://github.com/Wilkware/tuya2mqtt)
[![License](https://img.shields.io/badge/License-MIT-yellow.svg?style=flat-square)](https://opensource.org/licenses/MIT)
[![Donate](https://img.shields.io/badge/Donate-PayPal-blue.svg?style=flat-square)](https://www.paypal.com/cgi-bin/webscr?cmd=_s-xclick&hosted_button_id=8816166)

# !!!! Important Note !!!!

This repository is actually a fork of TheAgentk tuya-mqtt repro (https://github.com/TheAgentK/tuya-mqtt.git).
But since I have changed a lot, renamed it to tuya2mqtt and wanted to use it as a private repository, there was no other way.

# !!!! Wichtiger Hinweis !!!!

Dieses Repository ist ein Fork des tuya-mqtt-Repos von TheAgentK (https://github.com/TheAgentK/tuya-mqtt.git).
Da ich jedoch sehr viele Änderungen vorgenommen habe, es in tuya2mqtt umbenannt und als privates Repository nutzen wollte, gab es keinen anderen Weg.

## Über das Projekt

Dieses Projekt ist eine Brücke, die es ermöglicht, IoT-Geräte des Herstellers Tuya Inc. – die unter vielen verschiedenen Markennamen verkauft werden – lokal über einfache MQTT-Topics zu steuern. Es übersetzt effektiv das Tuya-Protokoll in leicht verständliche MQTT-Themen.

Die Nutzung dieses Skripts erfordert, dass für jedes Gerät die Device-ID und der lokale Schlüssel (local key) beschafft wird, nachdem die Geräte über die Tuya/Smart Life-App oder eine andere kompatible Tuya-App eingerichtet wurden. Mit diesen Informationen ist es möglich, lokal mit Tuya-Geräten zu kommunizieren – ganz ohne die Tuya-Cloud.
Das Beschaffen der Schlüssel setzt jedoch die Registrierung für ein Tuya IoT Developer-Konto voraus oder die Nutzung alternativer Methoden (z. B. das Auslesen des Speichers einer Tuya-basierten Android-App).

Anleitungen zum Ermitteln der Gerätedaten findest du im TuyAPI-Projekt, auf dem dieses Skript basiert:
👉 [TuyAPI GitHub Site](https://github.com/codetheweb/tuyapi/blob/master/docs/SETUP.md).

**Das Beschaffen von Geräteschlüsseln gehört nicht zum Umfang dieses Projekts!**

Fehlermeldungen zu diesem Thema werden wahrscheinlich ohne Kommentar geschlossen.
Bitte prüfe vor dem Eröffnen eines Issues, ob dein Gerät sich mit tuya-cli auslesen und steuern lässt.
Falls tuya-cli dein Gerät nicht steuern kann, wird es auch mit diesem Projekt nicht funktionieren.

## Installation

Lade dieses Projekt auf dein System herunter – in ein beliebiges Verzeichnis (im folgenden Beispiel wird /opt/tuya2mqtt verwendet) – und installiere TuyAPI im selben Ordner, in dem sich auch die Datei tuya2mqtt.js befindet.

```
// switch to opt directory
cd /opt

// clone this project
git clone https://github.com/wilkware/tuya2mqtt

// change directory to the project directory
cd tuya2mqtt

// installs this project along with codetheweb/tuyapi project
npm install

// installs this project as system service
sudo cp ./docs/tuya2mqtt.service /etc/systemd/system

// Reload systemd to recognize new or changed unit files
sudo systemctl daemon-reexec
sudo systemctl daemon-reload

// Enable the service to start automatically on boot
sudo systemctl enable tuya2mqtt.service

// Start the service immediately
sudo systemctl start tuya2mqtt.service

// Check the current status of the service
sudo systemctl status tuya2mqtt.service

```

## Konfiguration

tuya2mqtt verwendet zwei verschiedene Konfigurationsdateien.

Die erste ist `config.json`, welche die Einstellungen für die Verbindung zum MQTT-Broker enthält.

Die zweite ist `devices.conf`, eine im JSON5-Format geschriebene Datei, die die Tuya-Geräte definiert, mit denen das Skript sich verbinden und die es über MQTT verfügbar machen soll.
Diese Datei verwendet das gleiche grundlegende Format, das auch vom „tuya-cli wizard“ beim Auslesen der Geräteschlüssel erzeugt wird. Daher kann sie direkt als Grundlage für die tuya2mqtt-Gerätekonfiguration verwendet werden.

### Einrichtung von config.json:

```
cp config.json.sample config.json
```
Bearbeite die `config.json` und trage die Einstellungen deines MQTT-Brokers ein. Speichere die Datei anschließend.
```
nano config.json
```

| Option      | Beschreibung                                                                 | Standard     |
| ----------- | ---------------------------------------------------------------------------- | ------------ |
| `host`      | Adresse des MQTT-Brokers                                                     | –            |
| `port`      | Port des MQTT-Brokers                                                        | –            |
| `topic`     | Basis-Topic, darf auch mehrstufig sein (z. B. `home/tuya/`)                  | `tuya2mqtt/` |
| `mqtt_user` | Benutzername für den MQTT-Broker                                             | –            |
| `mqtt_pass` | Passwort für den MQTT-Broker                                                 | –            |
| `qos`       | QoS-Level für alle publizierten Nachrichten                                  | `1`          |
| `retain`    | Zustands-Topics mit Retain-Flag publizieren (Status-Topics sind immer retained) | `false`   |

### Einrichtung von devices.conf:

Wenn du die Methode „tuya-cli wizard“ verwendest, um die Geräteschlüssel zu erhalten, kannst du die Ausgabe dieses Tools als Ausgangspunkt für deine `devices.conf`-Datei nutzen.
Andernfalls musst du die Datei manuell im folgenden Format erstellen:

```json
[
  {
    name: 'Tuya Device 1',
    id: '86435357d8b123456789',
    key: '8b2a69c9876543210'
  },
  {
    name: 'Tuya Device 2',
    id: 'eb532eea7d12345678abc',
    key: '899810012345678'
  }
]
```

Beachte, dass das Format `JSON5` ist – ein Superset von JSON. Das bedeutet, du kannst entweder den strikten JSON-Syntax verwenden, das flexiblere JSON5-Format, oder sogar beides gemischt in derselben Datei.

Standardmäßig versucht tuya2mqtt, das Gerät zu finden und die Tuya-Protokollversion automatisch zu erkennen. Das funktioniert jedoch nur, wenn das System, auf dem tuya2mqtt läuft, im selben Netzwerk/Subnetz wie die zu steuernden Geräte ist.
Falls dies nicht zutrifft oder die automatische Erkennung aus einem anderen Grund fehlschlägt, ist es möglich, die IP-Adresse und Protokollversion manuell anzugeben, indem du in der devices.conf die Eigenschaft `ip:` hinzufügst.

Beachte: Wenn die IP-Adresse manuell gesetzt wird, muss auch die Protokollversion manuell über den Parameter `version:` festgelegt werden – entweder "3.4" oder "3.5".

Die einfachste Möglichkeit, die richtige Protokollversion herauszufinden, besteht darin, das Gerät mit „tuya-cli“ zu testen und verschiedene Versionen auszuprobieren, um zu sehen, welche funktioniert.

Während die obige Syntax möglicherweise bereits ausreicht, um eine funktionierende tuya2mqtt-Installation mit rohen DPS-Werten bereitzustellen (zugänglich über DPS-Topics), wird der volle Funktionsumfang von tuya2mqtt erst durch die Konfiguration von Gerätetypen entfaltet.

Bitte sieh dir die vollständige [DEVICES](docs/DEVICES.md)-Dokumentation an, um weitere Details zu erhalten.


### Direktes starten von tuya2mqtt

```
node tuya2mqtt.js
```
Um Debug-Ausgaben zu aktivieren (erforderlich beim Eröffnen eines Issues):
```
DEBUG=tuya2mqtt:* tuya2mqtt.js
```

### Überblick zur Verwendung

Tuya-Geräte funktionieren, indem sie Gerätefunktionen bestimmten Werten zuordnen, die in sogenannten Datenpunkten (DPS-Werten) gespeichert sind. Jeder dieser Werte wird über eine Indexnummer, den sogenannten DPS-Key, referenziert.

Beispiel: Ein einfacher Ein-/Aus-Schalter kann einen einzigen DPS-Wert besitzen, z. B. DPS-Key 1 (DPS1). Dieser Wert hat dann typischerweise den Status `true`/`false`, was dem Ein-/Aus-Zustand des Geräts entspricht.
Der Gerätestatus kann über DPS1 ausgelesen werden, und bei veränderbaren Werten (einige DPS-Werte sind nur lesbar) kann durch das Senden von `true` oder `false` an DPS1 das Gerät ein- bzw. ausgeschaltet werden.

Ein einfacher Dimmer könnte ebenfalls DPS1 für den Schaltzustand verwenden, aber zusätzlich einen weiteren DPS2-Wert, der z. B. von 1–255 reicht und den Dimmwert repräsentiert.
Komplexere Geräte verwenden weitere DPS-Keys, deren Werte die unterschiedlichen Zustände und Steuerfunktionen des Geräts abbilden.

Das tuya2mqtt-Skript stellt den Zugriff auf diese DPS-Keys und ihre Werte über MQTT zur Verfügung. Damit können alle Tools, die MQTT unterstützen, diese Geräte im lokalen Netzwerk überwachen und steuern.

Neben dem Zugriff auf die rohen DPS-Daten bietet tuya2mqtt auch eine Template-Engine, mit der diese DPS-Werte auf gerätetypische Topics (sogenannte „Friendly Topics“) abgebildet werden können. Dadurch wird eine einheitliche Zuordnung ermöglicht – selbst zwischen Geräten, die unterschiedliche DPS-Keys für die gleiche Funktion verwenden.

Diese „Friendly Topics“ unterstützen außerdem verschiedene Transformationen und Hilfsfunktionen, die die Kommunikation mit Tuya-Geräten erheblich vereinfachen – auch ohne tiefes Verständnis der internen Tuya-Datenformate.

### Überblick über MQTT-Themen (Topics)

Die oberste Topic-Ebene wird anhand des Gerätenamens oder der Geräte-ID erstellt.
Wenn ein Gerätename verfügbar ist, wird dieser in Kleinbuchstaben umgewandelt und Leerzeichen durch Unterstriche (_) ersetzt.
Beispiel: Hat das Gerät den Namen „Kitchen Table“, lautet das Top-Level-Topic:

```bash
tuya/kitchen_table/
```
Wenn kein Gerätename in der devices.conf vorhanden ist, verwendet tuya2mqtt stattdessen die Geräte-ID:
```swift
tuya/86435357d8b123456789/
```
Alle weiteren Status- und Befehls-Topics werden hierarchisch unterhalb dieser Ebene aufgebaut.
Der Status des Geräts (ob online oder offline) kann über das folgende Topic abgefragt werden:
```bash
tuya/kitchen_table/status --> online/offline
```
Zusätzlich meldet tuya2mqtt seinen eigenen Status. Bricht die Verbindung zum Broker unerwartet ab, setzt der Broker dieses Topic über den MQTT „Last Will“ automatisch auf `offline`:
```bash
tuya/bridge/status --> online/offline
```
Beide Status-Topics werden mit Retain-Flag publiziert, sodass auch später verbundene Clients den aktuellen Status erhalten.

Das Skript überwacht dazu sowohl die Socket-Verbindung als auch die Heartbeats des Geräts, um den aktuellen Status korrekt zu melden. Du kannst das Gerät dazu bringen, sofort alle bekannten DPS-Werte zu senden, indem du die Nachricht `get-states` an das Command-Topic sendest:
```swift
tuya/kitchen_table/command <-- get-states
```
Wie bereits erwähnt, unterstützt tuya2mqtt zwei Arten von MQTT-Topics zur Steuerung und Überwachung von Geräten:

- DPS-Topics → immer verfügbar
- „Friendly Topics“ → empfohlen, erfordern aber ein passendes Gerätetemplate

Die „Friendly Topics“ sind in der Regel die bessere Wahl, da sie eine einheitliche Struktur für verschiedene Geräte ermöglichen – selbst wenn die DPS-Keys unterschiedlich sind.
Damit das funktioniert, musst du entweder ein vordefiniertes Gerätetemplate verwenden oder für dein Gerät ein eigenes Template erstellen (bei generischen Geräten).

Wenn du ein Template für dein Gerät erstellst, teile es gern mit der Community!
Neue, vordefinierte Templates werden für zukünftige Versionen von tuya2mqtt ausdrücklich gewünscht.
Einfach per Pull Request dein Template einreichen kannst.

## Friendly Topics

Friendly Topics sind nur verfügbar, wenn du ein vordefiniertes Gerätetemplate verwendest oder – im Fall des generischen Geräts – ein benutzerdefiniertes Template für dein Gerät definiert hast.
Friendly Topics nutzen die tuya2mqtt Template-Engine, um Tuya DPS-Key-Werte auf einfach zu nutzende Topics abzubilden und die Daten bei Bedarf zu transformieren.

Ein weiterer Vorteil der Friendly Topics ist, dass nicht alle Geräte auf Schema-Anfragen reagieren (also Anfragen, die alle vom Gerät genutzten DPS-Topics melden).
Daher ist es nicht immer möglich, dass tuya2mqtt beim Start weiß, von welchen DPS-Topics es Statusinformationen abfragen soll.
Mit einem definierten Template sind die benötigten DPS-Keys für jedes Friendly Topic festgelegt, und tuya2mqtt fragt diese DPS-Keys beim initialen Verbindungsaufbau zum Gerät immer ab und meldet deren Status korrekt.

Für weitere Details zur Nutzung von Friendly Topics lies bitte die Dokumentation unter [DEVICES](docs/DEVICES.md), die beschreibt, wie unterstützte Geräte konfiguriert oder eigene Templates definiert werden können.

## DPS Topics

Das direkte Steuern von Geräten über DPS-Topics erfordert ausreichend Kenntnisse über das Gerät, um zu wissen, welche Topics welche Werte akzeptieren. Im Folgenden werden zwei verschiedene Methoden beschrieben, um mit DPS-Werten zu interagieren: das JSON-DPS-Topic und die einzelnen DPS-Key-Topics.

### DPS JSON topic

Das JSON-DPS-Topic ermöglicht die Steuerung von Tuya-Geräten, indem man Tuya-native JSON-Nachrichten an das Command-Topic sendet und Tuya-JSON-Antworten im State-Topic überwacht.

Weitere Details zu diesem Format findest du in der [TuyAPI documentation](https://codetheweb.github.io/tuyapi/index.html).

Zum Beispiel könntest du einen Dimmschalter ausschalten, indem du eine MQTT-Nachricht mit dem JSON-Wert  
```{dps: 1, set: false}``` an das DPS/command-Topic des Geräts sendest.

Um den Dimmer einzuschalten und die Helligkeit auf 50% zu setzen, könntest du zwei separate Nachrichten senden:  
```{dps: 1, set: true}``` und danach ```{dps: 2, set: 128}```

Alternativ erlaubt das Tuya-JSON-Protokoll auch das Setzen mehrerer Werte in einem einzigen Befehl mit folgendem Format:  
```{'multiple': true, 'data': {'1': true, '2': 128}}```

JSON-Zustands- und Kommando-Nachrichten sollten jeweils über die Topics DPS/state und DPS/command laufen.

Unten ist ein Beispiel für die Topics:
```swift
tuya/dimmer_device/DPS/state
tuya/dimmer_device/DPS/command
```

### DPS Key topics

Zusätzlich zum JSON-DPS-Topic ist es auch möglich, die DPS-Key-Topics zu verwenden. DPS-Key-Topics erlauben es dir, einfache boolesche Werte, Zahlen oder Strings direkt an die DPS-Keys zu senden oder von ihnen zu empfangen, ohne das Tuya-JSON-Format selbst verwenden zu müssen. Die Umwandlung in Tuya-JSON übernimmt tuya2mqtt automatisch.

Am Beispiel von oben: Um den Dimmer einzuschalten und die Helligkeit auf 50 % zu setzen, würdest du einfach die Nachricht `true` an DPS/1/command und die Nachricht `128` an DPS/2/command senden.

```swift
tuya/dimmer_device/DPS/1/state    --> true/false for on/off state
tuya/dimmer_device/DPS/2/command  <-- 1-255 for brightness state
tuya/dimmer_device/DPS/1/state    --> accept true/false for turning device on/off
tuya/dimmer_device/DPS/2/command  <-- accepts 1-255 for controlling brightness level
```
**Wichtiger Hinweis**

Beim direkten Senden von Befehlen an DPS-Werte gibt es keine Einschränkungen, welche Werte gesendet werden, da tuya2mqtt nicht wissen kann, welche Werte für einen bestimmten DPS-Key gültig oder ungültig sind. Das Senden von Werten, die außerhalb des zulässigen Bereichs liegen oder vom falschen Typ sind, kann unvorhersehbares Verhalten des Geräts verursachen – von Timeouts über Neustarts bis hin zum Einfrieren des Geräts.
Auch wenn ich bisher noch nie erlebt habe, dass ein Gerät nach einem Neustart nicht wieder funktioniert hat, solltest du dies beim Senden von Befehlen an dein Gerät unbedingt beachten.

**Probleme**

Nicht alle Tuya-Protokolle werden unterstützt. Beispielsweise verwenden einige Geräte das Protokoll 3.2, das derzeit vom TuyAPI-Projekt nicht unterstützt wird, da nicht genügend Informationen vorliegen, um das Protokoll zu reverse-engineeren.

Wenn du deine Geräte mit tuya2mqtt nicht steuern kannst, überprüfe bitte zunächst, ob du sie mit tuya-cli abfragen und steuern kannst. Wenn tuya-cli funktioniert, sollte auch dieses Skript funktionieren. Wenn tuya-cli nicht funktioniert, wird dieses Skript ebenfalls nicht funktionieren.

## Docker

Die Anwendung kann alternativ zu einer direkten Node.js-Installation auch als Docker-Container betrieben werden.

### Voraussetzungen

* Installiertes Docker
* Optional: Portainer zur Verwaltung des Containers
* Eine vorhandene Konfiguration (`config.json` und `devices.conf`)

### Fertiges Image verwenden

Bei jedem Push auf `main` und bei jedem Versions-Tag (`v*`) wird ein Image für `linux/amd64`, `linux/arm64` und `linux/arm/v7` (z. B. Raspberry Pi) gebaut und veröffentlicht:

```bash
docker pull ghcr.io/wilkware/tuya2mqtt:latest
```

### Docker Image bauen

Alternativ im Projektverzeichnis mit der `Dockerfile` ausführen:

```bash
docker build -t tuya2mqtt:latest .
```

Optional kann eine feste Version vergeben werden:

```bash
docker build -t tuya2mqtt:1.5.0 .
```

### Konfiguration

Sensible Konfigurationsdateien werden **nicht** in das Docker-Image eingebaut.

Folgende Dateien müssen beim Start als Volume eingebunden werden:

* `config.json`
* `devices.conf`

Beispielstruktur auf dem Host:

```
/opt/services/tuya2mqtt/
├── config.json
└── devices.conf
```

### Container starten

Beispiel:

```bash
docker run -d \
  --name tuya2mqtt \
  --restart unless-stopped \
  -v /opt/services/tuya2mqtt/config.json:/app/config.json:ro \
  -v /opt/services/tuya2mqtt/devices.conf:/app/devices.conf:ro \
  tuya2mqtt:1.5.0
```

Die Konfigurationsdateien werden dabei nur lesbar (`:ro`) in den Container eingebunden.

Der Container läuft nicht als root, sondern als Benutzer `node` (UID 1000). Die Konfigurationsdateien auf dem Host müssen daher für diesen Benutzer lesbar sein, z. B.:

```bash
sudo chown 1000:1000 /opt/services/tuya2mqtt/config.json /opt/services/tuya2mqtt/devices.conf
sudo chmod 600 /opt/services/tuya2mqtt/config.json /opt/services/tuya2mqtt/devices.conf
```

Statt der einzelnen Dateien kann auch ein ganzes Verzeichnis eingebunden werden. Über die Umgebungsvariable `CONFIG_DIR` wird festgelegt, wo `config.json` und `devices.conf` gesucht werden (Standard: Programmverzeichnis):

```bash
docker run -d \
  --name tuya2mqtt \
  --restart unless-stopped \
  -e CONFIG_DIR=/config \
  -v /opt/services/tuya2mqtt:/config:ro \
  ghcr.io/wilkware/tuya2mqtt:latest
```

### Logs anzeigen

Die Container-Ausgabe kann mit folgendem Befehl angezeigt werden:

```bash
docker logs -f tuya2mqtt
```

Standardmäßig werden Info- und Fehlermeldungen ausgegeben (`DEBUG=tuya2mqtt:info,tuya2mqtt:error`).
Für detaillierte Debug-Ausgaben kann die Anwendung mit der Umgebungsvariable `DEBUG` gestartet werden:

```bash
docker run -d \
  --name tuya2mqtt \
  --restart unless-stopped \
  -e DEBUG="tuyapi*,tuya2mqtt*" \
  -v /opt/services/tuya2mqtt/config.json:/app/config.json:ro \
  -v /opt/services/tuya2mqtt/devices.conf:/app/devices.conf:ro \
  tuya2mqtt:1.5.0
```

### Portainer / Docker Compose

Beispiel für einen Portainer Stack:

```yaml
services:
  tuya2mqtt:
    image: tuya2mqtt:1.5.0
    container_name: tuya2mqtt
    restart: unless-stopped

    volumes:
      - /opt/services/tuya2mqtt/config.json:/app/config.json:ro
      - /opt/services/tuya2mqtt/devices.conf:/app/devices.conf:ro
```

Nach Änderungen am Image:

```bash
docker build -t tuya2mqtt:1.5.1 .
```

Anschließend den Container bzw. Stack neu deployen.

### Hinweis zu MQTT

Beim Betrieb in Docker darf der MQTT-Server nicht mit `localhost` angesprochen werden, sofern der MQTT-Broker außerhalb des Containers läuft.

Beispiel:

```
localhost:1883
```

funktioniert nur bei direktem Start auf dem Host.

Im Docker-Betrieb muss die erreichbare Adresse des MQTT-Brokers verwendet werden, z. B.:

```
192.168.1.10:1883
```

oder der Containername eines MQTT-Brokers im gleichen Docker-Netzwerk.

## Changelog

Alle Änderungen der einzelnen Versionen sind im [CHANGELOG](CHANGELOG.md) dokumentiert.

## Contributors

- [TheAgentK](https://github.com/TheAgentK)

## Related Projects:

- https://github.com/codetheweb/tuyapi
- https://github.com/unparagoned/njsTuya
- https://github.com/clach04/python-tuya
- https://github.com/Marcus-L/m4rcus.TuyaCore
- Specs: https://docs.tuya.com/en/cloudapi/cloud_access.html

[![forthebadge](https://forthebadge.com/images/badges/made-with-javascript.svg)](https://forthebadge.com)
[![forthebadge](https://forthebadge.com/images/badges/built-with-love.svg)](https://forthebadge.com)
