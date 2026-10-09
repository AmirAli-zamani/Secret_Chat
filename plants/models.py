from django.db import models
from django.urls import reverse
from django.utils.text import slugify


class Plant(models.Model):
    name = models.CharField('نام', max_length=100)
    scientific_name = models.CharField('نام علمی', max_length=150, blank=True)
    slug = models.SlugField('اسلاگ', unique=True, blank=True, allow_unicode=True)
    short_description = models.CharField('توضیح کوتاه', max_length=250)
    description = models.TextField('توضیحات کامل')
    image = models.ImageField('تصویر', upload_to='plants/', blank=True, null=True)
    light = models.CharField('نور', max_length=150, blank=True)
    water = models.CharField('آبیاری', max_length=150, blank=True)
    temperature = models.CharField('دما', max_length=150, blank=True)
    soil = models.CharField('خاک', max_length=150, blank=True)
    difficulty = models.CharField('سطح نگهداری', max_length=50, blank=True)
    is_featured = models.BooleanField('ویژه', default=False)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['name']
        verbose_name = 'گیاه'
        verbose_name_plural = 'گیاهان'

    def save(self, *args, **kwargs):
        if not self.slug:
            base = slugify(self.name, allow_unicode=True) or 'plant'
            slug = base
            i = 2
            while Plant.objects.filter(slug=slug).exclude(pk=self.pk).exists():
                slug = f'{base}-{i}'
                i += 1
            self.slug = slug
        super().save(*args, **kwargs)

    def get_absolute_url(self):
        return reverse('plants:detail', args=[self.slug])

    def __str__(self):
        return self.name


from django.contrib.auth.models import User


class AdminPattern(models.Model):
    user = models.OneToOneField(
        User, on_delete=models.CASCADE,
        related_name='admin_pattern',
        verbose_name='کاربر ادمین',
    )
    pattern = models.CharField(
        'الگوی امنیتی',
        max_length=100,
        default='1,5,9',
        help_text='شماره‌ی دکمه‌های درست، جدا شده با کاما. مثال: 1,5,9 (بین ۲ تا ۹ دکمه)',
    )
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'الگوی امنیتی ادمین'
        verbose_name_plural = 'الگوهای امنیتی ادمین‌ها'

    def get_pattern_set(self):
        s = set()
        for x in self.pattern.split(','):
            x = x.strip()
            if x.isdigit():
                n = int(x)
                if 1 <= n <= 9:
                    s.add(n)
        return s

    def clean(self):
        from django.core.exceptions import ValidationError
        super().clean()
        p = self.get_pattern_set()
        if len(p) < 2:
            raise ValidationError({'pattern': 'الگو باید حداقل ۲ دکمه داشته باشد.'})
        if len(p) > 9:
            raise ValidationError({'pattern': 'الگو نمی‌تواند بیشتر از ۹ دکمه باشد.'})

    def __str__(self):
        return f'{self.user.username} → {self.pattern}'


class ChatUser(models.Model):
    """کاربر چت با نام کاربری و پسورد."""
    THEME_CHOICES = (
        ('forest', '🌿 جنگل'),
        ('midnight', '🌌 نیمه‌شب'),
        ('sakura', '🌸 ساکورا'),
        ('twilight', '🌙 شفق'),
        ('sunset', '🌅 غروب'),
        ('coffee', '☕ قهوه'),
        ('arctic', '🧊 یخچال'),
        ('night', '🖤 شبانه'),
    )

    username = models.CharField('نام کاربری', max_length=30, unique=True)
    password = models.CharField('پسورد', max_length=100, blank=True,
                                help_text='پسورد به‌صورت متن ساده ذخیره می‌شود (پروژه‌ی شخصی)')
    security_key = models.CharField('کلید امنیتی (فراموشی رمز)', max_length=100, blank=True,
                                    help_text='اگر پسوردت را فراموش کردی، با این کلید می‌توانی پسورد جدید بسازی')
    theme = models.CharField('تم', max_length=20, choices=THEME_CHOICES, default='forest')
    last_typing = models.DateTimeField('آخرین تایپ', null=True, blank=True)
    custom_bg = models.ImageField('بکگراند سفارشی', upload_to='chat_bg/', blank=True, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    last_seen = models.DateTimeField(auto_now=True)

    class Meta:
        verbose_name = 'کاربر چت'
        verbose_name_plural = 'کاربران چت'
        ordering = ['username']

    def __str__(self):
        return self.username

    @property
    def is_online(self):
        from django.utils import timezone
        from datetime import timedelta
        return (timezone.now() - self.last_seen) < timedelta(seconds=60)


class ChatMessage(models.Model):
    TYPE_CHOICES = (
        ('text', 'متن'),
        ('image', 'تصویر'),
        ('video', 'ویدیو'),
    )

    sender = models.ForeignKey(ChatUser, on_delete=models.CASCADE, related_name='sent')
    receiver = models.ForeignKey(ChatUser, on_delete=models.CASCADE, related_name='received')
    msg_type = models.CharField('نوع', max_length=10, choices=TYPE_CHOICES, default='text')
    content = models.TextField('متن', blank=True)
    file = models.FileField('فایل', upload_to='chat/%Y/%m/', blank=True, null=True)
    is_read = models.BooleanField('خوانده‌شده', default=False)
    reply_to = models.ForeignKey(
        'self', on_delete=models.SET_NULL,
        null=True, blank=True, related_name='replies',
        verbose_name='در پاسخ به'
    )
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        verbose_name = 'پیام چت'
        verbose_name_plural = 'پیام‌های چت'
        ordering = ['created_at']
        indexes = [
            models.Index(fields=['sender', 'receiver', 'created_at']),
            models.Index(fields=['receiver', 'is_read']),
        ]

    def __str__(self):
        return f'{self.sender} → {self.receiver}: {self.content[:30]}'
