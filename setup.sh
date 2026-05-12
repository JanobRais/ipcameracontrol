#!/bin/bash
# Camlive Django backend — birinchi marta ishga tushirish

echo "=== Django migratsiyalari ==="
python manage.py makemigrations cameras
python manage.py migrate

echo ""
echo "=== Tayyor! Server ishga tushirilmoqda ==="
echo "Browser: http://127.0.0.1:8000"
python manage.py runserver
