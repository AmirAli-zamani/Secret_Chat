from django.contrib import admin
from django.contrib.auth.admin import UserAdmin as BaseUserAdmin
from django.contrib.auth.models import User, Group
from django.utils.html import format_html
from django.template.response import TemplateResponse
from django.urls import path
from django.db.models import Q, Count, Max

from .models import Plant, AdminPattern, ChatUser, ChatMessage
from .forms import AdminPatternForm


# ============================================================
#                       PLANT ADMIN
# ============================================================

@admin.register(Plant)
class PlantAdmin(admin.ModelAdmin):
    list_display = ('thumb', 'name', 'scientific_name', 'difficulty_badge',
                    'is_featured', 'created_at')
    list_display_links = ('name',)
    list_filter = ('is_featured', 'difficulty')
    search_fields = ('name', 'scientific_name', 'description')
    list_editable = ('is_featured',)
    list_per_page = 20
    readonly_fields = ('created_at', 'image_preview')
    date_hierarchy = 'created_at'
    save_on_top = True

    fieldsets = (
        ('📋 اطلاعات اصلی', {
            'fields': ('name', 'scientific_name', 'slug',
                       'short_description', 'description')
        }),
        ('🖼️ تصویر', {
            'fields': ('image', 'image_preview')
        }),
        ('🌱 شرایط نگهداری', {
            'fields': ('light', 'water', 'temperature', 'soil', 'difficulty')
        }),
        ('⚙️ تنظیمات', {
            'fields': ('is_featured', 'created_at')
        }),
    )

    @admin.display(description='تصویر')
    def thumb(self, obj):
        if obj.image:
            return format_html(
                '<img src="{}" class="gp-thumb" />', obj.image.url
            )
        return format_html('<div class="gp-thumb gp-thumb-empty">🌿</div>')

    @admin.display(description='پیش‌نمایش')
    def image_preview(self, obj):
        if obj and obj.image:
            return format_html(
                '<img src="{}" class="gp-preview-img" />', obj.image.url
            )
        return '—'

    @admin.display(description='سطح نگهداری', ordering='difficulty')
    def difficulty_badge(self, obj):
        colors = {'آسان': 'green', 'متوسط': 'orange', 'سخت': 'red'}
        color = colors.get(obj.difficulty, 'gray')
        return format_html(
            '<span class="gp-badge gp-badge-{}">{}</span>',
            color, obj.difficulty or '—'
        )


# ============================================================
#                    ADMIN PATTERN INLINE
# ============================================================

class AdminPatternInline(admin.StackedInline):
    model = AdminPattern
    form = AdminPatternForm
    can_delete = False
    max_num = 1
    extra = 1
    verbose_name = 'الگوی امنیتی این ادمین'
    verbose_name_plural = '🔐 الگوی امنیتی شخصی'
    fields = ('pattern',)


# ============================================================
#                       USER ADMIN
# ============================================================

class UserAdmin(BaseUserAdmin):
    inlines = (AdminPatternInline,)
    list_display = ('username', 'email', 'full_name_display',
                    'role_badge', 'pattern_mini', 'last_login')
    list_filter = ('is_staff', 'is_superuser', 'is_active')
    search_fields = ('username', 'email', 'first_name', 'last_name')
    ordering = ('-is_superuser', '-is_staff', 'username')
    list_per_page = 25

    fieldsets = (
        ('🔑 اطلاعات ورود', {
            'fields': ('username', 'password')
        }),
        ('👤 اطلاعات شخصی', {
            'fields': ('first_name', 'last_name', 'email')
        }),
        ('🛡️ دسترسی‌ها', {
            'fields': ('is_active', 'is_staff', 'is_superuser'),
            'description': 'تیک «ادمین» یعنی کاربر می‌تواند وارد پنل شود. '
                           'تیک «مدیر کل» یعنی دسترسی کامل به همه چیز.'
        }),
        ('📅 تاریخ‌های مهم', {
            'fields': ('last_login', 'date_joined'),
            'classes': ('collapse',)
        }),
    )

    add_fieldsets = (
        ('🆕 ساخت کاربر جدید', {
            'classes': ('wide',),
            'fields': ('username', 'password1', 'password2'),
        }),
        ('🛡️ دسترسی‌ها', {
            'classes': ('wide',),
            'fields': ('is_staff', 'is_superuser', 'is_active'),
            'description': 'برای اینکه کاربر بتواند وارد پنل ادمین شود، '
                           'حداقل باید «ادمین» باشد.'
        }),
    )

    @admin.display(description='نام کامل')
    def full_name_display(self, obj):
        full = f'{obj.first_name} {obj.last_name}'.strip()
        return full or '—'

    @admin.display(description='نقش', ordering='is_superuser')
    def role_badge(self, obj):
        if obj.is_superuser:
            return format_html('<span class="gp-badge gp-badge-purple">👑 مدیر کل</span>')
        if obj.is_staff:
            return format_html('<span class="gp-badge gp-badge-blue">🛡️ ادمین</span>')
        return format_html('<span class="gp-badge gp-badge-gray">کاربر عادی</span>')

    @admin.display(description='الگوی امنیتی')
    def pattern_mini(self, obj):
        try:
            ap = obj.admin_pattern
        except AdminPattern.DoesNotExist:
            return format_html('<span class="gp-muted">—</span>')
        nums = ap.get_pattern_set()
        if not nums:
            return format_html('<span class="gp-muted">—</span>')
        chips = ''.join(f'<b>{n}</b>' for n in sorted(nums))
        return format_html('<span class="gp-pattern-mini">{}</span>', chips)


# جایگزینی UserAdmin
admin.site.unregister(User)
admin.site.register(User, UserAdmin)


# ============================================================
#                  ADMIN PATTERN STANDALONE
# ============================================================

@admin.register(AdminPattern)
class AdminPatternAdmin(admin.ModelAdmin):
    form = AdminPatternForm
    list_display = ('user', 'pattern_pretty', 'updated_at')
    readonly_fields = ('updated_at',)
    list_per_page = 25

    fieldsets = (
        ('اطلاعات', {
            'fields': ('user', 'pattern', 'updated_at'),
            'description': 'الگوی امنیتی این ادمین را از روی ایموجی‌ها انتخاب کن.'
        }),
    )

    def get_queryset(self, request):
        qs = super().get_queryset(request)
        if request.user.is_superuser:
            return qs
        return qs.filter(user=request.user)

    def has_add_permission(self, request):
        if request.user.is_superuser:
            return True
        return not AdminPattern.objects.filter(user=request.user).exists()

    def has_change_permission(self, request, obj=None):
        if obj is None:
            return True
        return request.user.is_superuser or obj.user == request.user

    def has_delete_permission(self, request, obj=None):
        return request.user.is_superuser

    def save_model(self, request, obj, form, change):
        if not change and not request.user.is_superuser:
            obj.user = request.user
        super().save_model(request, obj, form, change)

    def formfield_for_foreignkey(self, db_field, request, **kwargs):
        if db_field.name == 'user' and not request.user.is_superuser:
            kwargs['queryset'] = User.objects.filter(pk=request.user.pk)
        return super().formfield_for_foreignkey(db_field, request, **kwargs)

    @admin.display(description='الگوی امنیتی')
    def pattern_pretty(self, obj):
        nums = obj.get_pattern_set()
        if not nums:
            return '—'
        chips = ''.join(f'<b>{n}</b>' for n in sorted(nums))
        return format_html('<span class="gp-pattern-mini">{}</span>', chips)


# ============================================================
#                       BRANDING
# ============================================================

admin.site.site_header = '🌿 گلبو'
admin.site.site_title = 'پنل مدیریت گلبو'
admin.site.index_title = 'داشبورد مدیریت'


# ============================================================
#                       GROUPS
# ============================================================
# اگه نمی‌خوای بخش «گروه‌ها» رو ببینی، خط زیر رو از کامنت خارج کن:
# admin.site.unregister(Group)


# ============================================================
#                       CHAT ADMIN
# ============================================================

@admin.register(ChatUser)
class ChatUserAdmin(admin.ModelAdmin):
    list_display = ('username', 'online_icon', 'msg_count', 'created_at', 'last_seen')
    search_fields = ('username',)
    readonly_fields = ('created_at', 'last_seen')
    list_per_page = 30

    @admin.display(description='وضعیت')
    def online_icon(self, obj):
        if obj.is_online:
            return format_html(
                '<span class="gp-badge gp-badge-green">{} {}</span>',
                '🟢', 'آنلاین'
            )
        return format_html(
            '<span class="gp-badge gp-badge-gray">{} {}</span>',
            '⚪', 'آفلاین'
        )

    @admin.display(description='تعداد پیام')
    def msg_count(self, obj):
        return obj.sent.count() + obj.received.count()


# ============================================================
#                    CHAT MESSAGE ADMIN
# ============================================================

@admin.register(ChatMessage)
class ChatMessageAdmin(admin.ModelAdmin):
    list_display = ('sender', 'receiver', 'msg_type', 'short_content', 'is_read', 'created_at')
    list_filter = ('msg_type', 'is_read', 'created_at')
    search_fields = ('sender__username', 'receiver__username', 'content')
    readonly_fields = ('created_at',)
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False  # پیام‌ها فقط از چت واقعی میان

    def changelist_view(self, request, extra_context=None):
        # اگه کاربر فیلتر sender/receiver داده (از صفحه‌ی جزئیات)، لیست پیام‌ها رو نشون بده
        if request.GET.get('all') == '1' or request.GET.get('sender__id__exact') or request.GET.get('receiver__id__exact'):
            return super().changelist_view(request, extra_context)
        return self.conversations_view(request)

    def conversations_view(self, request):
        """لیست گفتگوها — هر جفت کاربر که با هم چت کردن."""
        rows = (ChatMessage.objects
                .values('sender', 'receiver')
                .annotate(last_id=Max('id'), total=Count('id'))
                .order_by('-last_id'))

        seen = set()
        pairs = []
        for row in rows:
            s, r = row['sender'], row['receiver']
            key = tuple(sorted([s, r]))
            if key in seen:
                continue
            seen.add(key)
            last = (ChatMessage.objects
                    .select_related('sender', 'receiver')
                    .get(pk=row['last_id']))
            total = (ChatMessage.objects
                     .filter(Q(sender_id=s, receiver_id=r) | Q(sender_id=r, receiver_id=s))
                     .count())
            pairs.append({
                'user1': last.sender,
                'user2': last.receiver,
                'last': last,
                'total': total,
            })

        context = {
            **self.admin_site.each_context(request),
            'title': 'گفتگوها',
            'pairs': pairs,
            'opts': self.model._meta,
            'app_label': self.model._meta.app_label,
        }
        return TemplateResponse(request, 'admin/plants/chat_conversations.html', context)

    def get_urls(self):
        urls = super().get_urls()
        custom = [
            path('conversation/<int:user1>/<int:user2>/',
                 self.admin_site.admin_view(self.conversation_detail),
                 name='plants_chatmessage_conversation'),
        ]
        return custom + urls

    def conversation_detail(self, request, user1, user2):
        """نمایش پیام‌های بین دو کاربر."""
        try:
            u1 = ChatUser.objects.get(pk=user1)
            u2 = ChatUser.objects.get(pk=user2)
        except ChatUser.DoesNotExist:
            from django.http import Http404
            raise Http404

        msgs = (ChatMessage.objects
                .filter(Q(sender_id=user1, receiver_id=user2) |
                        Q(sender_id=user2, receiver_id=user1))
                .select_related('sender', 'receiver')
                .order_by('created_at'))

        context = {
            **self.admin_site.each_context(request),
            'title': f'گفتگو: {u1.username} ↔ {u2.username}',
            'messages': msgs,
            'user1': u1,
            'user2': u2,
            'opts': self.model._meta,
            'app_label': self.model._meta.app_label,
        }
        return TemplateResponse(request, 'admin/plants/chat_detail.html', context)

    @admin.display(description='متن')
    def short_content(self, obj):
        if obj.content:
            return obj.content[:60]
        return f'[{obj.get_msg_type_display()}]'
