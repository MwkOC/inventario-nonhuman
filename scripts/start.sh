#!/bin/sh
set -eu
python manage.py migrate --noinput
python manage.py bootstrap_admin
python manage.py send_pending_mail
exec gunicorn server.wsgi:application --bind "0.0.0.0:${PORT:-8000}" --workers 2 --access-logfile - --access-logformat '%(m)s %(U)s %(s)s'
