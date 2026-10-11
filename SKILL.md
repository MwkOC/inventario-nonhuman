---
name: maintain-nonhuman-lab
description: Mantener y verificar el ERP NonHuman Lab de este repositorio, con Next.js y API Node.js para inventario, prestamos, asistencia y roles. Usar para cambios o revisiones de esta aplicacion y su entrega en Vercel.
---

# Mantenimiento de NonHuman Lab

Guia versionada del proyecto, enlazada desde AGENTS.md; no implica instalacion global.

Leer [memory.md](memory.md) para decisiones y estado, y
[REQUISITOS_LABORATORIO.md](REQUISITOS_LABORATORIO.md) para permisos.
Los comandos estan en [GUIA_DESARROLLO.md](GUIA_DESARROLLO.md) y la operacion en
[DESPLIEGUE_LEO.md](DESPLIEGUE_LEO.md).

## Cambios

Entradas Next.js en app/, interfaz en src/main.jsx, API en lib/api.mjs, reglas de
inventario en lib/lab.mjs, autenticacion en lib/auth.mjs y esquema en lib/schema.mjs.
Seguir los flujos existentes sin recrear un servidor separado.

Al tocar retiros/devoluciones conservar atomicidad, idempotencia, stock y propiedad
del prestamo. Al tocar personas distinguir externo con cuenta de visita sin cuenta.
Validar permisos en backend, no solo ocultar botones.

Para evolucionar el esquema agregar una migracion versionada explicita; CREATE TABLE
IF NOT EXISTS no modifica tablas existentes. No ejecutar migraciones durante build
o peticiones. No reutilizar bases reales en tests.

## Verificacion

npm test cubre API y reglas con SQLite temporal; TEST_DATABASE_URL permite repetir
contra PostgreSQL descartable con nombre terminado en _test. npm run test:e2e
compila y prueba Next.js en una base de demo separada. Revisar movil y ambos temas
si cambia presentacion. Mantener fixtures ficticios.

La migracion legacy lee SQLite en modo solo lectura y exige destino vacio. Conservar
la base original; no copiar datos privados, hashes ni enlaces a commits o capturas.
Documentar decisiones confirmadas y distinguir build/CI de deployment real probado.
