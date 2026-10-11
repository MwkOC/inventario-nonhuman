from django.contrib.auth.models import AbstractUser
from django.db import models
from django.db.models import Q, F

class User(AbstractUser):
    role = models.CharField(max_length=12, choices=[('admin','Administrador'),('member','Miembro'),('external','Externo')], default='member')
    email = models.EmailField(unique=True)

class Attendance(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    entered = models.DateTimeField()
    exited = models.DateTimeField(null=True, blank=True)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user'], condition=Q(exited=None), name='one_open_attendance')]

class Visit(models.Model):
    host = models.ForeignKey(User, on_delete=models.PROTECT)
    name = models.CharField(max_length=100)
    reason = models.CharField(max_length=300)
    entered = models.DateTimeField()
    exited = models.DateTimeField(null=True, blank=True)

class Item(models.Model):
    code = models.CharField(max_length=30, unique=True)
    name = models.CharField(max_length=120)
    category = models.CharField(max_length=50)
    location = models.CharField(max_length=100)
    consumable = models.BooleanField(default=False)
    total = models.PositiveIntegerField()
    available = models.PositiveIntegerField()
    unavailable = models.PositiveIntegerField(default=0)
    minimum = models.PositiveIntegerField(default=2)
    image = models.CharField(max_length=500, blank=True)
    active = models.BooleanField(default=True)
    class Meta:
        constraints = [models.CheckConstraint(condition=Q(available__lte=F('total')), name='stock_within_total')]

class Loan(models.Model):
    user = models.ForeignKey(User, on_delete=models.PROTECT)
    item = models.ForeignKey(Item, on_delete=models.PROTECT)
    quantity = models.PositiveIntegerField()
    returned = models.PositiveIntegerField(default=0)
    reason = models.CharField(max_length=300)
    due = models.DateTimeField(null=True, blank=True)
    created = models.DateTimeField()
    class Meta:
        constraints = [models.CheckConstraint(condition=Q(returned__lte=F('quantity')), name='return_within_loan')]

class Event(models.Model):
    actor = models.ForeignKey(User, on_delete=models.PROTECT)
    text = models.CharField(max_length=400)
    kind = models.CharField(max_length=30)
    created = models.DateTimeField(auto_now_add=True)

class Notification(models.Model):
    event = models.ForeignKey(Event, on_delete=models.CASCADE)
    recipient = models.ForeignKey(User, on_delete=models.CASCADE)
    read = models.BooleanField(default=False)

class Mutation(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    key = models.CharField(max_length=64)
    class Meta:
        constraints = [models.UniqueConstraint(fields=['user','key'], name='unique_mutation')]

class MailTask(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    created = models.DateTimeField(auto_now_add=True)
    sent = models.DateTimeField(null=True)
    attempts = models.PositiveIntegerField(default=0)
