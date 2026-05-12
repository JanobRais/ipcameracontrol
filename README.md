# Camlive — IP Kamera Monitoring Tizimi

## Talablar

- Python 3.10+
- PostgreSQL
- FFmpeg
- Git

---

## 1. Repozitoriyani klonlash

```bash
git clone https://github.com/JanobRais/ipcameracontrol.git
cd ipcameracontrol
```

---

## 2. Virtual muhit (venv)

### Linux / macOS
```bash
python3 -m venv venv
source venv/bin/activate
```

### Windows
```cmd
python -m venv venv
venv\Scripts\activate
```

> Aktivlashgandan keyin terminalda `(venv)` ko'rinadi.

---

## 3. Kutubxonalarni o'rnatish

```bash
pip install -r requirements.txt
```

---

## 4. PostgreSQL sozlash

PostgreSQL'da ma'lumotlar bazasi va foydalanuvchi yaratish:

```sql
CREATE DATABASE camera;
CREATE USER camera WITH PASSWORD 'cameraA';
GRANT ALL PRIVILEGES ON DATABASE camera TO camera;
```

> `psql -U postgres` orqali kirib yuqoridagi buyruqlarni bajaring.

---

## 5. Migratsiyalar

```bash
python manage.py makemigrations
python manage.py migrate
```

---

## 6. Admin foydalanuvchi yaratish

```bash
python manage.py shell -c "
from django.contrib.auth import get_user_model
User = get_user_model()
if not User.objects.filter(username='admin').exists():
    User.objects.create_superuser('admin', '', '12345')
    print('admin:12345 yaratildi')
else:
    print('admin allaqachon mavjud')
"
```

---

## 7. Serverni ishga tushirish

```bash
python manage.py runserver
```

Brauzerda oching:

| URL | Vazifa |
|-----|--------|
| `http://127.0.0.1:8000/` | Jonli efir (hamma uchun) |
| `http://127.0.0.1:8000/admin/` | Boshqaruv paneli (login kerak) |

**Login:** `admin` / `12345`

---

## 8. Muhitdan chiqish

```bash
deactivate
```

---

## FFmpeg tekshirish

```bash
ffmpeg -version
```

Agar yo'q bo'lsa:
```bash
# Ubuntu/Debian
sudo apt install ffmpeg

# CentOS/RHEL
sudo dnf install ffmpeg
```

---

## Kamera qo'shish (admin panel orqali)

1. `http://127.0.0.1:8000/admin/` ga kiring
2. **Yangi kamera** tugmasini bosing
3. IP, port, login, parol kiriting
4. **Start** tugmasi bilan streamni boshlang

FFmpeg quyidagi formatda ishga tushadi:
```
ffmpeg -i rtsp://login:parol@IP:port -vsync 0 -copyts -vcodec copy \
  -hls_time 10 -hls_list_size 10 -hls_wrap 30 stream.m3u8
```
