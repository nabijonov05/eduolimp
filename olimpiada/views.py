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

            # --- BLOKLASH: Imtihon boshlanganmi? ---
            sub_record = Student.objects.filter(
                subject__iexact=sub_to_del,
                grade=student.grade
            ).first()
            can_delete = True
            if sub_record and sub_record.exam_date and sub_record.exam_time:
                start_dt = timezone.make_aware(
                    datetime.combine(sub_record.exam_date, sub_record.exam_time)
                )
                if timezone.localtime(timezone.now()) >= start_dt:
                    can_delete = False

            if can_delete and student.optional_subjects and sub_to_del in student.optional_subjects:
                student.optional_subjects = [s for s in student.optional_subjects if s != sub_to_del]
                student.save()
            return redirect('student_dashboard')

    # 5. TESTLARNI FILTRLASH
    all_selected_subjects = [student.subject]
    if student.optional_subjects:
        all_selected_subjects.extend(student.optional_subjects)

    available_tests = TestMaterial.objects.filter(
        subject__in=all_selected_subjects,
        grade=student.grade
    )

    # 6. SOZLAMALARNI OLISH
    settings = SystemSettings.objects.filter(id=1).first()
    duration_min = settings.test_duration if settings else 60

    # 7. VAQTNI OLISH
    now = timezone.localtime(timezone.now())

    # 8. ASOSIY FAN TOPSHIRILGAN YOKI MUDDATI O'TGANINI TEKSHIRISH
    main_subject_done = TestResult.objects.filter(
        first_name=student.first_name,
        last_name=student.last_name,
        subject__iexact=student.subject
    ).exists()

    # Asosiy fanning vaqti o'tib ketganmi?
    main_subject_expired = False
    main_record = Student.objects.filter(
        subject__iexact=student.subject,
        grade=student.grade
    ).first()

    if main_record and main_record.exam_date and main_record.exam_time:
        main_start = timezone.make_aware(
            datetime.combine(main_record.exam_date, main_record.exam_time)
        )
        main_end = main_start + timedelta(minutes=duration_min)
        main_subject_expired = now > main_end

    # Ixtiyoriy fanlar ochilish sharti: topshirilgan YOKI muddati o'tgan
    main_test_unlocked = main_subject_done or main_subject_expired

    # 9. HAR BIR TEST UCHUN STATUS, VAQT VA UNLOCK
    for test in available_tests:
        # Test topshirilganini tekshirish
        test.is_already_done = TestResult.objects.filter(
            first_name=student.first_name,
            last_name=student.last_name,
            subject__iexact=test.subject
        ).exists()

        # Unlock holati
        if test.subject.lower() == student.subject.lower():
            test.unlocked = True  # Asosiy fan har doim ochiq
        else:
            test.unlocked = main_test_unlocked  # Ixtiyoriy fan

        # Vaqtni aniqlash
        subject_record = Student.objects.filter(
            subject__iexact=test.subject,
            grade=student.grade
        ).first()

        if subject_record:
            test_time = subject_record.exam_time
            test_date = subject_record.exam_date
        else:
            test_time = student.exam_time
            test_date = student.exam_date

        test.display_time = test_time
        test.display_date = test_date

        # Statusni aniqlash
        if test_time and test_date:
            start_dt = timezone.make_aware(datetime.combine(test_date, test_time))
            end_dt = start_dt + timedelta(minutes=duration_min)

            if now < start_dt:
                test.status = "waiting"
            elif start_dt <= now <= end_dt:
                test.status = "active"
            else:
                test.status = "expired"
        else:
            test.status = "waiting"

    # 10. STATISTIKA VA REYTING
    all_my_results = TestResult.objects.filter(
        first_name=student.first_name,
        last_name=student.last_name
    ).order_by('-date_taken')

    results = all_my_results  # Barchasi (natijalar tarixida ko'rsatish uchun)
    completed_count = all_my_results.count()

    # O'rtacha ball
    avg = all_my_results.aggregate(Avg('score_percent'))['score_percent__avg']
    average_score = round(avg, 1) if avg else 0

    # Sertifikat olish huquqi bor natijalar soni (80%+)
    cert_count = all_my_results.filter(score_percent__gte=80).count()

    all_results_rank = TestResult.objects.filter(
        subject__iexact=student.subject,
        grade=student.grade
    ).order_by('-score_percent', 'date_taken')

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

    for res in leaderboard:
        student_obj = Student.objects.filter(
            first_name=res.first_name,
            last_name=res.last_name
        ).first()
        res.photo = student_obj.photo if student_obj else None

    # Ixtiyoriy fanlar uchun o'chirish ruxsatini hisoblash
    # now allaqachon yuqorida (7-qadamda) e'lon qilingan
    optional_delete_status = {}  # { 'Ingliz tili': True/False }
    if student.optional_subjects:
        for sub in student.optional_subjects:
            sub_rec = Student.objects.filter(
                subject__iexact=sub,
                grade=student.grade
            ).first()
            if sub_rec and sub_rec.exam_date and sub_rec.exam_time:
                start_dt = timezone.make_aware(
                    datetime.combine(sub_rec.exam_date, sub_rec.exam_time)
                )
                optional_delete_status[sub] = now < start_dt  # True = o'chirish mumkin
            else:
                optional_delete_status[sub] = True  # Vaqt yo'q → ruxsat

    # 11. CONTEXT YUBORISH
    return render(request, 'html/dashboard.html', {
        'student': student,
        'user_rank': user_rank,
        'available_tests': available_tests,
        'student_results': results,
        'completed_count': completed_count,
        'average_score': average_score,
        'cert_count': cert_count,
        'leaderboard': leaderboard,
        'settings': settings,
        'all_other_subjects': all_other_subjects,
        'main_subject_done': main_subject_done,
        'main_subject_expired': main_subject_expired,
        'main_test_unlocked': main_test_unlocked,
        'optional_delete_status': json.dumps({k: v for k, v in optional_delete_status.items()}),
        'main_tests': [t for t in available_tests if t.subject.lower() == student.subject.lower()],
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



#===================================================================================================================
def edit_student(request, student_id):
    """O'quvchi ma'lumotlarini tahrirlash (AJAX)"""
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Faqat POST'}, status=405)

    student = get_object_or_404(Student, id=student_id)
    try:
        data = json.loads(request.body)
        student.first_name  = data.get('first_name',  student.first_name).strip()
        student.last_name   = data.get('last_name',   student.last_name).strip()
        student.middle_name = data.get('middle_name', student.middle_name).strip()
        student.email       = data.get('email',       student.email).strip()
        student.school      = data.get('school',      student.school)
        student.grade       = data.get('grade',       student.grade)
        student.subject     = data.get('subject',     student.subject)
        student.exam_date   = data.get('exam_date',   str(student.exam_date))
        student.exam_time   = data.get('exam_time',   str(student.exam_time))
        student.save()
        return JsonResponse({
            'status': 'success',
            'student': {
                'id':          student.id,
                'first_name':  student.first_name,
                'last_name':   student.last_name,
                'middle_name': student.middle_name,
                'email':       student.email,
                'school':      student.school,
                'grade':       student.grade,
                'subject':     student.subject,
                'exam_date':   str(student.exam_date),
                'exam_time':   str(student.exam_time),
            }
        })
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
#===================================================================================================================

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



#======================================================================================================================

#======================================================================================================================
@login_required(login_url='login')
def admin_update_username(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Metod xato'}, status=405)
    try:
        data = json.loads(request.body)
        new_username = data.get('username', '').strip()
        if not new_username:
            return JsonResponse({'status': 'error', 'message': 'Username bosh bolmasin'})
        from django.contrib.auth.models import User
        if User.objects.filter(username=new_username).exclude(id=request.user.id).exists():
            return JsonResponse({'status': 'error', 'message': 'Bu username band'})
        request.user.username = new_username
        request.user.save()
        return JsonResponse({'status': 'success'})
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
#======================================================================================================================

def change_student_password(request):
    if request.method != 'POST':
        return JsonResponse({'status': 'error', 'message': 'Metod xato'}, status=405)

    student_id = request.session.get('student_id')
    if not student_id:
        return JsonResponse({'status': 'error', 'message': 'Tizimga kirmagansiz'}, status=401)

    try:
        data = json.loads(request.body)
        current_password = data.get('current_password', '').strip()
        new_password     = data.get('new_password', '').strip()

        student = Student.objects.get(id=student_id)

        # Joriy parol tekshirish
        if student.password != current_password:
            return JsonResponse({'status': 'error', 'message': "Joriy parol noto\'g\'ri"})

        # Uzunlik tekshirish
        if len(new_password) < 6:
            return JsonResponse({'status': 'error', 'message': "Parol kamida 6 ta belgidan iborat bo\'lishi kerak"})

        # Saqlash
        student.password = new_password
        student.save()

        return JsonResponse({'status': 'success', 'message': "Parol muvaffaqiyatli o\'zgartirildi!"})

    except Student.DoesNotExist:
        return JsonResponse({'status': 'error', 'message': "O\'quvchi topilmadi"}, status=404)
    except Exception as e:
        return JsonResponse({'status': 'error', 'message': str(e)}, status=400)
#======================================================================================================================

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
#======================================================================================================================
# SERTIFIKAT GENERATSIYA — HTML → PNG (Playwright)
#======================================================================================================================

def generate_certificate(request, result_id):
    """
    index.html stilidagi sertifikatni PNG formatda yuklash.
    Rank 1/2/3 bo'lsa award-place yoziladi.
    Faqat 80%+ uchun ishlaydi.
    """
    from django.http import HttpResponseForbidden, HttpResponseBadRequest
    from playwright.sync_api import sync_playwright
    import re

    # 1. Natijani olish
    result = get_object_or_404(TestResult, id=result_id)

    # 2. Xavfsizlik: faqat o'z sertifikati
    student_id = request.session.get('student_id')
    if student_id:
        student = Student.objects.filter(id=student_id).first()
        if student and (student.first_name != result.first_name or student.last_name != result.last_name):
            return HttpResponseForbidden("Bu sertifikat sizniki emas.")

    # 3. Minimal ball
    if result.score_percent < 80:
        return HttpResponseBadRequest("Sertifikat olish uchun 80% kerak.")

    # 3b. Vaqt tekshiruvi — test muddati tugaganidan keyin sertifikat beriladi
    settings_obj = SystemSettings.objects.filter(id=1).first()
    duration_min  = settings_obj.test_duration if settings_obj else 60
    now = timezone.localtime(timezone.now())

    # Shu fanga tegishli o'quvchi yozuvidan exam_date/exam_time ni olamiz
    cert_student_id = request.session.get('student_id')
    cert_student = Student.objects.filter(id=cert_student_id).first() if cert_student_id else None
    grade = cert_student.grade if cert_student else None

    sub_record = Student.objects.filter(
        subject__iexact=result.subject,
        grade=grade
    ).first() if grade else None

    if sub_record and sub_record.exam_date and sub_record.exam_time:
        start_dt = timezone.make_aware(
            datetime.combine(sub_record.exam_date, sub_record.exam_time)
        )
        end_dt = start_dt + timedelta(minutes=duration_min)
        if now < end_dt:
            remaining = end_dt - now
            mins = int(remaining.total_seconds() // 60)
            secs = int(remaining.total_seconds() % 60)
            return HttpResponseBadRequest(
                f"Sertifikat test muddati tugagandan keyin yuklab olinadi. "
                f"Qolgan vaqt: {mins} daqiqa {secs} soniya."
            )

    # 4. Rank hisoblash
    all_results_rank = TestResult.objects.filter(
        subject__iexact=result.subject
    ).order_by('-score_percent', 'date_taken')

    leaderboard = []
    seen = set()
    for r in all_results_rank:
        name = f"{r.first_name} {r.last_name}"
        if name not in seen:
            leaderboard.append(r)
            seen.add(name)

    user_rank = None
    for i, r in enumerate(leaderboard):
        if r.first_name == result.first_name and r.last_name == result.last_name:
            user_rank = i + 1
            break

    rank_labels = {1: "1-O'rin", 2: "2-O'rin", 3: "3-O'rin"}
    rank_text = rank_labels.get(user_rank, "")

    # 5. Sana formatlash
    date_str = result.date_taken.strftime("%d.%m.%Y") if hasattr(result.date_taken, 'strftime') else str(result.date_taken)
    full_name = f"{result.first_name} {result.last_name}"
    score_val = round(result.score_percent)

    # 6. HTML sertifikat shabloni (index.html stili)
    award_place_html = f'<div class="award-place">{rank_text}</div>' if rank_text else ''

    html = f"""<!DOCTYPE html>
<html lang="uz">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Sertifikat</title>
    <link href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700&family=Great+Vibes&family=Inter:wght@400;700&display=swap" rel="stylesheet">
    <style>
        body {{
            font-family: 'Inter', sans-serif;
            background-color: #2c3e50;
            display: flex;
            align-items: center;
            justify-content: center;
            margin: 0;
            padding: 0;
            width: 960px;
            height: 690px;
        }}
        #certificate-content {{
            width: 900px;
            height: 630px;
            background: #fff;
            padding: 30px;
            position: relative;
            box-shadow: 0 30px 60px rgba(0,0,0,0.3);
            overflow: hidden;
        }}
        #certificate-content::before {{
            content: "EduOlimp EduOlimp EduOlimp";
            position: absolute;
            top: 0; left: 0; width: 100%; height: 100%;
            font-size: 150px;
            font-weight: 900;
            color: rgba(37, 99, 235, 0.03);
            display: flex;
            align-items: center;
            justify-content: center;
            transform: rotate(-30deg);
            z-index: 0;
        }}
        .cert-outer-border {{
            border: 2px solid #d97706;
            height: 100%;
            position: relative;
            z-index: 1;
            padding: 10px;
            box-sizing: border-box;
        }}
        .cert-inner-border {{
            border: 15px solid #1e3a8a;
            height: 100%;
            position: relative;
            box-sizing: border-box;
            background: #fff;
        }}
        .corner-deco {{
            position: absolute;
            width: 80px; height: 80px;
            border-color: #f59e0b;
            border-style: solid;
            z-index: 2;
        }}
        .top-left    {{ top: -5px;    left: -5px;  border-width: 10px 0 0 10px; }}
        .top-right   {{ top: -5px;    right: -5px; border-width: 10px 10px 0 0; }}
        .bottom-left {{ bottom: -5px; left: -5px;  border-width: 0 0 10px 10px; }}
        .bottom-right{{ bottom: -5px; right: -5px; border-width: 0 10px 10px 0; }}
        .cert-body {{
            text-align: center;
            padding: 50px;
            height: 100%;
            box-sizing: border-box;
            display: flex;
            flex-direction: column;
            justify-content: space-between;
            position: relative;
        }}
        .cert-logo {{ font-size: 28px; font-weight: 800; color: #1e3a8a; margin-bottom: 5px; }}
        .cert-logo span {{ color: #f59e0b; }}
        .cert-title {{
            font-family: 'Cinzel', serif;
            font-size: 65px;
            color: #1e3a8a;
            margin: 0;
            letter-spacing: 10px;
            font-weight: 700;
            text-shadow: 2px 2px 4px rgba(0,0,0,0.1);
        }}
        .cert-award-to {{
            font-size: 20px;
            color: #6b7280;
            margin: 15px 0 5px 0;
            text-transform: uppercase;
            letter-spacing: 2px;
        }}
        .cert-user-name {{
            font-family: 'Cinzel', serif;
            font-size: 38px;
            color: #2563eb;
            margin: 0 0 10px 0;
            font-weight: 700;
            border-bottom: 1px solid #eee;
            display: inline-block;
            padding: 0 50px;
        }}
        .award-place {{
            font-family: 'Cinzel', serif;
            font-size: 20px;
            color: #d97706;
            font-weight: 700;
            margin-top: -5px;
            margin-bottom: 10px;
            text-transform: uppercase;
            letter-spacing: 4px;
            position: relative;
        }}
        .award-place::before, .award-place::after {{
            content: "";
            display: inline-block;
            width: 40px;
            height: 2px;
            background: #d97706;
            vertical-align: middle;
            margin: 0 15px;
        }}
        .cert-description {{
            font-size: 17px;
            color: #4b5563;
            line-height: 1.7;
            margin: 0 auto;
            max-width: 85%;
        }}
        .cert-footer {{
            display: flex;
            justify-content: space-between;
            align-items: flex-end;
            margin-top: 20px;
            padding: 0 30px;
            position: relative;
        }}
        .footer-item {{ text-align: center; width: 180px; }}
        .footer-item p {{ margin: 0; font-weight: bold; font-size: 15px; color: #1e3a8a; }}
        .footer-item span {{
            display: block;
            border-top: 1px solid #ccc;
            font-size: 12px;
            margin-top: 8px;
            color: #6b7280;
            text-transform: uppercase;
        }}
        .signature-text {{
            font-family: 'Great Vibes', cursive;
            font-size: 28px;
            color: #1e3a8a;
            margin-bottom: -5px;
        }}
        .stamp-container {{
            position: absolute;
            bottom: -20px;
            left: 50%;
            transform: translateX(-50%);
            width: 80px; height: 80px;
            background: radial-gradient(circle, #f1c40f 0%, #f39c12 100%);
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            font-weight: bold;
            font-size: 11px;
            text-align: center;
            box-shadow: 0 4px 10px rgba(0,0,0,0.2);
            border: 4px solid #fff;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            z-index: 3;
        }}
        .stamp-container::after {{
            content: "★ ★ ★";
            position: absolute;
            bottom: 10px;
            font-size: 8px;
        }}
    </style>
</head>
<body>
    <div id="certificate-content">
        <div class="cert-outer-border">
            <div class="cert-inner-border">
                <div class="corner-deco top-left"></div>
                <div class="corner-deco top-right"></div>
                <div class="corner-deco bottom-left"></div>
                <div class="corner-deco bottom-right"></div>
                <div class="cert-body">
                    <div class="cert-header">
                        <div class="cert-logo">Edu<span>Olimp</span></div>
                        <p style="margin:0; font-size:13px; color:#6b7280; text-transform:uppercase; letter-spacing:1px;">Elektron Olimpiada Tizimi</p>
                    </div>
                    <h1 class="cert-title">SERTIFIKAT</h1>
                    <p class="cert-award-to">Muvaffaqiyatli ishtirok uchun topshiriladi:</p>
                    <h2 class="cert-user-name">{full_name}</h2>
                    {award_place_html}
                    <p class="cert-description">
                        Ushbu hujjat egasi <strong style="color:#1e3a8a;">{result.subject}</strong>
                        fani bo'yicha o'tkazilgan umumrespublika onlayn olimpiadasida faol ishtirok etib,
                        yuqori bilim va ko'nikmalarini namoyish etdi.
                        <strong style="color:#d97706; font-size:20px;">{score_val}%</strong>
                        natija qayd etgani munosabati bilan taqdirlanadi.
                    </p>
                    <div class="cert-footer">
                        <div class="footer-item">
                            <p>{date_str}</p>
                            <span>Sana</span>
                        </div>
                        <div class="stamp-container">
                            Olimpiada<br>G'olibi<br>2026
                        </div>
                        <div class="footer-item">
                            <p class="signature-text">EduOlimp</p>
                            <span>Tashkilotchi Imzosi</span>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>
</body>
</html>"""

    # 7. Playwright orqali PNG generatsiya
    with sync_playwright() as p:
        browser = p.chromium.launch()
        page = browser.new_page(viewport={"width": 960, "height": 690})
        page.set_content(html, wait_until="networkidle")
        # Faqat sertifikat elementini screenshot qilish
        element = page.locator("#certificate-content")
        png_bytes = element.screenshot(type="png")
        browser.close()

    # 8. PNG response
    response = HttpResponse(png_bytes, content_type='image/png')
    safe_name = f"EduOlimp_Sertifikat_{full_name.replace(' ', '_')}_{result.subject}.png"
    response['Content-Disposition'] = f'attachment; filename="{safe_name}"'
    return response

#======================================================================================================================