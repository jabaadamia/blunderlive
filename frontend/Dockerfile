FROM node:22-alpine

WORKDIR /app

# Install deps first for cache
COPY frontend/package*.json ./
RUN npm ci

# Copy source
COPY frontend/ ./

EXPOSE 3000

CMD ["npm", "run", "dev", "--", "-H", "0.0.0.0", "-p", "3000"]