import os
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from lab.models import User, MailTask
from lab.views import parse_people

class Command(BaseCommand):
    help = 'Provision the first admin from environment; invitation only, no default password.'
    def handle(self, *args, **options):
        if User.objects.filter(role='admin',is_active=True).exists():
            return
        dni=os.getenv('BOOTSTRAP_ADMIN_DNI')
        if not dni:
            raise CommandError('Set BOOTSTRAP_ADMIN_DNI, BOOTSTRAP_ADMIN_EMAIL and BOOTSTRAP_ADMIN_NAME for the first administrator.')
        row=parse_people([{'dni':dni,'email':os.getenv('BOOTSTRAP_ADMIN_EMAIL',''),'name':os.getenv('BOOTSTRAP_ADMIN_NAME',''),'role':'admin'}])[0]
        if row['error']:
            raise CommandError(row['error'])
        with transaction.atomic():
            user=User.objects.create_user(username=row['dni'],email=row['email'],first_name=row['name'],role='admin',password=None)
            MailTask.objects.create(user=user)
        self.stdout.write('Initial administrator created; invitation queued.')
