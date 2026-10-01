# Node.js Basis-Image
FROM node:22-alpine

ENV NODE_ENV=production
# Info- und Fehlermeldungen standardmäßig ausgeben (überschreibbar mit -e DEBUG=...)
ENV DEBUG=tuya2mqtt:info,tuya2mqtt:error

# Arbeitsverzeichnis im Container
WORKDIR /app

# Package-Dateien kopieren
COPY package*.json ./

# Abhängigkeiten installieren
RUN npm ci --omit=dev && npm cache clean --force

# Restliche Dateien kopieren
COPY . .

# Nicht als root laufen
USER node

# Anwendung direkt starten, damit SIGTERM beim Node-Prozess ankommt
CMD ["node", "tuya2mqtt.js"]
