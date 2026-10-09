# 🌿 گلبو — Secret_Chat

سایت معرفی گل و گیاه + چت آنلاین سبک تلگرام

ساخته‌شده با Django + Docker + HTML/CSS/JS خالص

---

## ✨ امکانات

- 🌱 دیتابیس گیاهان — ۲۰ گیاه با اطلاعات علمی کامل
- 💬 چت آنلاین — متن، عکس، ویدیو، ریپلای، typing indicator
- 🎨 ۸ تم رنگی + بک‌گراند سفارشی
- 🔐 قفل الگوی امنیتی — ۹ دکمه ایموجی
- 📖 صفحه راهنما داخل سایت
- 📱 ریسپانسیو — موبایل، تبلت، دسکتاپ

---

## 🛠 تکنولوژی‌ها

| بخش | تکنولوژی |
|---|---|
| Backend | Python 3.14 + Django 6.1 |
| Database | SQLite (dev) |
| Container | Docker + docker-compose |
| Frontend | HTML5 + CSS3 + Vanilla JS |
| Font | Vazirmatn (لوکال) |

---

## 🚀 نصب و اجرا

### پیش‌نیازها

- Docker
- Docker Compose
- Git

### مراحل

1. کلون پروژه:

   git clone https://github.com/AmirAli-zamani/Secret_Chat.git
   cd Secret_Chat

2. اجرا:

   docker compose up --build -d

3. باز کردن مرورگر:

   http://localhost:5050

---

## 🔑 حساب ادمین پیش‌فرض

پروژه یه سوپر یوزر پیش‌فرض داره:

| نقش | نام کاربری | پسورد |
|---|---|---|
| مدیر کل | admin | admin |

ورود به پنل ادمین: http://localhost:5050/admin/

الگوی امنیتی پیش‌فرض (برای ورود به چت): روی ایموجی‌های شماره ۱، ۵، ۹ کلیک کن.

---

## 🚨 هشدار امنیتی — لطفا حتما بخون

این حساب پیش‌فرض فقط برای شروع سریع است.
قبل از اینکه پروژه رو روی سرور عمومی بذاری، حتما یکی از این کارها رو بکن:

### روش ۱ — تغییر پسورد (سریع)

   docker compose exec web python manage.py changepassword admin

### روش ۲ — ساخت یوزر جدید و حذف admin

   docker compose exec web python manage.py createsuperuser

   docker compose exec web python manage.py shell -c "from django.contrib.auth.models import User; User.objects.filter(username='admin').delete()"

### روش ۳ — غیرفعال کردن admin

   docker compose exec web python manage.py shell -c "from django.contrib.auth.models import User; u=User.objects.get(username='admin'); u.is_active=False; u.set_unusable_password(); u.save()"

---

## 📋 چک‌لیست امنیتی قبل از production

- [ ] پسورد admin رو عوض کردی
- [ ] یا یوزر admin رو حذف کردی
- [ ] DEBUG = False توی config/settings.py
- [ ] ALLOWED_HOSTS به دامنه خودت محدود شد
- [ ] SECRET_KEY جدید ساختی
- [ ] HTTPS فعاله
- [ ] بکاپ منظم از دیتابیس داری

---

## 📖 راهنمای استفاده

### کاربر عادی

ورود به چت:

1. برو به صفحه اصلی
2. الگوی امنیتی رو روی ایموجی‌ها وارد کن
3. روی «ثبت نظرات» کلیک کن

ثبت‌نام:

- تب «ثبت‌نام» رو انتخاب کن
- نام کاربری + پسورد + کلید امنیتی

شروع چت:

- کادر جست‌وجو → نام کاربری طرف مقابل
- یا از لیست چت‌ها انتخاب کن

ریپلای پیام:

- راست‌کلیک (دسکتاپ)
- Long-press (موبایل)
- Swipe روی پیام
- Double-tap

تغییر تم:

- روی ⚙️ بالای صفحه چت بزن
- از ۸ تم انتخاب کن
- یا بک‌گراند سفارشی آپلود کن

### مدیر سایت

دسترسی: http://localhost:5050/admin

کارها:

- افزودن گیاه جدید
- تنظیم الگوی امنیتی هر ادمین
- مدیریت کاربران
- مشاهده گفتگوها

---

## 📂 ساختار پروژه
Secret_Chat/
├── config/ تنظیمات جنگو
├── plants/ اپ اصلی
├── static/ فایل‌های استاتیک
├── templates/ قالب‌های HTML
├── media/ فایل‌های آپلودی
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
└── README.md


---

## 🔌 API Endpoints

| مسیر | متد | توضیح |
|---|---|---|
| / | GET | لندینگ |
| /plants/ | GET | لیست گیاهان |
| /guide/ | GET | راهنما |
| /api/check-pattern/ | POST | بررسی الگو |
| /auth/ | GET | ورود/ثبت‌نام |
| /auth/login/ | POST | ورود |
| /auth/signup/ | POST | ثبت‌نام |
| /welcome/ | GET | لیست چت‌ها |
| /welcome/chat/<user>/ | GET | صفحه چت |
| /welcome/api/send/<user>/ | POST | ارسال پیام |
| /welcome/api/fetch/<user>/ | GET | دریافت پیام‌ها |
| /welcome/api/typing/<user>/ | POST | در حال تایپ |
| /welcome/api/settings/ | GET/POST | تنظیمات |

---

## 🐛 رفع مشکلات رایج

پورت 5050 اشغاله:

   sudo lsof -i :5050

Permission denied روی media:

   sudo chown -R $USER:$USER ~/Secret_Chat
   docker compose restart web

دیتابیس read-only:

   sudo chown -R $USER:$USER ~/Secret_Chat
   docker compose restart web

---

## 📝 مجوز

MIT — ببین فایل LICENSE

---

## 👤 سازنده

AmirAli Zamani

- GitHub: @AmirAli-zamani
- Email: amiralizamani3902@gmail.com

---

🌿 گلبو — ساخته شده با ❤️ در ایران
