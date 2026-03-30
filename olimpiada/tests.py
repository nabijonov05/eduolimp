import json
from django.test import TestCase
from django.urls import reverse
from django.contrib.auth.models import User
from unittest.mock import patch

from .models import Student, TestResult, SystemSettings, UserSession


#1. UNIT TEST
class StudentModelUnitTest(TestCase):

    def test_student_defaults_and_str(self):
        student = Student.objects.create(
            first_name="Ali", last_name="Valiyev", middle_name="X",
            email="ali@test.com", password="pass123",
            school="1-maktab", grade=9, subject="Matematika",
            exam_date="2026-04-01", exam_time="10:00:00",
        )

        self.assertEqual(str(student), "Ali Valiyev")

        self.assertTrue(student.is_active)

        self.assertEqual(student.optional_subjects, [])


#2. INTEGRAL TEST
class SaveTestResultIntegralTest(TestCase):

    def setUp(self):
        self.student = Student.objects.create(
            first_name="Jasur", last_name="Ergashev", middle_name="X",
            email="jasur@test.com", password="pass",
            school="Maktab", grade=9, subject="Fizika",
            exam_date="2026-04-01", exam_time="10:00:00",
        )
        session = self.client.session
        session['student_id'] = self.student.id
        session.save()

    def test_save_result_creates_record(self):
        payload = {
            "subject": "Fizika",
            "correct": 24,
            "total": 30,
            "percent": 80.0,
            "user_answers": {"1": "A", "2": "C"},
            "test_id": None,
        }
        response = self.client.post(
            reverse('save_test_result'),
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'success')
        self.assertEqual(TestResult.objects.count(), 1)
        result = TestResult.objects.first()
        self.assertEqual(result.correct_count, 24)
        self.assertEqual(result.first_name, "Jasur")


#3. SYSTEM TEST
class StudentFullFlowSystemTest(TestCase):


    def setUp(self):
        self.student = Student.objects.create(
            first_name="Kamola", last_name="Tosheva", middle_name="X",
            email="kamola@test.com", password="kamola2026",
            school="7-maktab", grade=10, subject="Kimyo",
            exam_date="2026-04-01", exam_time="09:00:00",
        )

    def test_login_dashboard_save_result(self):
        # 1. Login
        response = self.client.post(reverse('student_login'), {
            'username': 'kamola@test.com',
            'password': 'kamola2026',
        })
        self.assertEqual(response.status_code, 302)
        self.assertEqual(self.client.session.get('student_id'), self.student.id)

        # 2. Dashboard ochilishi
        response = self.client.get(reverse('student_dashboard'))
        self.assertEqual(response.status_code, 200)

        # 3. Test natijasini saqlash
        payload = {
            "subject": "Kimyo",
            "correct": 28,
            "total": 30,
            "percent": 93.3,
            "user_answers": {"1": "B", "2": "A"},
            "test_id": None,
        }
        response = self.client.post(
            reverse('save_test_result'),
            data=json.dumps(payload),
            content_type='application/json',
        )
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['status'], 'success')


        result = TestResult.objects.first()
        self.assertEqual(result.first_name, "Kamola")
        self.assertEqual(result.score_percent, 93.3)
        self.assertTrue(result.score_percent >= 85)