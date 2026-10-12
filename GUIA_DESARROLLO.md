# NonHuman Lab

Next.js 16 App Router: interfaz y API Node.js en un solo proceso. Node 24 requerido.
PostgreSQL en produccion; SQLite de Node para desarrollo y pruebas locales.

- [Requisitos](REQUISITOS_LABORATORIO.md)
- [Despliegue y operacion](DESPLIEGUE_LEO.md)

## Desarrollo

```sh
npm ci
npm run db:migrate
npm run dev
```

Abrir http://localhost:5174. No se necesita Python ni un servidor adicional.
Next.js y los comandos de gestion leen .env.local, que no se versiona.
Sin configuracion, la base local es db.next.sqlite3 y la demo esta desactivada.

En este equipo, .env.local selecciona db.next.members.sqlite3: copia migrada de las
17 cuentas. db.members.sqlite3 se conserva intacta como origen privado. No hay
contrasena comun; los hashes compatibles se conservan y actualizan al iniciar sesion.
Las sesiones y los enlaces Django anteriores ya no sirven.

### Acceso local sin correo

En este equipo se agregaron tres cuentas ficticias a la copia local: administrador,
miembro y externo. Las 17 cuentas reales y sus contrasenas se conservaron intactas.
Las credenciales de estas cuentas locales se entregaron por separado y no se versionan.
Se verificaron el inicio y cierre de sesion de los tres roles.

Estas cuentas no se crean al clonar el repositorio ni al desplegar. Para probar en
otro equipo sin correo, usar la demo separada descrita abajo; no cargar cuentas de
prueba en produccion. Los movimientos locales de prueba persisten en la base local.

### Activacion de cuentas reales

Para generar nuevos enlaces locales para cuentas sin contrasena:

```sh
node --env-file-if-exists=.env.local scripts/manage.mjs queue-access --apply
npm run mail:send
```

Los enlaces quedan en local-emails/. No se envian correos externos en desarrollo.
Cada enlace vence en una hora; un reenvio exitoso invalida el anterior.
Si el envio falla, el enlace anterior sigue siendo valido hasta su vencimiento.

## Demo separada

Linux/macOS, en una base distinta a la de miembros:

```sh
DATABASE_URL=sqlite:./db.next.demo.sqlite3 npm run db:migrate
DATABASE_URL=sqlite:./db.next.demo.sqlite3 DEMO_MODE=1 npm run db:seed
DATABASE_URL=sqlite:./db.next.demo.sqlite3 DEMO_MODE=1 npm run dev
```

Cuentas ficticias: admin 10000001, miembro 10000006, externo 10000016.
Contrasena de demo: NonHuman2026!. El sembrado no sobreescribe datos existentes
y esta prohibido en produccion y bases de miembros.

## Pruebas y build

```sh
npm test
npx playwright install chromium
npm run test:e2e
npm run build
npm start
```

Las pruebas de backend usan una base temporal y fixtures ficticios. Para PostgreSQL,
definir TEST_DATABASE_URL apuntando a una base descartable cuyo nombre termine en
_test. La suite borra sus tablas de prueba; nunca usar una base con datos reales.

Playwright usa db.next.e2e.sqlite3 y Next.js en 8766. No toca la base de miembros.
Las capturas quedan en test-results/. npm start sirve el build en 5174.
No ejecutar npm start y npm run dev en el mismo puerto.

## Estructura

- app/: paginas, metadatos, API y health check.
- src/: interfaz y estilos.
- lib/: autenticacion, SQL, reglas del laboratorio, correo, importacion y migracion.
- scripts/manage.mjs: comandos operativos; migrations explicitas con db:migrate.
- tests/: pruebas de backend y navegador.
- public/: recursos y PWA con conexion requerida.
- vercel.json: despliegue Next.js; sin funciones Python.
- .github/workflows/check.yml: SQLite, PostgreSQL y navegador.

No versionar Excel, bases, correos locales, archivos .env, tokens, claves ni backups.
