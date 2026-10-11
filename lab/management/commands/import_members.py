from pathlib import Path
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from lab.models import User, MailTask
from lab.views import read_people_file, ApiError


class Command(BaseCommand):
    help = 'Validate a roster; --apply creates accounts without sending email or assigning passwords.'

    def add_arguments(self, parser):
        parser.add_argument('file')
        parser.add_argument('--admin-dni', action='append', default=[])
        parser.add_argument('--apply', action='store_true')
        parser.add_argument('--skip-existing', action='store_true')

    def handle(self, *args, **options):
        path = Path(options['file'])
        if not path.is_file() or path.stat().st_size > 2*1024*1024:
            raise CommandError('Provide a workbook or CSV up to 2 MB.')
        try:
            with path.open('rb') as file:
                rows = read_people_file(file, allow_existing=options['skip_existing'])
        except (ApiError, ValueError, StopIteration) as exc:
            raise CommandError(getattr(exc, 'message', str(exc)))
        if not rows or any(r['error'] for r in rows):
            raise CommandError('Invalid or duplicate accounts. No data was imported.')
        admins = set(options['admin_dni'])
        if not admins or not admins.issubset({r['dni'] for r in rows}):
            raise CommandError('Specify administrator DNIs present in this roster.')
        new_rows = []
        for row in rows:
            role = 'admin' if row['dni'] in admins else 'member'
            existing = User.objects.filter(username=row['dni']).first()
            if existing:
                if not options['skip_existing'] or (existing.first_name, existing.email.lower(), existing.role) != (row['name'], row['email'], role) or not existing.is_active:
                    raise CommandError('An existing account differs from the roster. No accounts were changed.')
            else:
                if User.objects.filter(email__iexact=row['email']).exists():
                    raise CommandError('An email is already assigned to another account.')
                new_rows.append(row)
        self.stdout.write(f'{len(rows)} accounts: {len(admins)} admins, {len(rows)-len(admins)} members.')
        self.stdout.write(f'{len(new_rows)} new accounts; {len(rows)-len(new_rows)} existing accounts preserved.')
        if not options['apply']:
            self.stdout.write('Validation only. Use --apply to import.')
            return
        with transaction.atomic():
            for row in new_rows:
                user = User.objects.create_user(username=row['dni'],first_name=row['name'],email=row['email'],
                    role='admin' if row['dni'] in admins else 'member',password=None)
                MailTask.objects.create(user=user)
        self.stdout.write('Accounts created; invitations queued. No emails sent or default passwords set.')
