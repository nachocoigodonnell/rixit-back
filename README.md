# Rixit Backend

Este proyecto es el backend de Rixit, construido con NestJS, PostgreSQL y WebSockets.

## Desarrollo

```bash
npm install
npm run start:dev
```

## Docker

```bash
docker-compose -f docker/docker-compose.yml up --build
```

## Migraciones

```bash
npm run migration:generate -- -p Initial
npm run migration:run
``` 