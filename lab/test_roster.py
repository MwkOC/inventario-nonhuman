from io import BytesIO
from pathlib import Path
from tempfile import TemporaryDirectory
from unittest.mock import MagicMock, patch
from django.test import TestCase
from django.core.management import call_command
from django.core.management.base import CommandError
from .models import User, MailTask
from .views import parse_people, read_people_file


class RosterTests(TestCase):
    def test_split_names_float_dni_and_trimmed_email(self):
        rows = parse_people([{'Nombres':'Ana Maria ', 'Apellidos':' Perez Ruiz ',
            'DNI':12345678.0, 'Correo':' ana@example.com '}])
        self.assertEqual(rows[0], {'dni':'12345678','name':'Ana Maria Perez Ruiz',
            'email':'ana@example.com','role':'member','error':''})

    def test_invalid_numeric_dni_is_not_guessed(self):
        for dni in (12345678.5,1234567.0):
            self.assertTrue(parse_people([{'dni':dni,'name':'Ana','email':'ana@example.com'}])[0]['error'])

    @patch('lab.views.load_workbook')
    def test_xlsx_without_declared_dimensions(self, loader):
        book = MagicMock()
        book.active.max_row = None
        book.active.iter_rows.return_value = iter([
            ('Nombres','Apellidos','DNI','Correo'),
            ('Ana','Perez',12345678.0,'ana@example.com')])
        loader.return_value = book
        file = BytesIO(b'fixture'); file.name = 'roster.xlsx'
        self.assertEqual(read_people_file(file)[0]['name'],'Ana Perez')
        book.close.assert_called_once()

    def test_roster_import_explicit_admins_and_no_default_password(self):
        with TemporaryDirectory() as directory:
            file = Path(directory) / 'roster.csv'
            file.write_text('Nombres,Apellidos,DNI,Correo,rol\nAna,Perez,12345678,ana@example.com,member\nLuis,Ruiz,87654321,luis@example.com,admin\n')
            with self.assertRaises(CommandError):
                call_command('import_members',str(file),admin_dni=['99999999'],apply=True)
            call_command('import_members',str(file),admin_dni=['12345678'])
            self.assertFalse(User.objects.exists())
            call_command('import_members',str(file),admin_dni=['12345678'],apply=True)
            self.assertEqual(User.objects.get(username='12345678').role,'admin')
            self.assertEqual(User.objects.get(username='87654321').role,'member')
            self.assertTrue(all(not u.has_usable_password() for u in User.objects.all()))
            self.assertEqual(MailTask.objects.filter(sent=None).count(),2)
            with self.assertRaises(CommandError):
                call_command('import_members',str(file),admin_dni=['12345678'],apply=True)
            self.assertEqual(User.objects.count(),2)
            call_command('import_members',str(file),admin_dni=['12345678'],skip_existing=True,apply=True)
            self.assertEqual(User.objects.count(),2)
            self.assertEqual(MailTask.objects.count(),2)
            with self.assertRaises(CommandError):
                call_command('import_members',str(file),admin_dni=['87654321'],skip_existing=True,apply=True)
            User.objects.filter(username='12345678').update(first_name='Different name')
            with self.assertRaises(CommandError):
                call_command('import_members',str(file),admin_dni=['12345678'],skip_existing=True,apply=True)
