from django.core.management.base import BaseCommand
from lab.models import MailTask
from lab.views import send_access

class Command(BaseCommand):
    help = 'Retry pending invitations; run one worker and respect provider quotas.'
    def handle(self,*args,**options):
        for task in MailTask.objects.filter(sent=None,user__is_active=True).select_related('user').order_by('created')[:50]:
            try:
                send_access(task)
            except Exception:
                self.stderr.write('Delivery failed; pending invitation retained. Check email configuration.')
                break
