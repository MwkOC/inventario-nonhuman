# Requisitos de NonHuman Lab

## Alcance

Gestion del inventario, prestamos, consumibles, asistencia y visitas de un laboratorio
de electronica y robotica. Interfaz administrativa tipo ERP y web instalable en Android/iOS.
Conexion a internet requerida. Temas claro y oscuro con identidad tipografica NonHuman.

Lista inicial confirmada: 17 cuentas, 3 administradores y 14 miembros.
Administradores: Mauricio, Leonardo Perez y Diego Pozo. No hay externos en el Excel inicial.
Los datos personales se cargan desde el archivo privado y no forman parte del repositorio.

## Permisos

| Funcion | Administrador | Miembro | Externo |
| --- | --- | --- | --- |
| Entrada, salida e historial propio | Si | Si | Si |
| Consultar inventario y retirar articulos | Si | Si | No |
| Devolver prestamos propios | Si | Si | No |
| Registrar visitas y sus salidas | Si | Si | No |
| Gestionar personas e inventario | Si | No | No |
| Ver asistencia general, prestamos y actividad | Si | No | No |
| Recibir notificaciones de retiros | Si | No | No |

Un externo tiene cuenta; una visita no. Los miembros solo consultan sus prestamos
y visitas. Un administrador no devuelve prestamos ajenos.

## Cuentas

- DNI como usuario y correo personal para activacion y recuperacion.
- Cada persona crea su contrasena; no hay contrasena compartida de produccion.
- Sesion persistente de 30 dias renovables, con cierre explicito.
- Desactivar una cuenta revoca el acceso y conserva sus registros.
- Reactivar requiere crear una nueva contrasena.
- Importacion XLSX/CSV validada antes de crear cuentas.

## Asistencia y visitas

- Entrada y salida mediante botones separados; una sola entrada abierta por persona.
- El anfitrion registra nombre, motivo, entrada y salida de cada visita.
- Sin limite de cantidad de visitas.
- Al salir con visitas abiertas, mostrar recordatorio; no cerrarlas automaticamente.
- Dashboard de entradas semanales y personas presentes. Zona horaria: America/Lima.
- Entrada al laboratorio y sesion de la cuenta son estados independientes.

## Inventario y prestamos

- Articulos con codigo, nombre, categoria, ubicacion, disponibilidad y stock minimo.
- Equipos reutilizables y consumibles.
- Retiro directo, sin aprobacion, con cantidades y motivo.
- Fecha y hora de devolucion obligatorias para reutilizables.
- Consumibles descuentan existencias y no se devuelven.
- Devoluciones completas o parciales, sin aprobacion administrativa.
- Las unidades averiadas quedan fuera de disponibilidad hasta registrar reparacion.
- Cada retiro notifica a todos los administradores dentro del panel, con lectura individual.
- No permitir stock negativo, devoluciones excesivas ni operaciones duplicadas.
- No hay inventario real cargado inicialmente; se registra progresivamente.

## Entrega y limites

- Despliegue de bajo costo; probar primero una URL temporal antes del dominio definitivo.
- Repo sin datos personales, claves, correos ni bases locales.
- Historial de actividad y notificaciones: ultimos 100 registros en la vista actual.
- Asistencia, prestamos y visitas se cargan completos; incorporar paginacion al crecer.
- Imagenes mediante URL HTTPS; no hay almacenamiento de fotos subidas.
- No incluye app nativa, operaciones offline, aprobaciones ni edicion de roles existentes.
- Antes del uso real: validar PostgreSQL, permisos, correo, dispositivos y backups.
