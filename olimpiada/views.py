import os
import json
import string
import random
import secrets
import xlwt
from django.http import HttpResponse
import pandas as pd
from django.conf import settings
from django.http import JsonResponse
from .models import TestMaterial, TestResult, Student
from django.shortcuts import get_object_or_404
from django.core.mail import send_mail
from datetime import datetime, timedelta
from django.utils import timezone
from django.shortcuts import render, redirect
from django.db.models import Avg
from django.contrib.auth import authenticate, login as auth_login
from .models import SystemSettings
from django.urls import reverse
from .models import Student, TestResult
from django.db import connection
from django.shortcuts import render, redirect
from django.contrib.auth.decorators import login_required
from django.contrib.auth import update_session_auth_hash
from django.contrib import messages



#===========================================================================================================
def index(request):
    return render(request, 'html/index.html', {})
#===========================================================================================================

#===========================================================================================================
@login_required(login_url='login')
def admin_dashboard(request):
    # --- PAROLNI YANGILASH QISMI (POST) ---
    if request.method == 'POST' and 'current_password' in request.POST:
        user = request.user
        current_pw = request.POST.get('current_password')
        new_pw = request.POST.get('new_password')
        confirm_pw = request.POST.get('confirm_password')

        # 1. Joriy parol to'g'riligini tekshirish
        if not user.check_password(current_pw):
            messages.error(request, "Joriy parol noto'g'ri!")

        # 2. Yangi parollar mosligini tekshirish
        elif new_pw != confirm_pw:
            messages.error(request, "Yangi parollar bir-biriga mos kelmadi!")

        # 3. Yangi parol uzunligini tekshirish (ixtiyoriy)
        elif len(new_pw) < 6:
            messages.error(request, "Yangi parol kamida 6 ta belgidan iborat bo'lishi kerak!")

        else:
            # Hammasi to'g'ri bo'lsa, parolni saqlash
            user.set_password(new_pw)
            user.save()
            # Parol o'zgarganda sessiya tugab qolmasligi uchun session hashni yangilaymiz
            update_session_auth_hash(request, user)
            messages.success(request, "Admin paroli muvaffaqiyatli yangilandi!")
            # POST-dan keyin sahifani yangilab yuborish (redirect) tavsiya etiladi
            return redirect('admin_dashboard')

    students_list = Student.objects.all().order_by('-id')
    with connection.cursor() as cursor:
        # 1. Analitika uchun: Fanlar bo'yicha o'rtacha ballar
        cursor.execute("""
            SELECT subject, AVG(score_percent) 
            FROM olimpiada_testresult 
            GROUP BY subject
        """)
        subject_data = cursor.fetchall()

        # 2. Analitika uchun: Sinflar bo'yicha ishtirokchilar soni
        cursor.execute("""
            SELECT grade, COUNT(id) 
            FROM olimpiada_testresult 
            GROUP BY grade 
            ORDER BY grade ASC
        """)
        grade_data = cursor.fetchall()

        # 3. Dashboard uchun: Fanlar ro'yxati va ishtirokchilar soni
        cursor.execute("SELECT subject, COUNT(id) FROM olimpiada_testresult GROUP BY subject")
        subjects_list = [{'subject': row[0], 'total': row[1]} for row in cursor.fetchall()]

        # 4. Jadval uchun: Barcha natijalar (Sinf va Ball bo'yicha saralangan)
        cursor.execute("""
            SELECT id, first_name, last_name, grade, school, subject, correct_count, total_questions, score_percent 
            FROM olimpiada_testresult 
            ORDER BY subject, grade ASC, score_percent DESC
        """)
        all_results = [{
            'id': r[0], 'first_name': r[1], 'last_name': r[2],
            'grade': r[3], 'school': r[4], 'subject': r[5],
            'correct_count': r[6], 'total_questions': r[7], 'score_percent': r[8]
        } for r in cursor.fetchall()]

    all_materials = TestMaterial.objects.all()
    status_dict = {f"{item.subject}_{item.grade}": True for item in all_materials}

    # Ma'lumotlarni shablonga yuborish
    return render(request, 'html/admin.html', {
        'subjects_list': subjects_list,
        'all_results': all_results,
        'subject_labels': json.dumps([row[0] for row in subject_data]),
        'subject_scores': json.dumps([float(row[1]) for row in subject_data]),
        'grade_labels': json.dumps([f"{row[0]}-sinf" for row in grade_data]),
        'grade_counts': json.dumps([row[1] for row in grade_data]),
        'json_status': json.dumps(status_dict),
        'students_list': students_list,
    })
#====================================================================================================================

#====================================================================================================================
def delete_test_result(request, result_id):
    with connection.cursor() as cursor:
        cursor.execute("DELETE FROM olimpiada_testresult WHERE id = %s", [result_id])
    return redirect('admin_dashboard')
#====================================================================================================================

#====================================================================================================================
def delete_student(request, student_id):
    # O'quvchini bazadan qidiramiz, topilmasa 404 xatosi qaytadi
    student = get_object_or_404(Student, id=student_id)
    student.delete()


    return redirect(reverse('admin_dashboard') + '?section=users')

#===========================================================================================================

#============================================================================================================
def admin_login(request):
    if request.method == "POST":
        username = request.POST.get('username')
        password = request.POST.get('password')
        user = authenticate(request, username=username, password=password)

        if user is not None:
            auth_login(request, user)
            if user.is_superuser or user.is_staff:
                return redirect('admin_dashboard')
        else:
            messages.error(request, "Username yoki parol xato!")
            return render(request, 'html/admin_login.html', {})

    return render(request, 'html/admin_login.html', {})
#============================================================================================================

#============================================================================================================
def student_login(request):
    if request.method == "POST":
        email_input = request.POST.get('username')
        password_input = request.POST.get('password')

        # 1. Bazadan o'quvchini qidiramiz
        student = Student.objects.filter(email=email_input, password=password_input).first()

        if student:
            # 2. BLOKLANGANLIKNI TEKSHIRISH
            if not student.is_active:
                messages.error(request, "Sizning hisobingiz bloklangan!")
                return redirect('student_login')

            # 3. Agar hammasi joyida bo'lsa, sessiyaga saqlaymiz
            request.session['student_id'] = student.id
            messages.success(request, f"Xush kelibsiz, {student.first_name}!")
            return redirect('student_dashboard')
        else:
            # 4. Foydalanuvchi topilmasa
            messages.error(request, "Email yoki parol noto'g'ri!")
            return redirect('student_login')

    return render(request, 'html/login.html')
#=============================================================================================================

#=============================================================================================================
def add_student(request):
    if request.method == "POST":
        alphabet = string.ascii_letters + string.digits
        generated_password = ''.join(secrets.choice(alphabet) for _ in range(6))

        first_name = request.POST.get('first_name')
        email = request.POST.get('email')
        subject = request.POST.get('subject')
        exam_date = request.POST.get('exam_date')
        exam_time = request.POST.get('exam_time')

        Student.objects.create(
            first_name=request.POST.get('first_name'),
            last_name=request.POST.get('last_name'),
            middle_name=request.POST.get('middle_name'),
            email=request.POST.get('email'),
            password=generated_password,
            school=request.POST.get('school'),
            grade=request.POST.get('grade'),
            subject=request.POST.get('subject'),
            exam_date=request.POST.get('exam_date'),
            exam_time=request.POST.get('exam_time'),
        )

        message = f"""
                Assalomu alaykum, {first_name}!

                Siz EduOlimp platformasida muvaffaqiyatli ro'yxatdan o'tdingiz.

                Tizimga kirish ma'lumotlari:
                Login (Email): {email}
                Parol: {generated_password}

                Imtihon ma'lumotlari:
                Fan: {subject}
                Sana: {exam_date}
                Vaqt: {exam_time}

                Omad tilaymiz!
                """

        try:
            send_mail(
                subject,
                message,
                settings.EMAIL_HOST_USER,
                [email],
                fail_silently=False,
            )
            messages.success(request, "O'quvchi qo'shildi va ma'lumotlar emailga yuborildi!")
        except Exception as e:
            messages.warning(request, f"O'quvchi saqlandi, lekin xat yuborishda xatolik: {e}")
        messages.success(request, "O'quvchi muvaffaqiyatli qo'shildi!")

    return redirect(reverse('admin_dashboard') + '?section=users')
#===================================================================================================================

#===================================================================================================================

def student_dashboard(request):
    # 1. FOYDALANUVCHINI ANIQLASH
    student_id = request.session.get('student_id')
    if not student_id:
        return redirect('student_login')

    student = Student.objects.filter(id=student_id).first()

    # 2. BLOKLANGANINI TEKSHIRISH
    if not student or not student.is_active:
        request.session.flush()
        messages.error(request, "Sizning hisobingiz bloklandi!")
        return redirect('student_login')

    # 3. FANLAR RO'YXATI (Dropdown uchun)
    all_other_subjects = ["Matematika", "Fizika", "Ona-tili", "Ingliz tili", "Geografiya", "Tarix", "Rus tili"]

    # 4. FANLARNI SAQLASH VA O'CHIRISH (POST)
    if request.method == "POST":
        if 'save_optional' in request.POST:
            s1 = request.POST.get('subject1')
            s2 = request.POST.get('subject2')
            current = list(student.optional_subjects) if student.optional_subjects else []
            new_subjects = [s for s in [s1, s2] if s]
            student.optional_subjects = list(set(current + new_subjects))[:2]
            student.save()
            return redirect('student_dashboard')
        elif 'delete_optional' in request.POST:
            sub_to_del = request.POST.get('subject_to_delete')
            if student.optional_subjects and sub_to_del in student.optional_subjects:
                student.optional_subjects = [s for s in student.optional_subjects if s != sub_to_del]
                student.save()
            return redirect('student_dashboard')

    # 5. TESTLARNI FILTRLASH (Asosiy + Ixtiyoriy fanlar)
    all_selected_subjects = [student.subject]  # Masalan: Matematika
    if student.optional_subjects:
        all_selected_subjects.extend(student.optional_subjects)  # Masalan: + Ingliz tili, Geografiya

    available_tests = TestMaterial.objects.filter(
        subject__in=all_selected_subjects,
        grade=student.grade
    )

    # 6. SOZLAMALARNI OLISH
    settings = SystemSettings.objects.filter(id=1).first()
    duration_min = settings.test_duration if settings else 60

    # 7. HAR BIR TEST UCHUN STATUS VA VAQTNI HISOBLASH (DINAMIK)
    now = timezone.localtime(timezone.now())

    for test in available_tests:
        # Test topshirilganini tekshirish
        test.is_already_done = TestResult.objects.filter(
            first_name=student.first_name,
            last_name=student.last_name,
            subject__iexact=test.subject
        ).exists()

        # VAQTNI ANIQLASH LOGIKASI:
        # Agar bu test sening asosiy faning bo'lsa, sening qatoringdagi vaqtni oladi.
        # Agar bu ixtiyoriy fan bo'lsa, bazadagi shu fanni asosiy fan sifatida o'qiydigan
        # boshqa foydalanuvchining (masalan Ilhombek yoki Abror) vaqtini oladi.

        subject_record = Student.objects.filter(
            subject__iexact=test.subject,
            grade=student.grade
        ).first()

        if subject_record:
            test_time = subject_record.exam_time  # Ilhombekning Ingliz tili vaqti (16:20) kabi
            test_date = subject_record.exam_date
        else:
            test_time = student.exam_time
            test_date = student.exam_date

        # HTML-da ko'rsatish uchun obyektga yuklaymiz
        test.display_time = test_time  # assigned_time edi
        test.display_date = test_date

        # Statusni aniqlash
        if test_time and test_date:
            start_dt = timezone.make_aware(datetime.combine(test_date, test_time))
            end_dt = start_dt + timedelta(minutes=60)     #duration_min)

            if now < start_dt:
                test.status = "waiting"
            elif start_dt <= now <= end_dt:
                test.status = "active"
            else:
                test.status = "expired"
        else:
            test.status = "waiting"

    # 8. STATISTIKA VA REYTING (Mavjud logikangiz)
    results = TestResult.objects.filter(first_name=student.first_name, last_name=student.last_name).order_by(
        '-date_taken')[:3]
    completed_count = TestResult.objects.filter(first_name=student.first_name, last_name=student.last_name).count()

    all_results_rank = TestResult.objects.filter(subject__iexact=student.subject, grade=student.grade).order_by(
        '-score_percent', 'date_taken')
    leaderboard = []
    seen = set()
    for res in all_results_rank:
        full_name = f"{res.first_name} {res.last_name}"
        if full_name not in seen:
            leaderboard.append(res)
            seen.add(full_name)

    user_rank = "-"
    for index, res in enumerate(leaderboard):
        if res.first_name == student.first_name and res.last_name == student.last_name:
            user_rank = index + 1
            break

    # 9. CONTEXT YUBORISH
    return render(request, 'html/dashboard.html', {
        'student': student,
        'user_rank': user_rank,
        'available_tests': available_tests,
        'student_results': results,
        'completed_count': completed_count,
        'leaderboard': leaderboard,
        'settings': settings,
        'all_other_subjects': all_other_subjects,
        'main_tests': [t for t in available_tests if t.subject.lower() == student.subject.lower()],  # Majburiy fan
        'optional_tests': [t for t in available_tests if t.subject.lower() != student.subject.lower()],
    })
#======================================================================================================

#======================================================================================================
def get_test_questions(request, test_id):
    test_material = get_object_or_404(TestMaterial, id=test_id)
    is_review = request.GET.get('review') == 'true'

    # 1. Agar tahlil rejimi bo'lsa va sessiyada savollar bo'lsa, o'shani qaytaramiz
    if is_review and 'active_test_questions' in request.session:
        return JsonResponse({
            'status': 'success',
            'questions': request.session['active_test_questions']
        })

    try:
        df = pd.read_excel(test_material.file.path)
        all_questions_pool = []

        # BAZADAN SAVOLLAR SONINI OLAMIZ
        from .models import SystemSettings
        settings = SystemSettings.objects.filter(id=1).first()
        # Agar settings bo'lmasa, standart 25 ta savol olsin
        questions_limit = settings.total_questions if settings else 25

        for index, row in df.iterrows():
            correct_answer = str(row['A (To‘g‘ri)']).strip()
            options = [
                correct_answer,
                str(row['B']).strip(),
                str(row['C']).strip(),
                str(row['D']).strip()
            ]
            # Har bir savol uchun variantlarni aralashtiramiz
            random.shuffle(options)

            all_questions_pool.append({
                'text': str(row['Savol']).strip(),
                'options': options,
                'correct': correct_answer
            })

        # 25 ta tasodifiy savolni tanlaymiz
        random.shuffle(all_questions_pool)
        selected_questions = all_questions_pool[:questions_limit]

        for i, q in enumerate(selected_questions):
            q['id'] = i + 1

        # 2. MUHIM: Tanlangan va aralashtirilgan savollarni sessiyaga saqlaymiz
        request.session['active_test_questions'] = selected_questions
        request.session.modified = True

        return JsonResponse({'status': 'success', 'questions': selected_questions})

    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=500)

#===================================================================================================================

#======================================================================================================================
def upload_test(request):
    if request.method == 'POST':
        subject = request.POST.get('subject_name')
        for grade in [9, 10, 11]:
            file_key = f'file_{grade}'
            file = request.FILES.get(file_key)
            if file:
                TestMaterial.objects.update_or_create(
                    subject=subject,
                    grade=grade,
                    defaults={'file': file}
                )
        return redirect(reverse('admin_dashboard') + '?section=test')

    all_materials = TestMaterial.objects.all()
    status_dict = {}
    for item in all_materials:

        status_dict[f"{item.subject}_{item.grade}"] = True

    json_status = json.dumps(status_dict)

    return render(request, 'html/admin.html', {'json_status': json_status})

#================================================================================================================

#===================================================================================================================
def delete_test_file(request):
    if request.method == 'POST':
        subject = request.POST.get('subject')
        grade = request.POST.get('grade')

        test = TestMaterial.objects.filter(subject=subject, grade=grade).first()

        if test:
            if test.file:
                if os.path.isfile(test.file.path):
                    os.remove(test.file.path)

            test.delete()
            return JsonResponse({'status': 'success'})

    return JsonResponse({'status': 'error'}, status=400)

#===========================================================================================================

#===========================================================================================================
def save_test_result(request):
    if request.method == "POST":
        try:
            data = json.loads(request.body)
            student_id = request.session.get('student_id')

            if not student_id:
                return JsonResponse({"status": "error", "message": "O'quvchi topilmadi"}, status=401)

            student = Student.objects.get(id=student_id)

            # MUHIM: Sessiyadan savollar tartibini olamiz
            # Bu tartib get_test_questions funksiyasida sessiyaga yozilgan bo'lishi kerak
            questions_order = request.session.get('active_test_questions')

            TestResult.objects.create(
                first_name=student.first_name,
                last_name=student.last_name,
                school=student.school,
                grade=student.grade,
                subject=data['subject'],
                correct_count=data['correct'],
                total_questions=data['total'],
                score_percent=data['percent'],
                user_answers=data.get('user_answers'),
                test_material_id=data.get('test_id'),
                # YANGI: Savollar tartibi bazaga muhrlanadi
                questions_order=questions_order
            )

            return JsonResponse({"status": "success", "message": "Natija saqlandi!"})

        except Student.DoesNotExist:
            return JsonResponse({"status": "error", "message": "O'quvchi topilmadi"}, status=404)
        except Exception as e:
            return JsonResponse({"status": "error", "message": str(e)}, status=400)

    return JsonResponse({"status": "error", "message": "Metod xato"}, status=405)
#==============================================================================================================

#==============================================================================================================
def get_result_details(request, result_id):
    # Natijani bazadan ID orqali qidiramiz
    result = get_object_or_404(TestResult, id=result_id)

    # Agar savollar tartibi bazada bo'lsa, o'shani qaytaramiz
    if result.questions_order:
        return JsonResponse({
            'status': 'success',
            'questions': result.questions_order
        })
    else:
        return JsonResponse({
            'status': 'error',
            'message': 'Ushbu natija uchun savollar tartibi topilmadi'
        }, status=404)

#===============================================================================================================

#===============================================================================================================
def admin_settings_view(request):
    # Bazadan birinchi (va yagona) sozlamani olamiz
    settings, created = SystemSettings.objects.get_or_create(id=1)

    if request.method == "POST":
        settings.total_questions = request.POST.get('total_questions')
        settings.test_duration = request.POST.get('test_duration')
        settings.default_points = request.POST.get('default_points')
        settings.save()
        return redirect(reverse('admin_dashboard') + '?section=settings')

    return render(request, 'admin.html', {'settings': settings})
#================================================================================================================

#================================================================================================================
def export_results_excel(request, subject, grade):
    with connection.cursor() as cursor:
        cursor.execute("""
            SELECT last_name, first_name, grade, school, correct_count, total_questions, score_percent 
            FROM olimpiada_testresult 
            WHERE subject = %s AND grade = %s
            ORDER BY score_percent DESC
        """, [subject, grade])
        rows = cursor.fetchall()

    data = [{
        'Reyting': i + 1,
        'Familiya': r[0],
        'Ism': r[1],
        'Sinf': r[2],
        'Maktab': r[3],
        'To\'g\'ri': r[4],
        'Jami': r[5],
        'Ball (%)': f"{r[6]}%"
    } for i, r in enumerate(rows)]

    df = pd.DataFrame(data)
    response = HttpResponse(content_type='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
    response['Content-Disposition'] = f'attachment; filename="{subject}_{grade}_sinf.xlsx"'

    with pd.ExcelWriter(response, engine='openpyxl') as writer:
        df.to_excel(writer, index=False)

    return response
#==============================================================================================================

#==============================================================================================================
def change_admin_password(request):
    if request.method == 'POST':
        user = request.user
        current_pw = request.POST.get('current_password')
        new_pw = request.POST.get('new_password')
        confirm_pw = request.POST.get('confirm_password')


        # 1. Joriy parol to'g'riligini tekshirish
        if not user.check_password(current_pw):
            messages.error(request, "Joriy parol noto'g'ri!")
        elif new_pw != confirm_pw:
            messages.error(request, "Yangi parollar mos kelmadi!")
        else:
            user.set_password(new_pw)
            user.save()
            update_session_auth_hash(request, user)  # Sessiyani saqlash
            messages.success(request, "Parol muvaffaqiyatli yangilandi!")

            # redirect ni o'zgaruvchiga olib qaytaramiz
        target_url = reverse('admin_dashboard') + '?section=settings'
        return redirect(target_url)

    return redirect(reverse('admin_dashboard') + '?section=settings')
#======================================================================================================================

#======================================================================================================================
def export_students_excel(request):
    response = HttpResponse(content_type='application/ms-excel')
    response['Content-Disposition'] = 'attachment; filename="Barcha_oquvchilar.xls"'

    wb = xlwt.Workbook(encoding='utf-8')
    ws = wb.add_sheet('Oquvchilar')

    # Sarlavhalar
    row_num = 0
    font_style = xlwt.XFStyle()
    font_style.font.bold = True
    columns = ['F.I.SH', 'Email', 'Sinf', 'Maktab', 'Fan', 'Sana', 'Vaqt']

    for col_num in range(len(columns)):
        ws.write(row_num, col_num, columns[col_num], font_style)

    # Ma'lumotlar
    font_style = xlwt.XFStyle()
    rows = Student.objects.all().values_list('last_name', 'first_name', 'email', 'grade', 'school', 'subject',
                                             'exam_date', 'exam_time')

    for row in rows:
        row_num += 1
        # Ism va Familiyani birlashtirib yozamiz
        full_name = f"{row[0]} {row[1]}"
        ws.write(row_num, 0, full_name, font_style)
        ws.write(row_num, 1, row[2], font_style)  # Email
        ws.write(row_num, 2, f"{row[3]}-sinf", font_style)
        ws.write(row_num, 3, row[4], font_style)  # Maktab
        ws.write(row_num, 4, row[5], font_style)  # Fan
        ws.write(row_num, 5, str(row[6]), font_style)  # Sana
        ws.write(row_num, 6, str(row[7]), font_style)  # Vaqt

    wb.save(response)
    return response
#======================================================================================================================

#======================================================================================================================
from django.shortcuts import redirect
from django.urls import reverse


def bulk_update_students(request):
    if request.method == 'POST':
        # Belgilangan (checked) o'quvchilar ID ro'yxati
        active_ids = request.POST.getlist('active_students')

        # 1. Hammani nofaol qilish
        Student.objects.all().update(is_active=False)

        # 2. Faqat tanlanganlarni faol qilish
        if active_ids:
            Student.objects.filter(id__in=active_ids).update(is_active=True)

    return redirect(reverse('admin_dashboard') + '?section=users')


from django.http import JsonResponse
from django.views.decorators.csrf import csrf_exempt


def update_profile_photo(request):
    if request.method == 'POST' and request.FILES.get('profile_photo'):
        student_id = request.session.get('student_id')
        if not student_id:
            return JsonResponse({'status': 'error', 'message': 'Tizimga kirmagansiz'}, status=401)

        student = Student.objects.filter(id=student_id).first()
        if student:
            # Eski rasmni o'chirish (ixtiyoriy, joyni tejash uchun)
            if student.photo:
                student.photo.delete(save=False)

            student.photo = request.FILES['profile_photo']
            student.save()
            return JsonResponse({'status': 'success', 'url': student.photo.url})

    return JsonResponse({'status': 'error', 'message': 'Rasm yuklanmadi'}, status=400)

















