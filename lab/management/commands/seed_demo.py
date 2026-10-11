from datetime import timedelta
from django.conf import settings
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction
from django.utils import timezone
from lab.models import User, Item, Attendance, Visit, Loan, Event, Notification

class Command(BaseCommand):
    help = 'Create fictional local demonstration data (never production).'
    @transaction.atomic
    def handle(self, *args, **options):
        if not settings.DEMO_MODE:
            raise CommandError('Demo seeding is disabled outside local demo mode.')
        if User.objects.exists():
            self.stdout.write('Existing data preserved; demo not reseeded.')
            return
        names = ['Alex Rivera','Lucia Torres','Diego Vargas','Valeria Ruiz','Mateo Silva','Camila Rojas','Nicolas Leon','Sofia Castro','Gabriel Diaz','Andrea Paz','Sebastian Flores','Daniela Vega','Martin Luna','Isabella Soto','Adrian Cruz','Elena Campos','Bruno Salas','Paula Mendez','Joaquin Reyes','Renata Molina','Tomas Vidal']
        users = []
        for i,name in enumerate(names):
            role = 'admin' if i<5 else ('member' if i<15 else 'external')
            users.append(User.objects.create_user(username=f'{10000001+i}',email=f'demo{i+1}@example.com',password='NonHuman2026!',first_name=name,role=role))
        items = [
            ('NH-001','Arduino Uno R3','Componentes','A1 · Electronica',12,False,'arduino'),
            ('NH-002','Camara Raspberry Pi','Camaras','A2 · Vision',5,False,'camera'),
            ('NH-003','Servomotor MG996R','Actuadores','B1 · Actuadores',18,False,'servo'),
            ('NH-004','Raspberry Pi 4','Componentes','A1 · Electronica',8,False,'pi'),
            ('NH-005','Multimetro digital','Herramientas','C1 · Instrumentos',6,False,'meter'),
            ('NH-006','Cables Dupont (pack)','Consumibles','B2 · Conectores',32,True,'wires'),
            ('NH-007','Sensor ultrasonico HC-SR04','Sensores','A3 · Sensores',15,False,'sensor'),
            ('NH-008','Kit de destornilladores','Herramientas','C2 · Herramientas',4,False,'tools'),
            ('NH-009','Resistencias 220 ohm','Consumibles','B2 · Conectores',80,True,'resistor'),
        ]
        created = []
        for code,name,category,location,total,consumable,image in items:
            created.append(Item.objects.create(code=code,name=name,category=category,location=location,total=total,available=total,consumable=consumable,minimum=3,image=f'/assets/{image}.jpg'))
        now = timezone.now()
        for day in range(28):
            for j in range(4 + (day*7)%11):
                start = (now-timedelta(days=day)).replace(hour=13+j%4,minute=(j*13)%60,second=0,microsecond=0)
                if start > now:
                    continue
                Attendance.objects.create(user=users[(j+day)%21],entered=start,exited=min(start+timedelta(hours=2),now))
        for u in users[1:7]:
            Attendance.objects.create(user=u,entered=now-timedelta(minutes=20+u.id*7))
        for i,(u,item) in enumerate(zip(users[5:9],created[:4])):
            Loan.objects.create(user=u,item=item,quantity=2,reason=['Prototipo de brazo robotico','Pruebas de vision artificial','Calibracion de actuadores','Teleoperacion'][i],due=now+timedelta(days=i-1),created=now-timedelta(days=2))
            item.available -= 2
            item.save()
            e = Event.objects.create(actor=u,text=f'Retiro: 2 × {item.name}',kind='checkout')
            Notification.objects.bulk_create([Notification(event=e,recipient=a,read=i>1) for a in users[:5]])
        Visit.objects.create(host=users[0],name='Mariana Lopez',reason='Reunion de proyecto',entered=now-timedelta(minutes=40))
        Event.objects.create(actor=users[1],text='Registro de entrada',kind='attendance')
        self.stdout.write('Demo ready: admin 10000001, member 10000006, external 10000016. Password: NonHuman2026!')
