import json
from urllib.request import Request, urlopen
from django.conf import settings
from django.core.mail.backends.base import BaseEmailBackend

class ResendBackend(BaseEmailBackend):
    def send_messages(self, messages):
        if not settings.RESEND_API_KEY:
            raise RuntimeError('Configure RESEND_API_KEY before sending invitations')
        sent = 0
        for message in messages:
            data = json.dumps({'from':message.from_email,'to':message.to,'subject':message.subject,'text':message.body}).encode()
            request = Request('https://api.resend.com/emails', data=data, headers={'Authorization':f'Bearer {settings.RESEND_API_KEY}','Content-Type':'application/json','User-Agent':'NonHuman-Lab/1.0'})
            with urlopen(request, timeout=15) as response:
                if response.status not in (200,201):
                    raise RuntimeError('Email delivery failed')
            sent += 1
        return sent
