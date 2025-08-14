
# tuya2mqtt – Geräte (Devices)

## Übersicht

Die wichtigste Funktion von **tuya2mqtt** ist die Möglichkeit, Geräte so zu konfigurieren, dass sie **benutzerfreundliche MQTT-Topics** verwenden. Für einige Geräte gibt es bereits vordefinierte Gerätetemplates, die die Verwendung stark vereinfachen. Dazu musst du nur die Typinformation in der `devices.conf`-Datei hinzufügen. **tuya2mqtt** erstellt dann automatisch die benutzerfreundlichen Topics für das jeweilige Gerät.

Diese Topics ermöglichen eine einfache Kommunikation mit dem Gerät in standardisierter Form – ideal zur Integration in **Smart-Home-Plattformen** wie **IP Symcon**.

## Vordefinierte Gerätetemplates

| Gerätetyp                       | Beschreibung                                                   |
|---------------------------------|----------------------------------------------------------------|
| [SimpleSwitch](#SimpleSwitch)   | Unterstützt einfache Geräte mit Ein/Aus                        |
| [SimpleDimmer](#SimpleDimmer)   | Unterstützt Geräte mit Ein/Aus und Helligkeit                  |
| [RGBTWLight](#RGBTWLight)       | Unterstützt Farb-/Weißlicht mit optionaler Farbtemperatur      |
| [CeilingFan](#CeilingFan)       | Unterstützt Deckenventilator inkl. Licht und Geschwindigkeit   |
| [VacuumCleaner](#VacuumCleaner) | Unterstützt einfache Saugroboter                               |
| [GenericDevice](#VacuumCleaner) | Benutzerdefiniertes Template für beliebige Geräte              |

Um ein Gerätetemplate zu verwenden, füge einfach die Option "type" in der Datei `devices.conf` hinzu, zum Beispiel so:
```json
[
  {
    "name": "Tuya Device 1",
    "id": "86435357d8b123456789",
    "key": "8b2a69c9876543210",
    "type": "VacuumCleaner"
  }
]
```

Sobald der Gerätetyp definiert ist, versucht tuya2mqtt, beim Herstellen der Verbindung automatisch die MQTT-Topics für diesen Gerätetyp zu erstellen.

Jeder Gerätetyp bringt vordefinierte Standardwerte für die DPS-Schlüssel mit, die für typische Tuya-Geräte üblich sind. Einige Gerätetypen – z. B. RGBTWLight – enthalten zusätzlich eine Logik zur automatischen Erkennung von Variationen, indem das Gerät aktiv abgefragt wird.

Das Ziel ist, dass in den meisten Fällen das einfache Hinzufügen des "type"-Eintrags bereits ausreicht. Bei Bedarf lassen sich die Einstellungen jedoch auch manuell überschreiben.

Die verfügbaren MQTT-Topics und Optionen für jeden Gerätetyp sind in den folgenden Abschnitten dokumentiert.

### SimpleSwitch

Einfaches Gerät mit nur Ein/Aus-Funktion.

**Topics:**

| Topic    | Beschreibung    | Werte                   |
|----------|-----------------|-------------------------|
| state    | Betriebszustand | on / off                |
| command  | Schaltbefehl    | on/off, 0/1, true/false |

**Manuelle Konfigurationsoptionen:**

| Option    | Beschreibung               | Standard |
|-----------|----------------------------|----------|
| dpsPower  | DPS-Schlüssel für Zustand  | 1        |

### SimpleDimmer

Gerät mit Ein/Aus und Helligkeit (z. B. Dimmer).

**Topics:**

| Topic                 | Beschreibung               | Werte                   |
|-----------------------|----------------------------|-------------------------|
| state                 | Betriebszustand            | on / off                |
| command               | Schaltbefehl               | on/off, 0/1, true/false |
| brightness_state      | Helligkeit in %            | 0–100                   |
| brightness_command    | Setze Helligkeit in %      | 0–100                   |

**Manuelle Konfigurationsoptionen:**

| Option           | Beschreibung                   | Standard |
|------------------|--------------------------------|----------|
| dpsPower         | DPS-Schlüssel für Strom        | 1        |
| dpsBrightness    | DPS-Schlüssel für Helligkeit   | 2        |
| brightnessScale  | Skalierung für Helligkeit      | 255      |

### RGBTWLight

Das Gerät RGBTWLight unterstützt Tuya-Farblichtquellen (z. B. Glühbirnen und LED-Streifen). Tuya-Lichter arbeiten entweder im Weißmodus oder im Farbenmodus. Das RGBTWLight-Gerät wechselt automatisch zwischen den Modi basierend auf folgenden Bedingungen:

| Bedingung                                       | Modus           |
| ----------------------------------------------- | --------------- |
| Änderung der Weißhelligkeit                     | weiß            |
| Änderung der Farbtemperatur (falls unterstützt) | weiß            |
| Sättigung < 10 %                                | weiß            |
| Sättigung ≥ 10 %                                | farbe           |
| Alle anderen Änderungen                         | aktueller Modus |

Das bedeutet: Ein Wechsel des Farbtons führt nur dann zum Farbenmodus, wenn die Sättigung ebenfalls ≥ 10 % beträgt. Manche Lichter versuchen zwar automatisch, in den Farbenmodus zu wechseln, sobald irgendein HSB-Wert geändert wird – aber wenn die Sättigung unter 10 % bleibt, zwingt tuya2mqtt die Lampe zurück in den Weißmodus. Das kann zu einem kurzen Flackern führen, wenn man z. B. Farbton oder Farbhelligkeit verändert, während die Sättigung noch unter dem Schwellenwert liegt. Dies ist allerdings selten und wurde bewusst so implementiert, um ein konsistentes Verhalten über alle Tuya-Leuchten hinweg zu gewährleisten.

Wenn die Lampe im Weißmodus ist, wird die Sättigung in den Friendly Topics immer mit 0 % angegeben – auch dann, wenn man manuell mit mode_command oder der Tuya/SmartLife-App zwischen den Modi umschaltet. Wechselt die Lampe zurück in den Farbenmodus, wird die korrekte Sättigung wiedergegeben. Dies dient insbesondere dazu, Automatisierungsplattformen ohne explizite Weiß-/Farben-Modusunterscheidung zu unterstützen – andernfalls könnte eine weiße Lampe mit Farbsymbol angezeigt werden.

Nicht alle Geräte unterstützen Farbtemperatur. Das Skript versucht, diese Fähigkeit automatisch zu erkennen und aktiviert die entsprechenden Topics nur, wenn sie vorhanden sind. Farbtemperaturen werden in Mireds (ein in Automatisierungstools gängiges Maß) übermittelt. Der Standardbereich entspricht etwa 2500 K–6500 K. Für die meisten Tuya-Leuchten funktioniert dies gut. Wer die genauen Grenzen kennt, kann diese manuell anpassen.

Tuya-Leuchten speichern ihre HSB-Farbwerte in einem einzigen DPS-Schlüssel mit einem eigenen Format. Manche Leuchten verwenden ein 14-stelliges Format (HSBHEX), das Sättigung und Helligkeit als 2-stellige Hex-Werte (0–255) darstellt. Andere nutzen ein 12-stelliges Format (HSB), wobei Sättigung und Helligkeit als 4-stellige Hex-Werte (0–1000) gespeichert werden. Das System versucht, das Format automatisch zu erkennen und korrekt umzuwandeln – kann aber bei Bedarf überschrieben werden.

**Topics:**

| Topic                      | Beschreibung                                       | Wertebereich                              |
| -------------------------- | -------------------------------------------------- | ----------------------------------------- |
| state                      | Schaltzustand                                      | on / off                                  |
| command                    | Setzt Schaltzustand                                | on/off, 0/1, true/false                   |
| white\_brightness\_state   | Helligkeit im Weißmodus in %                       | 0–100                                     |
| white\_brightness\_command | Setzt Helligkeit im Weißmodus in %                 | 0–100                                     |
| color\_brightness\_state   | Helligkeit im Farbenmodus in %                     | 0–100                                     |
| color\_brightness\_command | Setzt Helligkeit im Farbenmodus in %               | 0–100                                     |
| hs\_state                  | Farbton, Sättigung                                 | H,S (H: 0–360, S: 0–100)                  |
| hs\_command                | Setzt Farbton, Sättigung                           | H,S (H: 0–360, S: 0–100)                  |
| hsb\_state                 | Farbton, Sättigung, Helligkeit                     | H,S,B (H: 0–360, S: 0–100, B: 0–100)      |
| hsb\_command               | Setzt Farbton, Sättigung, Helligkeit               | H,S,B (H: 0–360, S: 0–100, B: 0–100)      |
| mode\_state                | Weiß-/Farbmodus                                    | 'white', 'colour' (teilweise auch Szenen) |
| mode\_command              | Setzt Weiß-/Farbmodus                              | 'white', 'colour' (teilweise auch Szenen) |
| color\_temp\_state         | Farbtemperatur in Mireds (falls unterstützt)       | 154–400 (Standardbereich, anpassbar)      |
| color\_temp\_command       | Setzt Farbtemperatur in Mireds (falls unterstützt) | 154–400 (Standardbereich, anpassbar)      |

**Manuelle Konfigurationsoptionen:**

| Option          | Beschreibung                           | Standard (automatische Erkennung) |
| --------------- | -------------------------------------- | --------------------------------- |
| dpsPower        | DPS-Schlüssel für Schaltzustand        | Auto (1, 20)                      |
| dpsMode         | DPS für Weiß-/Farbmodus                | Auto (2, 21)                      |
| dpsWhiteValue   | DPS für Helligkeit im Weißmodus        | Auto (3, 22)                      |
| whiteValueScale | Skalierung für Helligkeit im Weißmodus | Auto (255, 1000)                  |
| dpsColorTemp    | DPS für Farbtemperatur                 | Auto (4, 23)                      |
| minColorTemp    | Minimale Farbtemperatur in Mireds      | 154 (\~6500 K)                    |
| maxColorTemp    | Maximale Farbtemperatur in Mireds      | 400 (\~2500 K)                    |
| colorTempScale  | Skalierung der Farbtemperatur          | Auto (255, 1000)                  |
| dpsColor        | DPS für HSB-Farbwerte                  | Auto (5, 24)                      |
| colorType       | Tuya-Farbformat für DPS                | Auto ('hsb', 'hsbhex')            |

**Beispielkonfiguration:**
```json
[
  {
    "name": "Tuya Device 1",
    "id": "86435357d8b123456789",
    "key": "8b2a69c9876543210",
    "type": "RGBTWLight",
    "dpsPower": 31,
    "dpsMode": 32,
    "dpsWhiteValue": 33,
    "whiteValueScale": 255,
    "dpsColorTemp": 34,
    "minColorTemp": 165,
    "maxColorTemp": 385,
    "colorTempScale": 255,
    "dpsColor": 34,
    "colorType": "hsbhex"
  }
]
```

### CeilingFan

Ein Deckenventilator inkl. Licht, Geschwindigkeit und Ein/Aus-Funktion.

**Topics:**

| Topic                    | Beschreibung                      | Wertebereich                                   |
| ------------------------ | --------------------------------- | ---------------------------------------------- |
| light\_state             | Schaltzustand Licht               | true / false                                   |
| light\_command           | Schaltet Licht ein/aus            | on/off, 0/1, true/false                   |
| color\_temp\_state       | Aktuelle Farbtemperatur           | 0, 500 oder 1000                               |
| color\_temp\_command     | Setzt Farbtemperatur              | 0, 500 oder 1000                               |
| fan\_state               | Schaltzustand Lüfter              | true / false                                   |
| fan\_command             | Schaltet Lüfter ein/aus           | on/off, 0/1, true/false                   |
| speed\_state             | Aktuelle Lüftergeschwindigkeit    | 1–6                                            |
| speed\_command           | Setzt Lüftergeschwindigkeit       | 1–6                                            |
| direction\_state         | Aktuelle Lüfter-Richtung          | 'Forward' oder 'Reverse'                       |
| direction\_command       | Setzt Lüfter-Richtung             | 'Forward' oder 'Reverse'                       |
| countdown\_left\_state   | Verbleibende Countdown-Zeit (Min) | 0–540                                          |
| countdown\_left\_command | Setzt Countdown-Zeit              | 0–540                                          |
| beep\_state              | Status Signalton                  | true / false                                   |
| beep\_command            | Signalton ein/aus                 | on/off, 0/1, true/false                   |

**Manuelle Konfigurationsoptionen:**

| Option       | Beschreibung                      | Standard (automatische Erkennung) |
| ------------ | --------------------------------- | --------------------------------- |
| dpsLight     | DPS für Schaltzustand des Lichts  | 20                                |
| dpsColorTemp | DPS für Farbtemperatur            | 23                                |
| dpsFan       | DPS für Lüfter                    | 60                                |
| dpsSpeed     | DPS für Lüftergeschwindigkeit     | 62                                |
| dpsDirection | DPS für Lüfterrichtung            | 63                                |
| dpsCountdown | DPS für Countdown-Timer (Minuten) | 64                                |
| dpsBeep      | DPS für Signalton                 | 66                                |

### VacuumCleaner

Steuerung von Saugrobotern

| Topic                       | Beschreibung                       | Wertebereich                       |
| --------------------------- | ---------------------------------- | ---------------------------------- |
| power\_state                | Schaltzustand des Geräts           | true / false                       |
| power\_command              | Schaltet das Gerät ein/aus         | true / false                       |
| mode\_state                 | Aktueller Reinigungsmodus          | 'standby', 'smart', 'wall_follow', 'spiral', 'partial_bow', 'chargego' |
| mode\_command               | Setzt Reinigungsmodus              | 'standby', 'smart', 'wall_follow', 'spiral', 'partial_bow', 'chargego' |
| direction\_control\_state   | Aktuelle Steuerungsrichtung        | 'forward', 'turn_left', 'turn_right', 'stop', 'exit' |
| direction\_control\_command | Setzt Steuerungsrichtung           | 'forward', 'turn_left', 'turn_right', 'stop', 'exit' |
| working\_status\_state      | Gerätestatus (nur lesbar)          | 'standby', 'smart_clean', 'wall_clean', 'spot_clean', 'mop_clean', 'goto_charge', 'charging', 'charge_done', 'paused', 'cleaning', 'sleep' |
| battery\_left\_state        | Akkustand in %                     | 0–100                              |
| edge\_brush\_state          | Verschleißstatus Seitenbürste in % | 0–100                              |
| roll\_brush\_state          | Verschleißstatus Hauptbürste in %  | 0–100                              |
| filter\_state               | Filterzustand in %                 | 0–100                              |
| suction\_state              | Saugstärke                         | 'strong', 'normal', 'gentle'       |
| suction\_command            | Setzt Saugstärke                   | 'strong', 'normal', 'gentle'       |
| clean\_area\_state          | Gereinigte Fläche in m²            | 0–9999                             |
| clean\_time\_state          | Reinigungsdauer in Minuten         | 0–9999                             |
| volume\_set\_state          | Lautstärke in %                    | 0–100                              |
| volume\_set\_command        | Setzt Lautstärke                   | 0–100                              |
| language\_state             | Aktuelle Spracheinstellung         | 'english', 'german', 'french', 'russian', 'spanish', 'italian' |
| language\_command           | Setzt Sprache                      | 'english', 'german', 'french', 'russian', 'spanish', 'italian' |
| clean\_speed\_state         | Reinigungsgeschwindigkeit          | 'careful_clean', 'speed_clean'     |
| clean\_speed\_command       | Setzt Reinigungsgeschwindigkeit    | 'careful_clean', 'speed_clean'     |

**Manuelle Konfigurationsoptionen:**

| Option       | Beschreibung                                  | Standard (automatische Erkennung) |
| ------------ | --------------------------------------------- | --------------------------------- |
| dpsPower     | DPS für Schaltzustand                         | 2                                 |
| dpsMode      | DPS für Reinigungsmodus                       | 3                                 |
| dpsDirection | DPS für Richtungssteuerung                    | 4                                 |
| dpsStatus    | DPS für Gerätestatus (nur lesend)             | 5                                 |
| dpsBattery   | DPS für Akkustand (nur lesend)                | 6                                 |
| dpsEdge      | DPS für Zustand der Seitenbürste (nur lesend) | 7                                 |
| dpsRoll      | DPS für Zustand der Hauptbürste (nur lesend)  | 8                                 |
| dpsFilter    | DPS für Filterzustand (nur lesend)            | 9                                 |
| dpsSuction   | DPS für Saugstärke                            | 14                                |
| dpsArea      | DPS für gereinigte Fläche (nur lesend)        | 16                                |
| dpsTime      | DPS für Reinigungszeit (nur lesend)           | 17                                |
| dpsVolumn    | DPS für Lautstärkeeinstellung                 | 28                                |
| dpsLang      | DPS für Spracheinstellung                     | 29                                |
| dpsSpeed     | DPS für Reinigungsgeschwindigkeit             | 101                               |

### GenericDevice (Generische Gerätetemplates)

Falls für dein Gerät kein vordefiniertes Template existiert oder dieses nicht alle Funktionen des Geräts abdeckt, gibt es dennoch mehrere Möglichkeiten, das Gerät zu steuern:

1. Direkte Verwendung der DPS-Topics:  
Du kannst die Steuerung über die DPS-Topics direkt vornehmen – entweder mit nativen Tuya-JSON-Befehlen oder durch gezielte Nutzung der DPS-Schlüsselwerte.

2. Erstellen eines eigenen Templates:  
Alternativ kannst du ein eigenes Template für dein Gerät erstellen, in dem du DPS-Schlüssel zu benutzerfreundlichen MQTT-Topics zuordnest. Der Gerätetyp GenericDevice erlaubt es, solche Templates manuell zu definieren – unter Verwendung derselben Template-Engine wie die vordefinierten Gerätetemplates.

Sobald du ein eigenes Template erstellt hast, kannst du es auch für andere, ähnliche Geräte wiederverwenden.

**Wie erstellt man ein Gerätetemplate?**

Das Erstellen eines Templates ist relativ einfach. Zunächst musst du jedoch wissen, welche DPS-Schlüssel dein Gerät verwendet.

Der Typ GenericDevice versucht beim Start, alle verfügbaren DPS-Zustände vom Gerät abzufragen. Manche Geräte antworten jedoch nicht auf diese Anfrage. Dennoch werden alle empfangenen DPS-Topics immer automatisch gemeldet, sobald das Gerät Daten sendet.

Die einfachste Methode zur Ermittlung der verwendeten DPS-Schlüssel besteht darin, dich mit einem Tool wie MQTT Explorer oder mosquitto_sub mit dem MQTT-Broker zu verbinden. Beobachte die Topics, während du dein Gerät mit der Tuya- oder SmartLife-App bedienst.

Sobald du ein gutes Verständnis davon hast, welche DPS-Werte für welche Funktionen zuständig sind, kannst du ein passendes Template erstellen.

Ein einfaches Beispiel-Template für einen Dimmer sieht so aus:

```json
[
  {
    "name": "Tuya Device 1",
    "id": "1234567890",
    "key": "abcdefghij",
    "template": {
      "state": {
        "key": 1,
        "type": "bool"
      },
      "brightness_state": {
        "key": 2,
        "type": "int",
        "topicMin": 1,
        "topicMax": 100,
        "stateMath": "/2.55",
        "commandMath": "*2.55"
      }
    }
  }
]
```
Das oben gezeigte Template definiert zwei Topics: `state` und `brightness_state`. Die Template-Engine erstellt automatisch die entsprechenden Befehls-Topics, in diesem Fall also `command` und `brightness_command`.

Das Topic `state` ist mit dem DPS-Schlüssel 1 verknüpft und verwendet einen booleschen Wert (true/false).
Damit kannst du nun den Ein-/Aus-Zustand im Topic `state` erkennen, anstatt den Rohwert true oder false direkt vom Topic DPS/1 interpretieren zu müssen.

Das Topic `brightness_state` ist mit dem DPS-Schlüssel 2 verknüpft. Dieser Wert definiert die Helligkeit als Ganzzahl im Bereich 1–255. Wir definieren diesen Wert als Ganzzahl (type: 'int'). Mithilfe von `stateMath` und `commandMath` lässt sich der Rohwert so umrechnen, dass er in einer benutzerfreundlicheren Skala (1–100 %) im MQTT-Topic erscheint.
In diesem Fall wird der DPS-Wert durch 2,55 geteilt, bevor er im State-Topic veröffentlicht wird. Umgekehrt werden eingehende Befehle mit 2,55 multipliziert, um den MQTT-Wert zurück ins Tuya-Format zu übersetzen. Dadurch entsteht eine intuitive 0–100 %-Skala für die Benutzeroberfläche, obwohl intern 1–255 verwendet wird.

Beachte: Die Werte `topicMin` und `topicMax` legen den minimalen und maximalen Wert für das State- bzw. Command-Topic fest.

Diese Werte gelten nach der Rechenoperation `post-math` für State-Topics und vor der Rechenoperation `pre-math` für Command-Topics.

**Verfügbare Wertetypen:**

- Boolesche Werte (Boolean values)

| Option | Bedeutung                                                          |
| ------ | ------------------------------------------------------------------ |
| `type` | `'bool'` – Gibt an, dass es sich um einen Wahr/Falsch-Wert handelt |
| `key`  | DPS-Schlüssel des Werts                                            |

- Ganzzahlige Werte (Integer values)

| Option        | Bedeutung                                                                                                  |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `type`        | `'int'` – Gibt an, dass es sich um einen Ganzzahlwert handelt                                              |
| `key`         | DPS-Schlüssel des Werts                                                                                    |
| `topicMin`    | Minimaler Wert, der im **Command-Topic** erlaubt ist                                                       |
| `topicMax`    | Maximaler Wert, der im **Command-Topic** erlaubt ist                                                       |
| `stateMath`   | Mathematische Umrechnung, die auf den DPS-Wert **vor der Veröffentlichung** im State-Topic angewendet wird |
| `commandMath` | Mathematische Umrechnung, die auf den eingehenden Befehl **vor dem Setzen** des DPS-Werts angewendet wird  |

- Gleitkommawerte (Float values)

| Option        | Beschreibung                                                                                               |
| ------------- | -----------------------------------------------------------------------------------------------------------|
| `type`        | `'float'` – Gibt an, dass es sich um einen Gleitkommazahl handelt                                          |
| `key`         | DPS-Schlüssel des Wertes                                                                                   |
| `topicMin`    | Minimaler Wert, der im **Command-Topic** erlaubt ist                                                       |
| `topicMax`    | Maximaler Wert, der im **Command-Topic** erlaubt ist                                                       |
| `stateMath`   | Mathematische Umrechnung, die auf den DPS-Wert **vor der Veröffentlichung** im State-Topic angewendet wird |
| `commandMath` | Mathematische Umrechnung, die auf den eingehenden Befehl **vor dem Setzen** des DPS-Werts angewendet wird  |

- Zeichenkette (String values)

| Option        | Beschreibung                                                                                               |
| ------------- | -----------------------------------------------------------------------------------------------------------|
| `type`        | `'str'` – Gibt an, dass es sich um eine Zeichenkette handelt                                               |
| `key`         | DPS-Schlüssel des Wertes                                                                                   |

- Tuya-spezifische HSB Farbwerte (newer style Tuya, 12 character color value)

| Option        | Beschreibung                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `type`        | `'hsb'` – Gibt an, dass es sich um ein HSB Datentyp handelt                                                |
| `key`         | DPS-Schlüssel des Wertes                                                                                   |
| `components'  | Kommagetrennte Liste von HSB-Komponenten, die in diesem Topic enthalten sein sollen                        |

- Tuya-spezifische HSBHEX Farbwerte (older style Tuya 14 character color value)

| Option        | Beschreibung                                                                                               |
| ------------- | ---------------------------------------------------------------------------------------------------------- |
| `type`        | `'hsbhex'` – Gibt an, dass es sich um ein HSB Datentyp handelt                                             |
| `key`         | DPS-Schlüssel des Wertes                                                                                   |
| `components'  | Kommagetrennte Liste von HSB-Komponenten, die in diesem Topic enthalten sein sollen                        |

Mit diesen Wertetypen kannst du Vorlagen für eine Vielzahl von Geräten definieren. Weitere Typen und Optionen werden wahrscheinlich in zukünftigen Versionen von tuya2mqtt hinzugefügt.
