# SPEC 01 — Gestión de envíos en shipments-ms (microservicio NATS)

> **Estado:** Implementado
> **Depends on:** Ninguno (convive con auth-ms a través del mismo broker NATS)
> **Fecha:** 2026-10-19
> **Objetivo:** Convertir el starter shipments-ms en un microservicio NATS con Postgres/Prisma que gestiona el ciclo de vida de envíos (crear, consultar, listar, cancelar y transicionar estado) listo para que client-gateway lo consuma.

## Scope

**In:**

- Instalar `@nestjs/microservices`, `nats`, `prisma`, `@prisma/client`, `joi`, `class-validator`, `class-transformer`
- `docker-compose.yml` con solo Postgres (`shipments-ms-postgres`, :5434, db `shipments_db`) — NATS es el ya existente en :4222
- `src/config/envs.ts` con validación Joi: `NATS_URL`, `DATABASE_URL`
- `src/main.ts` → `NestFactory.createMicroservice()` + `ValidationPipe` global + `AllExceptionsFilter`
- Schema Prisma: `Shipment`, `ShipmentStatusLog`, enum `ShipmentStatus` + migración inicial
- `src/common/filters/all-exceptions.filter.ts` (patrón auth-ms)
- `src/shipments/` con `@MessagePattern`: `shipments.create`, `shipments.findOne`, `shipments.findByTrackingCode`, `shipments.findAll`, `shipments.cancel`, `shipments.updateStatus`
- DTOs con `class-validator` (whitelist, forbidNonWhitelisted, transform)
- Máquina de estados como función pura `canTransition()` con test unitario
- `trackingCode` autogenerado formato `SHP-XXXXXXXX`

**Out of scope (para futuros specs):**

- Módulo `shipments/` en client-gateway (spec 02 — este spec solo define el contrato de patrones)
- Eventos NATS publicados (`shipment.created`, `shipment.status.changed`) — solo request/response
- Validar JWT dentro de shipments-ms
- Edición de datos del envío (solo estado y cancelación cambian el registro)
- Tests E2E automatizados con cliente NATS

---

## Data model

```prisma
enum ShipmentStatus {
  CREATED
  DISPATCHED
  IN_TRANSIT
  DELIVERED
  CANCELLED
}

model Shipment {
  id            String              @id @default(uuid())
  trackingCode  String              @unique // SHP-XXXXXXXX
  senderId      String              // UUID del usuario en auth-ms (confía en el payload)
  receiverName  String
  receiverEmail String
  origin        String
  destination   String
  notes         String?
  status        ShipmentStatus      @default(CREATED)
  createdAt     DateTime            @default(now())
  updatedAt     DateTime            @updatedAt
  statusLogs    ShipmentStatusLog[]
}

model ShipmentStatusLog {
  id         String          @id @default(uuid())
  shipmentId String
  shipment   Shipment        @relation(fields: [shipmentId], references: [id])
  fromStatus ShipmentStatus?
  toStatus   ShipmentStatus
  note       String?
  createdAt  DateTime        @default(now())
}
```

**Máquina de estados** (función pura en `src/shipments/domain/`):

```ts
const VALID_TRANSITIONS: Record<ShipmentStatus, ShipmentStatus[]> = {
  CREATED:    [ShipmentStatus.DISPATCHED, ShipmentStatus.CANCELLED],
  DISPATCHED: [ShipmentStatus.IN_TRANSIT, ShipmentStatus.CANCELLED],
  IN_TRANSIT: [ShipmentStatus.DELIVERED],
  DELIVERED:  [], // terminal
  CANCELLED:  [], // terminal
};
```

**Contrato de mensajes** (mismo estilo que `auth.*`):

| Patrón | Payload | Respuesta / Error |
|---|---|---|
| `shipments.create` | `CreateShipmentDto` | Shipment creado (`201`) / `400` |
| `shipments.findOne` | `{ id }` | Shipment / `404` |
| `shipments.findByTrackingCode` | `{ trackingCode }` | Shipment / `404` |
| `shipments.findAll` | `{ page?, limit?, status? }` (defaults 1/10, máx 50) | `{ items, total, page, limit }` |
| `shipments.cancel` | `{ id, note? }` | Shipment con status `CANCELLED` / `404` / `409` si no cancelable |
| `shipments.updateStatus` | `{ id, status, note? }` | Shipment actualizado / `404` / `400` transición inválida |

---

## Implementation plan

1. **Instalar dependencias** → `npm.cmd install @nestjs/microservices nats @prisma/client joi class-validator class-transformer` + `npm.cmd install -D prisma`. Verificación: `npm.cmd run build`.
2. **`docker-compose.yml`** → solo Postgres en :5434 (`shipments_db`), sin NATS (reutiliza el de auth-ms en :4222). Levantar con `docker compose up -d`.
3. **`src/config/envs.ts`** → Joi con `NATS_URL` y `DATABASE_URL`; actualizar `.env` / `.env.example` (`NATS_URL=nats://localhost:4222`, `DATABASE_URL=postgresql://postgres:postgres@localhost:5434/shipments_db`).
4. **Prisma** → `prisma/schema.prisma` con el modelo de arriba, `npx prisma migrate dev --name init`. Verificación: `npx prisma studio` muestra las tablas.
5. **`src/main.ts`** → `NestFactory.createMicroservice(AppModule, { transport: Transport.NATS, ... })`, `ValidationPipe` global, `AllExceptionsFilter` (copiado de auth-ms). Eliminar `app.listen(PORT)`. Verificación: arranca y se suscribe a NATS.
6. **`src/prisma/`** → `PrismaModule` (global) + `PrismaService` (patrón auth-ms, `onModuleInit` con `$connect`).
7. **Dominio de estados** → `src/shipments/domain/shipment-status.helper.ts` con `canTransition()` y test `shipment-status.helper.spec.ts`. Verificación: `npm.cmd run test` pasa (primer test del repo).
8. **DTOs** → `CreateShipmentDto`, `FindAllShipmentsDto` (page/limit/status opcionales), `UpdateShipmentStatusDto`, `CancelShipmentDto`.
9. **`ShipmentService`** → los 6 casos de uso; `updateStatus` y `cancel` escriben el log dentro de `prisma.$transaction`; `create` genera `trackingCode` con reintento por colisión (índice unique); errores como `NotFoundException`/`ConflictException`/`BadRequestException` (el filtro los convierte a `RpcException`).
10. **`ShipmentController`** → los 6 `@MessagePattern` con `@Payload()`.
11. **Verificación manual** → con NATS y Postgres corriendo: `nats req shipments.create '{...}'`, consultar por id y tracking, listar con `{"page":1,"limit":5,"status":"CREATED"}`, cancelar un `IN_TRANSIT` (esperar 409), transicionar `DISPATCHED → IN_TRANSIT → DELIVERED` y comprobar el log. `npm.cmd run build` y `npm.cmd run lint` limpios.

---

## Acceptance criteria

- [x] `@nestjs/microservices`, `nats`, `prisma`, `@prisma/client`, `joi`, `class-validator`, `class-transformer` están en `package.json`
- [x] `envs.ts` valida `NATS_URL` y `DATABASE_URL` con Joi
- [x] `main.ts` usa `NestFactory.createMicroservice()` con `Transport.NATS` (sin servidor HTTP)
- [x] `docker-compose.yml` expone solo Postgres en :5434 y no declara NATS
- [x] El schema Prisma define `Shipment`, `ShipmentStatusLog` y enum `ShipmentStatus`, con `trackingCode` unique
- [x] `shipments.create` crea un envío con `trackingCode` `SHP-XXXXXXXX` y status `CREATED`
- [x] `shipments.findOne` con id inexistente retorna error `404`
- [x] `shipments.findByTrackingCode` retorna el envío correcto
- [x] `shipments.findAll` pagina (page/limit) y filtra por `status`
- [x] `shipments.cancel` permite cancelar en `CREATED` y `DISPATCHED`
- [x] `shipments.cancel` sobre `IN_TRANSIT`/`DELIVERED`/`CANCELLED` retorna error `409`
- [x] `shipments.updateStatus` acepta solo transiciones del mapa (p. ej. `CREATED → DELIVERED` retorna `400`)
- [x] Cada cambio de estado inserta una fila en `ShipmentStatusLog` en la misma transacción
- [x] El test unitario de `canTransition()` pasa (`npm.cmd run test`)
- [x] `npm.cmd run build` y `npm.cmd run lint` compilan sin errores
- [x] El microservicio se conecta a NATS y expone los 6 patrones

---

## Decisions

- **Sí:** NATS puro sin HTTP — réplica exacta del patrón de auth-ms.
- **Sí:** compartir el broker NATS de auth-ms (:4222) en vez de levantar otro — client-gateway solo alcanza servicios conectados al mismo broker.
- **Sí:** máquina de estados como función pura testeada — la regla de negocio crítica aísla el dominio del transporte.
- **Sí:** cancelar = transición a `CANCELLED`, nunca borrado físico.
- **Sí:** tabla de log escrita en la misma transacción Prisma que el cambio de estado.
- **Sí:** confiar en `senderId` del payload; el JWT se valida en el gateway (patrón `auth.profile`).
- **No:** validar JWT en shipments-ms — duplicaría lógica y acoplaría los servicios.
- **No:** módulo de client-gateway en este spec — va en el spec 02 con el contrato ya definido.
- **No:** eventos pub/sub NATS — primero el request/response; los eventos son extensión natural.

## Risks

| Riesgo | Mitigación |
|---|---|
| NATS de auth-ms no está corriendo → shipments-ms no arranca | Documentar prerrequisito; `docker compose up -d` del compose de auth-ms |
| Colisión de `trackingCode` | Índice unique + reintento de generación |
| Duplicado de migraciones (lección del spec checker de auth-ms: `0_init` vs `..._init`) | Una sola migración inicial, sin carpetas de migración manuales |
| Conflicto de puertos 5433/5434 con auth-ms corriendo | Postgres de shipments-ms en :5434, contenedor con nombre propio |

## What is **not** in this spec

- Módulo `shipments/` en client-gateway (spec 02 si aterriza).
- Eventos NATS pub/sub y notificaciones.
- Validación de JWT dentro del microservicio.
- Edición de datos del envío y borrado físico.

Cada uno de esos, si se necesita, va en su propio spec.
