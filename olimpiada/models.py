from django.contrib.auth.models import User
from django.db import models


#==================================================================================================
class Profile(models.Model):

    user = models.OneToOneField(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.user.username} profili"

#===================================================================================================

#===================================================================================================
class Student(models.Model):

    first_name = models.CharField(max_length=100)
    last_name = models.CharField(max_length=100)
    middle_name = models.CharField(max_length=100)
    email = models.EmailField(max_length=100)
    password = models.CharField(max_length=100)
    school = models.CharField(max_length=200)
    grade = models.IntegerField()
    subject = models.CharField(max_length=100)
    optional_subjects = models.JSONField(default=list, blank=True)
    exam_date = models.DateField()
    exam_time = models.TimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)
    photo = models.ImageField(upload_to='students/photos/', null=True, blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name}"

#====================================================================================================

#====================================================================================================
class TestMaterial(models.Model):
    subject = models.CharField(max_length=100)
    grade = models.IntegerField()
    file = models.FileField(upload_to='tests/')

#=====================================================================================================

#=====================================================================================================
class TestResult(models.Model):
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    school = models.CharField(max_length=255)
    grade = models.IntegerField()

    subject = models.CharField(max_length=100)
    correct_count = models.IntegerField()
    total_questions = models.IntegerField()
    score_percent = models.FloatField()
    date_taken = models.DateTimeField(auto_now_add=True)

    # --- QO'SHILISHI KERAK BO'LGAN MAYDONLAR ---
    # Qaysi test faylidan foydalanilgani
    test_material_id = models.IntegerField(null=True, blank=True)
    # Foydalanuvchi javoblari: { "1": "A", "2": "C", ... } ko'rinishida saqlanadi
    user_answers = models.JSONField(null=True, blank=True)

    questions_order = models.JSONField(null=True, blank=True)

    def __str__(self):
        return f"{self.first_name} {self.last_name} - {self.subject}"

#======================================================================================================

#======================================================================================================
from django.db import models

class SystemSettings(models.Model):
    total_questions = models.IntegerField(default=30)
    test_duration = models.IntegerField(default=60) # Daqiqada
    default_points = models.IntegerField(default=4)

    def __str__(self):
        return "Tizim sozlamalari"


from django.db import models
from django.utils import timezone


class UserSession(models.Model):
    """Foydalanuvchining faol seanslarini saqlash — Telegram uslubida"""
    student = models.ForeignKey('Student', on_delete=models.CASCADE,
                                related_name='user_sessions')
    session_key = models.CharField(max_length=64, blank=True)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(blank=True)
    device = models.CharField(max_length=30, default='Kompyuter')  # Kompyuter / Telefon / Planshet
    browser = models.CharField(max_length=30, default='Boshqa')  # Chrome / Firefox / Safari ...
    is_active = models.BooleanField(default=True)
    created_at = models.DateTimeField(default=timezone.now)
    last_activity = models.DateTimeField(default=timezone.now)

    class Meta:
        ordering = ['-last_activity']
        verbose_name = 'Foydalanuvchi seansi'
        verbose_name_plural = 'Foydalanuvchi seanslari'

    def __str__(self):
        return f"{self.student} — {self.device} ({self.browser})"



























