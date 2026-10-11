import json
import uuid
from datetime import timedelta
from django.test import TestCase, Client, override_settings
from django.contrib.auth.tokens import default_token_generator
from django.utils import timezone
from django.utils.http import urlsafe_base64_encode
from django.utils.encoding import force_bytes
from django.core.files.uploadedfile import SimpleUploadedFile
from .models import User, Item, Loan, Notification, Attendance, Visit, Mutation

@override_settings(EMAIL_BACKEND='django.core.mail.backends.locmem.EmailBackend')
class LabTests(TestCase):
    @classmethod
    def setUpTestData(cls):
        cls.admin = User.objects.create_user(username='10000001',email='a@example.com',password='TestingLab2026!',role='admin')
        cls.admin2 = User.objects.create_user(username='10000002',email='b@example.com',password='TestingLab2026!',role='admin')
        cls.member = User.objects.create_user(username='10000006',email='m@example.com',password='TestingLab2026!')
        cls.external = User.objects.create_user(username='10000016',email='e@example.com',password='TestingLab2026!',role='external')
        cls.item = Item.objects.create(code='X',name='Camara',total=3,available=3)
        cls.consumable = Item.objects.create(code='C',name='Cable',total=5,available=5,consumable=True)

    def setUp(self):
        self.client.force_login(self.member)

    def post(self, action, data=None, key=None):
        return self.client.post('/api/'+action,json.dumps(data or {}),content_type='application/json',HTTP_IDEMPOTENCY_KEY=key or str(uuid.uuid4()))

    def checkout(self, items=None, **kwargs):
        return self.post('checkout',{'items':items or [{'id':self.item.id,'quantity':2}],'reason':'Proyecto','due':(timezone.now()+timedelta(days=1)).isoformat()},**kwargs)

    def test_checkout_idempotency_and_all_admin_notifications(self):
        self.assertEqual(self.checkout(key='same').status_code,200)
        self.assertEqual(self.checkout(key='same').status_code,200)
        self.item.refresh_from_db()
        self.assertEqual(self.item.available,1)
        self.assertEqual(Loan.objects.count(),1)
        self.assertEqual(Notification.objects.count(),2)

    def test_all_or_nothing_stock(self):
        result=self.checkout([{'id':self.item.id,'quantity':2},{'id':self.consumable.id,'quantity':6}])
        self.assertEqual(result.status_code,400)
        self.item.refresh_from_db()
        self.assertEqual(self.item.available,3)
        self.assertFalse(Loan.objects.exists())
        self.assertFalse(Mutation.objects.exists())

    def test_admin_can_borrow_and_return_own_items(self):
        self.client.force_login(self.admin)
        self.assertEqual(self.checkout().status_code,200)
        loan=Loan.objects.get(user=self.admin)
        self.assertEqual(self.post('return',{'id':loan.id,'quantity':2}).status_code,200)
        loan.refresh_from_db()
        self.item.refresh_from_db()
        self.assertEqual(loan.returned,loan.quantity)
        self.assertEqual(self.item.available,self.item.total)

    def test_partial_damaged_and_double_returns(self):
        self.checkout()
        loan=Loan.objects.get()
        self.assertEqual(self.post('return',{'id':loan.id,'quantity':1}).status_code,200)
        self.assertEqual(self.post('return',{'id':loan.id,'quantity':1,'damaged':True}).status_code,200)
        self.assertEqual(self.post('return',{'id':loan.id,'quantity':1}).status_code,400)
        self.item.refresh_from_db()
        self.assertEqual((self.item.available,self.item.unavailable),(2,1))

    def test_consumption_has_no_return(self):
        self.assertEqual(self.post('checkout',{'items':[{'id':self.consumable.id,'quantity':2}],'reason':'Soldadura'}).status_code,200)
        self.consumable.refresh_from_db()
        self.assertEqual((self.consumable.total,self.consumable.available),(3,3))
        self.assertIsNone(Loan.objects.get().due)
        self.assertEqual(self.post('return',{'id':Loan.objects.get().id,'quantity':1}).status_code,400)

    def test_external_scoped_data_and_permissions(self):
        self.client.force_login(self.external)
        self.assertEqual(self.post('check-in').status_code,200)
        self.assertEqual(self.post('check-in').status_code,400)
        state=self.client.get('/api/state').json()
        self.assertNotIn('items',state)
        self.assertNotIn('people',state)
        self.assertEqual(len(state['attendance']),1)
        for action in ['checkout','visit-create','person-create','item-create','notifications-read']:
            self.assertEqual(self.post(action).status_code,403)
        self.assertEqual(self.post('check-out').status_code,200)

    def test_member_cannot_manage_people_or_return_others(self):
        self.assertEqual(self.post('person-create').status_code,403)
        self.checkout()
        self.client.force_login(self.admin)
        self.assertEqual(self.post('return',{'id':Loan.objects.get().id,'quantity':1}).status_code,403)

    def test_notification_reads_independent(self):
        self.checkout()
        self.client.force_login(self.admin)
        self.post('notifications-read')
        self.assertTrue(Notification.objects.get(recipient=self.admin).read)
        self.assertFalse(Notification.objects.get(recipient=self.admin2).read)

    def test_host_exit_keeps_visit_open(self):
        self.post('check-in')
        self.post('visit-create',{'name':'Invitado','reason':'Proyecto'})
        self.assertEqual(self.post('check-out').json()['open_visits'],1)
        self.assertIsNone(Visit.objects.get().exited)

    def test_csrf_required_and_private_api(self):
        c=Client(enforce_csrf_checks=True)
        self.assertEqual(c.post('/api/login',{},content_type='application/json').status_code,403)
        self.assertEqual(c.get('/api/state').status_code,401)

    def test_password_token_single_use(self):
        self.client.logout()
        body={'uid':urlsafe_base64_encode(force_bytes(self.member.pk)),'token':default_token_generator.make_token(self.member),'password':'AnotherSecure2026!'}
        self.assertEqual(self.post('set-password',body).status_code,200)
        self.assertEqual(self.post('set-password',body).status_code,400)

    def test_deactivation_revokes_existing_session(self):
        member_client=self.client
        self.client=Client()
        self.client.force_login(self.admin)
        self.assertEqual(self.post('person-toggle',{'id':self.member.id}).status_code,200)
        self.assertEqual(member_client.get('/api/state').status_code,401)
        self.assertEqual(self.post('person-toggle',{'id':self.member.id}).status_code,200)
        self.assertEqual(member_client.get('/api/state').status_code,401)
        self.assertEqual(self.post('person-toggle',{'id':self.admin.id}).status_code,400)

    def test_import_validation_and_invalid_file(self):
        self.client.force_login(self.admin)
        f=SimpleUploadedFile('people.csv',b'dni,nombre,correo,rol\n12345678,Persona,p@example.com,externo\n12345678,Otra,o@example.com,miembro\n')
        rows=self.client.post('/api/import-preview',{'file':f}).json()['rows']
        self.assertEqual(rows[0]['role'],'external')
        self.assertTrue(rows[1]['error'])
        self.assertEqual(self.post('import-people',{'rows':rows}).status_code,400)
        bad=SimpleUploadedFile('invalid.xlsx',b'not an excel')
        self.assertEqual(self.client.post('/api/import-preview',{'file':bad}).status_code,400)

    def test_invitation_creates_unusable_password_and_sends_access(self):
        from django.core import mail
        self.client.force_login(self.admin)
        with self.captureOnCommitCallbacks(execute=True):
            response=self.post('person-create',{'dni':'12345678','name':'Nueva Persona','email':'new@example.com','role':'member'})
        self.assertEqual(response.status_code,200)
        self.assertFalse(User.objects.get(username='12345678').has_usable_password())
        self.assertEqual(len(mail.outbox),1)
        self.assertIn('?uid=',mail.outbox[0].body)

    def test_login_rate_limit(self):
        self.client.logout()
        for _ in range(5):
            result=self.post('login',{'dni':self.member.username,'password':'wrong'})
        self.assertEqual(result.status_code,429)

    def test_invalid_payload_shapes_rejected(self):
        self.assertEqual(self.post('checkout',{'items':['invalid'],'reason':'Prueba'}).status_code,400)
        self.client.force_login(self.admin)
        self.assertEqual(self.post('import-people',{'rows':{}}).status_code,400)
