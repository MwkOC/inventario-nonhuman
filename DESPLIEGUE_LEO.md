# Despliegue de NonHuman Lab

Next.js sirve la interfaz y la API Node.js en el mismo proyecto Vercel.
PostgreSQL externo conserva los datos y Resend envia activaciones y recuperaciones.
No se necesita Django, Python, Docker ni otro servidor de API.

## Configuracion

Importar el repositorio en Vercel: directorio raiz, framework Next.js, Node 24,
build npm run build y directorio de salida predeterminado. No usar export estatico.
Confirmar condiciones y elegibilidad del [plan Hobby](https://vercel.com/docs/plans/hobby);
PostgreSQL y correo tienen cuotas propias. No prometer costo cero sin revisarlas.

Variables privadas del proyecto (ninguna debe tener prefijo NEXT_PUBLIC_):

| Variable | Valor |
| --- | --- |
| APP_ENV | production |
| DEMO_MODE | 0 |
| DATABASE_URL | PostgreSQL externo; preferir URL agrupada apta para serverless |
| PUBLIC_URL | URL estable HTTPS de la app, sin barra final ni ruta |
| SECRET_KEY | Secreto aleatorio de al menos 50 caracteres |
| RESEND_API_KEY | Clave privada de Resend |
| DEFAULT_FROM_EMAIL | Remitente verificado |
| BOOTSTRAP_ADMIN_DNI | Solo para crear la primera cuenta en una base nueva |
| BOOTSTRAP_ADMIN_EMAIL | Correo personal del primer administrador |
| BOOTSTRAP_ADMIN_NAME | Nombre del primer administrador |

En Vercel se fuerzan los controles de produccion aunque APP_ENV este mal configurado.
SQLite y correo en disco estan prohibidos en produccion. La conexion PostgreSQL
exige TLS con certificado valido; no desactivar su verificacion. El pool tiene
un maximo de tres conexiones por instancia.

Generar SECRET_KEY:

```sh
node -e "console.log(require('node:crypto').randomBytes(48).toString('base64url'))"
```

PUBLIC_URL debe ser la URL estable, por ejemplo https://inventario-nonhuman.vercel.app.
Las previews necesitan base, secretos y PUBLIC_URL propios; nunca reutilizar la base
de produccion. Los POST solo aceptan ese origen, cookie CSRF firmada y su encabezado.
Las sesiones usan cookies HttpOnly, Secure y SameSite=Lax, con 30 dias renovables.

## Base y primera publicacion

1. Configurar las variables en Vercel y en un entorno privado autorizado para gestionar
   la base. Los comandos npm de gestion leen .env.local, excluido de Git.
2. Ejecutar npm ci y npm run db:migrate contra la base destino.
3. Elegir una sola opcion: migrar datos existentes (seccion siguiente), o crear una
   instalacion vacia con npm run db:bootstrap. No ejecutar bootstrap antes de importar
   una base completa, porque la importacion exige un destino vacio.
4. Para cuentas sin contrasena, ejecutar queue-access y npm run mail:send.
5. Desplegar y comprobar /healthz: 200 y {"status":"ok"}. Verificar que /api/session
   devuelva JSON, cookie CSRF y Cache-Control no-store.
6. Probar activacion, login, recarga, cierre, recuperacion, permisos de los tres roles,
   retiro y devolucion propia tanto de miembro como de administrador.
7. Probar Android/iOS, ambos temas y restaurar un backup en una base separada.
8. Coordinar con Leo antes de modificar DNS de lab.nonhuman.lat. Cambiar PUBLIC_URL
   al dominio definitivo y volver a desplegar.

Las migraciones y bootstrap son pasos operativos explicitos. No se ejecutan al
compilar, al arrancar una funcion ni en una peticion de usuario.
Retirar las variables BOOTSTRAP_ADMIN una vez creada la cuenta inicial.

## Migrar desde Django

Respaldar la base original y detener escrituras antes de obtener la copia de migracion.
El importador lee una base SQLite Django en modo solo lectura; no requiere Python.

```sh
npm run db:import-legacy -- /ruta/privada/db.members.sqlite3
npm run db:migrate
npm run db:import-legacy -- /ruta/privada/db.members.sqlite3 --apply
```

La primera orden valida y muestra conteos sin modificar el destino. La importacion
conserva IDs, cuentas, roles, hashes, articulos, asistencia, visitas, prestamos,
eventos, notificaciones y cola de correos. Es atomica y rechaza destinos con datos;
no mezclar ni sobrescribir bases. Verificar conteos antes de habilitar escrituras.

Las contrasenas Django PBKDF2-SHA256 siguen funcionando y se actualizan a scrypt
al iniciar sesion. Un algoritmo no soportado detiene la migracion. No se migran
sesiones ni tokens Django: las personas deben iniciar sesion otra vez y solicitar
nuevos enlaces. Para cuentas activas sin contrasena:

```sh
node --env-file-if-exists=.env.local scripts/manage.mjs queue-access --apply
npm run mail:send
```

En este equipo ya existe una copia local migrada db.next.members.sqlite3.
No subir ninguna de las dos bases a GitHub o Vercel. Para produccion, importar desde
la copia Django original antes de registrar nuevos movimientos en la copia Next.js.
Si ya se usaron ambas versiones, detenerse y reconciliar datos antes de importar.

## Importar miembros nuevos

Admite XLSX/CSV, hasta 2 MB y 500 filas, con Nombres, Apellidos, DNI, Correo.
Mantener DNI como texto si tiene ceros iniciales.

```sh
npm run db:import-members -- /ruta/privada/miembros.xlsx --admin-dni DNI_ADMIN_1 --admin-dni DNI_ADMIN_2 --admin-dni DNI_ADMIN_3 --skip-existing
```

Primero revisar el resumen; repetir con --apply. Los DNI declarados seran administradores;
los demas, miembros. --skip-existing solo conserva cuentas activas con nombre, correo
y rol exactamente iguales. No modifica cuentas existentes ni envia correos: luego
ejecutar npm run mail:send. El panel tambien ofrece importacion con previsualizacion.

## Operacion

- npm run mail:send: procesa hasta 100 correos pendientes; repetir si quedan mas.
  Las peticiones de alta/recuperacion envian hasta tres mediante after() de Next.js.
  Los restantes o fallidos quedan en cola; no hay worker periodico configurado.
- npm run db:cleanup: limpiar sesiones, tokens y limites expirados, diariamente desde
  un equipo o tarea autorizada. Las sesiones vencidas ya no conceden acceso.
- Respaldar PostgreSQL con pg_dump --format=custom y probar pg_restore en otra base.
- Antes de actualizar: backup, CI aprobado y migraciones revisadas. Revertir el
  deployment no revierte el esquema ni datos.
- Las operaciones usan transacciones y un bloqueo asesor PostgreSQL compartido para
  serializar movimientos del laboratorio pequeno. Revisar esta estrategia al crecer.
- /healthz valida la conexion y version de esquema; no demuestra entrega de correo,
  restauracion de backups ni funcionamiento visual.

El deployment publico, correo real, dominio y restauracion requieren validacion en
infraestructura destino. Las pruebas locales no los sustituyen.
La migracion paso 33 pruebas de backend con SQLite y PostgreSQL local, cinco de
navegador y build Next.js. No se ha realizado una auditoria de seguridad independiente.

Las nuevas contrasenas usan scrypt N=131072, r=8, p=1, segun la
[referencia de OWASP](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html).

Referencias: [Next.js en Vercel](https://vercel.com/docs/frameworks/full-stack/nextjs),
[after](https://nextjs.org/docs/app/api-reference/functions/after),
[PostgreSQL TLS](https://node-postgres.com/features/ssl).
