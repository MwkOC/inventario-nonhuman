# Memoria de NonHuman Lab

Actualizado: 2026-10-11. Guardar decisiones y estado, nunca datos personales o secretos.

## Producto

ERP de laboratorio: inventario, prestamos, consumibles, asistencia y visitas.
PWA con conexion, Android/iOS y temas claro/oscuro. Roles admin, miembro y externo;
externos solo asistencia e historial propio, visitas sin cuenta.
DNI como usuario, correo personal, contrasena propia y sesion persistente.
Retiros sin aprobacion, notificaciones en panel para todos los admins.
Miembros y administradores devuelven sus propios prestamos; no los ajenos.
Lista real inicial: 17 cuentas, 3 administradores y 14 miembros. Inventario pendiente.
Detalles en [REQUISITOS_LABORATORIO.md](REQUISITOS_LABORATORIO.md).

## Arquitectura acordada

El usuario solicito migracion completa a Next.js, no solo la interfaz.
Next.js 16 App Router y API Node.js 24 en un unico proceso. Django/Python retirados.
PostgreSQL en Vercel; SQLite de Node solo para desarrollo/pruebas.
SQL parametrizado, transacciones y bloqueo compartido para movimientos.
Sesiones opacas en base, cookies HttpOnly, CSRF firmado, scrypt para nuevas contrasenas.
Se conservan y actualizan hashes Django PBKDF2-SHA256 al iniciar sesion.
Repo publico: https://github.com/MwkOC/inventario-nonhuman.

## Datos y entrega

- db.members.sqlite3 es el origen Django privado y no se modifica.
- db.next.members.sqlite3 es una copia local migrada con las 17 cuentas y mismos roles.
  .env.local la selecciona para Next.js. No se generaron contrasenas comunes.
- Sesiones y enlaces anteriores quedan invalidados. Generar nuevos enlaces para
  cuentas sin contrasena con queue-access y mail:send.
- local-emails/ contiene enlaces sensibles locales, no correos externos enviados.
- Se generaron nuevos enlaces locales para las 16 cuentas sin contrasena; vencen en
  una hora. La cuenta que ya tenia contrasena conserva su hash original.
- Pruebas usan datos ficticios y bases separadas; Playwright usa db.next.e2e.sqlite3.
- Interfaz y API local en http://localhost:5174. Ya no hay servidor Django en 8000.
- CI ejecuta pruebas SQLite/PostgreSQL y navegador en cada push. Consultar el
  resultado del commit publicado en GitHub Actions; no confundirlo con deployment.
- Verificacion local: 33 pruebas de backend aprobadas en SQLite y PostgreSQL 18,
  cinco pruebas de navegador aprobadas (incluye activacion por correo local),
  build Next.js correcto y npm audit sin vulnerabilidades reportadas.
- Revision adicional: contrasenas conservan espacios elegidos; un correo fallido
  no invalida un enlace anterior; envios de la misma cuenta no se adelantan entre si.
- No hay deployment Vercel publico verificado. Faltan cuenta/proyecto, PostgreSQL
  destino, remitente real, prueba de backup y aprobacion de Leo antes de cambiar DNS.
- Costo mensual minimo: confirmar condiciones del plan y cuotas antes de contratar.

Comandos: [GUIA_DESARROLLO.md](GUIA_DESARROLLO.md).
Migracion, despliegue y operacion: [DESPLIEGUE_LEO.md](DESPLIEGUE_LEO.md).
No guardar DNI, correos personales, tokens, claves, bases ni Excel en el repo.
