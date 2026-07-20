# Node.js Basis-Image
FROM node:22-alpine

# Arbeitsverzeichnis im Container
WORKDIR /app

# Package-Dateien kopieren
COPY package*.json ./

# Abhängigkeiten installieren
# RUN npm install
RUN npm ci --omit=dev

# Restliche Dateien kopieren
COPY . .

# Port freigeben
EXPOSE 3000

# Anwendung starten
CMD ["npm", "start"]
