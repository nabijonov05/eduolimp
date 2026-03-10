"""
URL configuration for mysite project.

The `urlpatterns` list routes URLs to views. For more information please see:
    https://docs.djangoproject.com/en/6.0/topics/http/urls/
Examples:
Function views
    1. Add an import:  from my_app import views
    2. Add a URL to urlpatterns:  path('', views.home, name='home')
Class-based views
    1. Add an import:  from other_app.views import Home
    2. Add a URL to urlpatterns:  path('', Home.as_view(), name='home')
Including another URLconf
    1. Import the include() function: from django.urls import include, path
    2. Add a URL to urlpatterns:  path('blog/', include('blog.urls'))
"""
from django.urls import path
from olimpiada import views
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include

urlpatterns = [
  path('', views.index, name='index'),
  path('admin/', views.admin_login, name='admin_login'),
  path('admin/dashboard/', views.admin_dashboard, name='admin_dashboard'),
  path('login/', views.student_login, name="student_login"),
  path('dashboard/', views.student_dashboard, name="student_dashboard"),
  path('add-student/', views.add_student, name='add_student'),
  path('upload-test/', views.upload_test, name='upload_test'),
  path('delete-test-file/', views.delete_test_file, name='delete_test_file'),
  path('get-questions/<int:test_id>/', views.get_test_questions, name='get_questions'),
  path('get-result-details/<int:result_id>/', views.get_result_details, name='get_result_details'),
  path('save-test-result/', views.save_test_result, name='save_test_result'),
  path('update-settings/', views.admin_settings_view, name='update_settings'),
  path('delete-result/<int:result_id>/', views.delete_test_result, name='delete_test_result'),
  path('export-excel/<str:subject>/<int:grade>/', views.export_results_excel, name='export_excel'),
  path('delete-student/<int:student_id>/', views.delete_student, name='delete_student'),
  path('export-students-excel/', views.export_students_excel, name='export_students_excel'),

  # O'quvchini o'chirish uchun URL (oldingi so'rovingiz uchun)
  path('delete-student/<int:student_id>/', views.delete_student, name='delete_student'),

  path('students/bulk-update/', views.bulk_update_students, name='bulk_update_students'),
  path('update-profile-photo/', views.update_profile_photo, name='update_profile_photo'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
