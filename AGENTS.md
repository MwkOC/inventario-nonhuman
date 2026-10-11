# Instrucciones para agentes

## Contexto

Leer [memory.md](memory.md) y [REQUISITOS_LABORATORIO.md](REQUISITOS_LABORATORIO.md)
antes de cambiar comportamiento. La guia de trabajo especifica esta en [SKILL.md](SKILL.md).
Mantener estos documentos alineados con decisiones confirmadas, sin duplicar historiales.

## Limites del proyecto

- Mantener Next.js con API Node.js salvo solicitud de migracion. Una pregunta sobre un
  alojamiento no autoriza cambiar la arquitectura ni publicar un deployment.
- Resolver con el menor cambio completo, siguiendo los patrones existentes.
- Los permisos se verifican en servidor: externos solo asistencia e historial propio;
  administradores y miembros devuelven prestamos propios, no ajenos.
- Conservar transacciones, bloqueo de stock, idempotencia, sesiones y CSRF al modificar API.
- Mantener interfaz ERP utilitaria, responsive y temas coherentes; sin saludos ni texto de relleno.

## Datos privados

Este repositorio es publico. No agregar archivos de miembros, bases, correos locales,
tokens de activacion, claves ni backups, tampoco como ejemplos o fixtures.
No ejecutar db:seed ni pruebas contra bases de miembros o una base de produccion.
Usar datos ficticios y la base aislada de Playwright. No sobrescribir cuentas reales.

## Verificacion y entrega

Consultar comandos en [GUIA_DESARROLLO.md](GUIA_DESARROLLO.md). Segun el cambio:

- Backend/permisos: npm test; repetir con TEST_DATABASE_URL contra PostgreSQL descartable.
- Esquema: migraciones explicitas y versionadas en lib/schema.mjs; probar en base separada.
- Interfaz/flujos: npm run test:e2e; revisar claro/oscuro y movil/escritorio.
- Solo compilacion: npm run build
- Antes de entregar: git diff --check y revision de datos sensibles.

Para Vercel seguir [DESPLIEGUE_LEO.md](DESPLIEGUE_LEO.md): conservar el mismo origen
para cookies/CSRF y ejecutar migraciones fuera del build y de las peticiones. No cambiar DNS sin
coordinacion con Leo. Distinguir CI aprobado de despliegue real probado.
Comunicar en espanol lo cambiado, lo verificado y los pendientes, sin afirmar pruebas no ejecutadas.

<!-- BEGIN:nextjs-agent-rules -->

## This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->
