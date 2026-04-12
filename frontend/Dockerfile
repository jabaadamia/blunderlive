FROM node:22-alpine

WORKDIR /app

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./

EXPOSE 3000
# Use next start for production; override with dev in compose if needed
CMD ["node_modules/.bin/next", "start", "-H", "0.0.0.0", "-p", "3000"]