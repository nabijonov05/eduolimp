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
    exam_date = models.DateField()
    exam_time = models.TimeField()
    created_at = models.DateTimeField(auto_now_add=True)
    is_active = models.BooleanField(default=True)

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
    retry_attempts = models.IntegerField(default=1)

    def __str__(self):
        return "Tizim sozlamalari"
































