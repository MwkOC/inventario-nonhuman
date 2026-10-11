# Despliegue de NonHuman Lab

Un contenedor sirve React compilado y Django mediante Gunicorn. PostgreSQL conserva
los datos; Resend envia activaciones y recuperaciones por HTTPS.

## Requisitos

- Repositorio privado y alojamiento con Docker, HTTPS y acceso a PostgreSQL.
- PostgreSQL accesible desde el alojamiento, con SSL. No usar SQLite en produccion.
- Cuenta Resend con remitente verificado.
- Lista de miembros entregada por canal privado, no mediante GitHub.
- Responsable de backups y del dominio. Confirmar el uso actual de `lab.nonhuman.lat`
  antes de cambiar DNS.

Render puede configurarse con `render.yaml`. Revisar cuotas y condiciones del
[plan gratuito](https://render.com/docs/free) antes de contratar. No depender del
disco efimero del contenedor para conservar datos.

## Variables

Configurar en el alojamiento usando `.env.example` como referencia:

| Variable | Valor |
| --- | --- |
| NONHUMAN_DEBUG | 0 |
| DEMO_MODE | 0 |
| SECRET_KEY | Aleatoria, minimo 50 caracteres; conservar entre despliegues |
| DATABASE_URL | Conexion PostgreSQL con SSL |
| PUBLIC_URL | Origen HTTPS publico, sin ruta |
| RESEND_API_KEY | Clave privada del servicio de correo |
| DEFAULT_FROM_EMAIL | Remitente verificado |
| BOOTSTRAP_ADMIN_DNI | DNI del primer administrador |
| BOOTSTRAP_ADMIN_EMAIL | Correo del primer administrador |
| BOOTSTRAP_ADMIN_NAME | Nombre completo, igual al Excel |
| ALLOWED_HOSTS | Hosts adicionales separados por comas, si son necesarios |

El hostname de PUBLIC_URL y el de Render se permiten automaticamente.
Django lee el entorno; no carga `.env` por si solo. No usar los marcadores del ejemplo
como credenciales. Generar un secreto con:

```sh
python -c "import secrets; print(secrets.token_urlsafe(64))"
```

## Primer despliegue

1. Revisar que CI pase en GitHub: pruebas SQLite/PostgreSQL, navegador y build Docker.
2. Crear PostgreSQL externo y configurar las variables.
3. En Render, conectar la repo como Blueprint usando `render.yaml`; o construir la
   imagen con `docker build -t nonhuman-lab .` en otro alojamiento.
4. El arranque aplica migraciones, crea el primer administrador si no existe y
   procesa invitaciones pendientes. No crea contrasenas ni datos de demo.
5. Verificar `/healthz`: debe devolver 200 y `{"status":"ok"}`.
6. Abrir el correo del administrador y crear su contrasena. Retirar las variables
   BOOTSTRAP_ADMIN una vez confirmado el acceso.
7. Importar miembros y verificar roles, correo y permisos.
8. Probar Android/iOS y restaurar un backup de prueba antes de incorporar uso real.
9. Asociar el dominio solo despues de aprobar la URL temporal y coordinar con Leo.

Otros alojamientos deben ejecutar `scripts/start.sh` detras de un proxy HTTPS que
reescriba X-Forwarded-Proto; no exponer Gunicorn directamente a internet.

## Importacion de miembros

El Excel admite `Nombres, Apellidos, DNI, Correo`; tambien se acepta
`nombre,dni,correo,rol`. Conservar DNI como texto si tiene ceros iniciales.

La lista inicial tiene 17 cuentas: 3 administradores y 14 miembros. Confirmar los DNI
de Mauricio, Leonardo Perez y Diego Pozo contra el Excel privado, nunca por coincidencia
parcial de nombre.

Desde un entorno privado con las variables de la base destino:

```sh
python manage.py import_members /ruta/privada/miembros.xlsx --admin-dni DNI_MAURICIO --admin-dni DNI_LEO --admin-dni DNI_DIEGO --skip-existing
```

Revisar el resumen y repetir con `--apply`. Luego ejecutar:

```sh
python manage.py send_pending_mail
```

`--skip-existing` solo omite cuentas activas cuyo nombre, correo y rol coinciden
exactamente. Cualquier diferencia bloquea la importacion; nunca sobreescribe personas
ni cambia permisos. Esto permite conservar la cuenta creada por bootstrap.
Las otras personas se crean como miembros, aunque el archivo indique otro rol.

Si el alojamiento no ofrece consola, ejecutar estos comandos desde un equipo autorizado
con acceso SSL a PostgreSQL. No subir el Excel al directorio publico ni al contenedor.
El panel permite altas individuales e importacion con previsualizacion; sin columna rol
las altas son miembros, por lo que las altas administrativas requieren seleccionar su rol.

## Operacion

- Reintentar correos: `python manage.py send_pending_mail`. El arranque tambien
  reintenta pendientes. No existe un worker periodico de correo.
- Limpiar sesiones vencidas: `python manage.py clearsessions`, programado diariamente.
- Exportar backups con `pg_dump --format=custom` usando credenciales protegidas;
  almacenarlos fuera del alojamiento y probar `pg_restore` en una base separada.
- Antes de actualizar: backup, CI aprobado y comprobacion de migraciones.
  Un rollback de imagen no revierte cambios de base de datos.
- Importar personas en lotes pequenos desde el panel: el envio de invitaciones es
  sincrono. Revisar correos pendientes si el proveedor falla.

## Validacion pendiente

El despliegue publico, Docker, PostgreSQL real, correo y restauracion deben probarse
en la infraestructura destino. CI esta preparado, pero debe ejecutarse tras subir la repo.
`check --deploy` conserva los avisos HSTS W005/W021: no activar subdominios ni preload
sin confirmar su alcance. No se ha realizado una auditoria de seguridad independiente.

Referencias: [Django](https://docs.djangoproject.com/en/5.2/howto/deployment/checklist/),
[Render](https://render.com/docs/deploy-django), [health checks](https://render.com/docs/health-checks).
