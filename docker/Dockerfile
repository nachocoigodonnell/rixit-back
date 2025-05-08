# Etapa de build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package.json package-lock*.json* ./
RUN npm install --production=false --ignore-scripts && npm cache clean --force
COPY . .
RUN npm run build

# Etapa de producción
FROM node:20-alpine
WORKDIR /app
COPY --from=builder /app/package*.json ./
RUN npm install --production --ignore-scripts && npm cache clean --force
COPY --from=builder /app/dist ./dist
ENV NODE_ENV=production
CMD ["node", "dist/main.js"] 