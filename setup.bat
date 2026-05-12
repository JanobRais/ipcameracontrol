@echo off
echo === Django migratsiyalari ===
python manage.py makemigrations cameras
python manage.py migrate

echo.
echo === Admin foydalanuvchi (admin / 12345) ===
python manage.py shell -c "from django.contrib.auth import get_user_model; U=get_user_model(); U.objects.filter(username='admin').exists() or U.objects.create_superuser('admin','','12345'); print('OK')"

echo.
echo === Server ishga tushirilmoqda: http://127.0.0.1:8000 ===
python manage.py runserver
