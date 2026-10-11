# NonHuman Lab

Aplicacion de inventario, prestamos, asistencia y visitas.
React + Vite, Django 5.2 y PostgreSQL en produccion; SQLite en desarrollo.

- [Despliegue y operacion](DESPLIEGUE_LEO.md)
- [Requisitos funcionales](REQUISITOS_LABORATORIO.md)

## Desarrollo local

Requisitos: Python 3.12 y Node 24. Comandos para Linux/macOS:

```sh
python3 -m venv .venv
.venv/bin/python -m pip install -r requirements.txt
npm ci
.venv/bin/python manage.py migrate
.venv/bin/python manage.py seed_demo
```

En dos terminales:

```sh
.venv/bin/python manage.py runserver 127.0.0.1:8000
```

```sh
npm run dev
```

Abrir http://localhost:5173. No exponer estos servidores a internet.

La demo contiene datos ficticios. DNI: admin `10000001`, miembro `10000006`,
externo `10000016`. Contrasena de demo: `NonHuman2026!`.
`seed_demo` no sobreescribe cuentas y esta bloqueado en produccion.

## Base local de miembros

La base privada existente se conserva en `db.members.sqlite3`; no forma parte del repo.
Para usarla desde la raiz del proyecto:

```sh
DATABASE_URL="sqlite:///$(pwd)/db.members.sqlite3" DEMO_MODE=0 .venv/bin/python manage.py runserver 127.0.0.1:8000
```

Cada persona usa su DNI y crea su propia contrasena. En desarrollo, los enlaces de
activacion y recuperacion se guardan en `local-emails/`; no se envian correos reales.

## Pruebas

```sh
.venv/bin/python manage.py test
.venv/bin/python manage.py makemigrations --check --dry-run
npx playwright install chromium
npm run test:e2e
```

Playwright compila la interfaz e inicia un servidor aislado en el puerto 8765 con
`db.e2e.sqlite3` y usuarios ficticios. No usa la base de miembros ni los servidores
locales en 8000/5173. Las capturas quedan en `test-results/`.

## Build

```sh
npm run build
```

El resultado esta en `dist/`. Reiniciar Django para revisar el build en
http://localhost:8000. La PWA necesita conexion y HTTPS fuera de localhost.

## Estructura

- `src/`: interfaz y estilos.
- `lab/`: modelos, API, migraciones, importacion y pruebas.
- `server/`: configuracion y rutas.
- `public/`: recursos estaticos y PWA.
- `Dockerfile`, `render.yaml`: despliegue.
- `.github/workflows/check.yml`: pruebas y construccion automatizadas.

No versionar Excel de miembros, bases, correos, claves ni backups.
