import json
import re

from django.shortcuts import render, get_object_or_404, redirect
from django.http import JsonResponse
from django.views.decorators.http import require_POST
from django.contrib import messages
from django.db.models import Q
from django.utils import timezone

from .models import Plant, AdminPattern, ChatUser, ChatMessage


# ============================================================
#                       PUBLIC VIEWS
# ============================================================

def landing(request):
    featured = list(Plant.objects.filter(is_featured=True)[:6])
    if not featured:
        featured = list(Plant.objects.all()[:6])
    total = Plant.objects.count()
    return render(request, 'plants/landing.html', {
        'featured': featured,
        'total': total,
    })


def plant_list(request):
    q = request.GET.get('q', '').strip()
    plants = Plant.objects.all()
    if q:
        plants = plants.filter(name__icontains=q)
    return render(request, 'plants/list.html', {'plants': plants, 'q': q})


def plant_detail(request, slug):
    plant = get_object_or_404(Plant, slug=slug)
    related = Plant.objects.exclude(id=plant.id)[:3]
    return render(request, 'plants/detail.html', {'plant': plant, 'related': related})


# ============================================================
#                    PATTERN LOCK
# ============================================================

@require_POST
def check_pattern(request):
    try:
        data = json.loads(request.body)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'bad json'}, status=400)

    sequence = data.get('sequence', [])
    if not isinstance(sequence, list):
        return JsonResponse({'error': 'bad format'}, status=400)

    try:
        user_set = set()
        for x in sequence:
            n = int(x)
            if 1 <= n <= 9:
                user_set.add(n)
    except (ValueError, TypeError):
        return JsonResponse({'error': 'bad values'}, status=400)

    unlocked = False
    if user_set:
        for ap in AdminPattern.objects.all():
            if ap.get_pattern_set() == user_set:
                unlocked = True
                break

    request.session['comment_unlocked'] = unlocked
    return JsonResponse({'unlocked': unlocked})


def comment_form(request):
    if request.session.get('comment_unlocked'):
        return redirect('plants:welcome')
    return render(request, 'plants/comment.html')


@require_POST
def submit_comment(request):
    messages.success(request, 'نظر شما با موفقیت ثبت شد ✅')
    return redirect('plants:landing')


# ============================================================
#                          CHAT
# ============================================================

USERNAME_RE = re.compile(r'^[\w\u0600-\u06FF]{2,30}$')


def _get_current_chat_user(request):
    uid = request.session.get('chat_user_id')
    if not uid:
        return None
    try:
        u = ChatUser.objects.get(pk=uid)
        ChatUser.objects.filter(pk=uid).update(last_seen=timezone.now())
        return u
    except ChatUser.DoesNotExist:
        request.session.pop('chat_user_id', None)
        return None


def _recent_peers(user):
    sent_to = set(ChatMessage.objects.filter(sender=user).values_list('receiver_id', flat=True))
    got_from = set(ChatMessage.objects.filter(receiver=user).values_list('sender_id', flat=True))
    peer_ids = sent_to | got_from
    peers = ChatUser.objects.filter(pk__in=peer_ids)

    result = []
    for p in peers:
        last = ChatMessage.objects.filter(
            Q(sender=user, receiver=p) | Q(sender=p, receiver=user)
        ).order_by('-created_at').first()
        unread = ChatMessage.objects.filter(sender=p, receiver=user, is_read=False).count()
        result.append({'peer': p, 'last': last, 'unread': unread})

    result.sort(key=lambda x: x['last'].created_at if x['last'] else timezone.now(), reverse=True)
    return result


def welcome(request):
    """اگه کاربر لاگینه، لیست چت‌ها؛ وگرنه صفحه‌ی ورود."""
    if not request.session.get('comment_unlocked'):
        return redirect('plants:landing')

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return redirect('plants:chat_auth')

    peers = _recent_peers(chat_user)
    return render(request, 'plants/welcome.html', {
        'chat_user': chat_user,
        'peers': peers,
    })


def chat_auth(request):
    """صفحه‌ی ورود/ثبت‌نام با تب."""
    if not request.session.get('comment_unlocked'):
        return redirect('plants:landing')

    # اگه لاگینه، بره به چت
    if _get_current_chat_user(request):
        return redirect('plants:welcome')

    return render(request, 'plants/chat_auth.html')


@require_POST
def chat_login(request):
    """ورود با نام کاربری و پسورد (clear text)."""
    if not request.session.get('comment_unlocked'):
        return redirect('plants:landing')

    username = request.POST.get('username', '').strip()
    password = request.POST.get('password', '')

    if not username or not password:
        messages.error(request, 'نام کاربری و پسورد رو وارد کن.')
        return redirect('plants:chat_auth')

    user = ChatUser.objects.filter(username__iexact=username).first()

    if not user or user.password != password:
        messages.error(request, 'نام کاربری یا پسورد اشتباهه.')
        return redirect('plants:chat_auth')

    request.session['chat_user_id'] = user.pk
    request.session.set_expiry(3600)
    ChatUser.objects.filter(pk=user.pk).update(last_seen=timezone.now())

    messages.success(request, f'خوش برگشتی {user.username}! 🎉')
    return redirect('plants:welcome')


@require_POST
def chat_signup(request):
    """ثبت‌نام کاربر جدید."""
    if not request.session.get('comment_unlocked'):
        return redirect('plants:landing')

    username = request.POST.get('username', '').strip()
    password = request.POST.get('password', '')
    password2 = request.POST.get('password2', '')
    security_key = request.POST.get('security_key', '').strip()

    if not USERNAME_RE.match(username):
        messages.error(request, 'نام کاربری باید ۲ تا ۳۰ کاراکتر و فقط شامل حروف، اعداد و _ باشد.')
        return redirect('plants:chat_auth')

    if len(password) < 4:
        messages.error(request, 'پسورد باید حداقل ۴ کاراکتر باشه.')
        return redirect('plants:chat_auth')

    if password != password2:
        messages.error(request, 'پسورد و تکرارش یکسان نیستن.')
        return redirect('plants:chat_auth')

    if ChatUser.objects.filter(username__iexact=username).exists():
        messages.error(request, 'این نام کاربری قبلاً گرفته شده. یکی دیگه انتخاب کن یا وارد شو.')
        return redirect('plants:chat_auth')

    user = ChatUser.objects.create(
        username=username,
        password=password,
        security_key=security_key or '',
    )
    request.session['chat_user_id'] = user.pk
    request.session.set_expiry(3600)

    messages.success(request, f'خوش آمدی {username}! 🎉')
    return redirect('plants:welcome')


@require_POST
def chat_logout(request):
    request.session.pop('chat_user_id', None)
    return redirect('plants:chat_auth')


def chat_room(request, peer_username):
    if not request.session.get('comment_unlocked'):
        return redirect('plants:landing')

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return redirect('plants:chat_auth')

    try:
        peer = ChatUser.objects.get(username__iexact=peer_username)
    except ChatUser.DoesNotExist:
        messages.error(request, f'کاربری با نام «{peer_username}» پیدا نشد.')
        return redirect('plants:welcome')

    if peer.pk == chat_user.pk:
        messages.warning(request, 'نمی‌تونی با خودت چت کنی 😅')
        return redirect('plants:welcome')

    ChatMessage.objects.filter(sender=peer, receiver=chat_user, is_read=False).update(is_read=True)

    msgs_qs = ChatMessage.objects.filter(
        Q(sender=chat_user, receiver=peer) | Q(sender=peer, receiver=chat_user)
    ).select_related('sender', 'reply_to', 'reply_to__sender').order_by('created_at')

    last_msg_id = msgs_qs.values_list('pk', flat=True).last() or 0
    msgs = list(msgs_qs[:200])

    peers = _recent_peers(chat_user)

    return render(request, 'plants/chat_room.html', {
        'chat_user': chat_user,
        'peer': peer,
        'messages': msgs,
        'peers': peers,
        'last_msg_id': last_msg_id,
    })


@require_POST
def chat_send(request, peer_username):
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    try:
        peer = ChatUser.objects.get(username__iexact=peer_username)
    except ChatUser.DoesNotExist:
        return JsonResponse({'error': 'peer not found'}, status=404)

    if peer.pk == chat_user.pk:
        return JsonResponse({'error': 'self'}, status=400)

    text = (request.POST.get('text') or '').strip()
    f = request.FILES.get('file')

    if not text and not f:
        return JsonResponse({'error': 'empty'}, status=400)

    msg_type = 'text'
    if f:
        ext = f.name.rsplit('.', 1)[-1].lower() if '.' in f.name else ''
        image_exts = {'jpg', 'jpeg', 'png', 'webp', 'gif', 'bmp'}
        video_exts = {'mp4', 'webm', 'mov', 'm4v', 'avi', 'mkv'}

        if ext in image_exts:
            msg_type = 'image'
        elif ext in video_exts:
            msg_type = 'video'
        else:
            return JsonResponse({'error': 'فرمت فایل پشتیبانی نمی‌شه'}, status=400)

        if f.size > 25 * 1024 * 1024:
            return JsonResponse({'error': 'حجم فایل نباید بیشتر از ۲۵ مگابایت باشه'}, status=400)

    # ریپلای (اختیاری)
    reply_to_id = request.POST.get('reply_to')
    reply_to_msg = None
    if reply_to_id:
        try:
            reply_to_msg = ChatMessage.objects.get(
                pk=int(reply_to_id),
                sender__in=[chat_user, peer],
                receiver__in=[chat_user, peer],
            )
        except (ValueError, TypeError, ChatMessage.DoesNotExist):
            reply_to_msg = None

    msg = ChatMessage.objects.create(
        sender=chat_user,
        receiver=peer,
        msg_type=msg_type,
        content=text,
        file=f,
        reply_to=reply_to_msg,
    )

    return JsonResponse({
        'ok': True,
        'message': _serialize_message(msg, chat_user),
    })


def chat_fetch(request, peer_username):
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    try:
        peer = ChatUser.objects.get(username__iexact=peer_username)
    except ChatUser.DoesNotExist:
        return JsonResponse({'error': 'peer not found'}, status=404)

    try:
        since = int(request.GET.get('since', 0))
    except (ValueError, TypeError):
        since = 0

    qs = ChatMessage.objects.filter(
        Q(sender=chat_user, receiver=peer) | Q(sender=peer, receiver=chat_user),
        pk__gt=since,
    ).select_related('sender', 'reply_to', 'reply_to__sender').order_by('created_at')[:100]

    ChatMessage.objects.filter(sender=peer, receiver=chat_user, is_read=False).update(is_read=True)

    # چک کن peer در ۳ ثانیه‌ی اخیر تایپ کرده
    from datetime import timedelta
    peer_typing = False
    if peer.last_typing:
        peer_typing = (timezone.now() - peer.last_typing) < timedelta(seconds=3)

    resp = JsonResponse({
        'messages': [_serialize_message(m, chat_user) for m in qs],
        'peer_online': peer.is_online,
        'peer_typing': peer_typing,
    })
    resp['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp['Pragma'] = 'no-cache'
    return resp


def chat_search(request):
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    q = (request.GET.get('q') or '').strip()

    if not q:
        users = ChatUser.objects.exclude(pk=chat_user.pk)[:20]
    else:
        users = ChatUser.objects.filter(username__icontains=q).exclude(pk=chat_user.pk)[:20]

    return JsonResponse({
        'results': [
            {
                'username': u.username,
                'online': u.is_online,
                'url': f'/welcome/chat/{u.username}/',
            }
            for u in users
        ]
    })


def chat_peers_api(request):
    """API لیست چت‌ها برای رفرش خودکار صفحه‌ی welcome."""
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    peers = _recent_peers(chat_user)

    data = []
    total_unread = 0
    for item in peers:
        p = item['peer']
        last = item['last']
        unread = item['unread']
        total_unread += unread

        if last:
            if last.msg_type == 'text':
                preview = last.content[:35]
            elif last.msg_type == 'image':
                preview = '🖼️ تصویر'
            elif last.msg_type == 'video':
                preview = '🎬 ویدیو'
            else:
                preview = ''
            time_str = last.created_at.strftime('%H:%M')
        else:
            preview = 'شروع گفتگو...'
            time_str = ''

        data.append({
            'username': p.username,
            'url': f'/welcome/chat/{p.username}/',
            'unread': unread,
            'online': p.is_online,
            'preview': preview,
            'time': time_str,
        })

    resp = JsonResponse({
        'peers': data,
        'total_unread': total_unread,
    })
    resp['Cache-Control'] = 'no-store, no-cache, must-revalidate, max-age=0'
    resp['Pragma'] = 'no-cache'
    return resp


def chat_settings(request):
    """دریافت یا ذخیره‌ی تنظیمات تم و بکگراند."""
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    # GET → خوندن تنظیمات
    if request.method == 'GET':
        return JsonResponse({
            'theme': chat_user.theme or 'forest',
            'custom_bg_url': chat_user.custom_bg.url if chat_user.custom_bg else '',
            'themes': [{'id': t[0], 'name': t[1]} for t in ChatUser.THEME_CHOICES],
        })

    # POST → ذخیره
    if request.method == 'POST':
        theme = (request.POST.get('theme') or '').strip()
        remove_bg = request.POST.get('remove_bg') == '1'
        new_bg = request.FILES.get('custom_bg')

        valid_themes = [t[0] for t in ChatUser.THEME_CHOICES]
        if theme in valid_themes:
            chat_user.theme = theme

        if remove_bg and chat_user.custom_bg:
            chat_user.custom_bg.delete(save=False)
            chat_user.custom_bg = None

        if new_bg:
            # چک حجم
            if new_bg.size > 8 * 1024 * 1024:
                return JsonResponse({'error': 'حجم بکگراند نباید بیش از ۸ مگابایت باشد'}, status=400)

            # چک نوع فایل
            if not new_bg.content_type.startswith('image/'):
                return JsonResponse({'error': 'فایل باید عکس باشد'}, status=400)

            # حذف قبلی
            if chat_user.custom_bg:
                chat_user.custom_bg.delete(save=False)

            chat_user.custom_bg = new_bg

        chat_user.save()

        return JsonResponse({
            'ok': True,
            'theme': chat_user.theme,
            'custom_bg_url': chat_user.custom_bg.url if chat_user.custom_bg else '',
        })

    return JsonResponse({'error': 'method not allowed'}, status=405)


# ============================================================
#                CHANGE PASSWORD / SECURITY KEY
# ============================================================

@require_POST
def chat_change_password(request):
    """کاربر لاگین‌شده پسوردش رو عوض می‌کنه."""
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    old_password = request.POST.get('old_password', '')
    new_password = request.POST.get('new_password', '')
    new_password2 = request.POST.get('new_password2', '')

    if chat_user.password != old_password:
        return JsonResponse({'error': 'پسورد فعلی اشتباهه'}, status=400)

    if len(new_password) < 4:
        return JsonResponse({'error': 'پسورد جدید باید حداقل ۴ کاراکتر باشه'}, status=400)

    if new_password != new_password2:
        return JsonResponse({'error': 'پسورد جدید و تکرارش یکسان نیستن'}, status=400)

    chat_user.password = new_password
    chat_user.save()

    return JsonResponse({'ok': True, 'message': '✅ پسورد با موفقیت تغییر کرد'})


@require_POST
def chat_set_security_key(request):
    """کاربر کلید امنیتی خودش رو تنظیم یا عوض می‌کنه (نیاز به پسورد فعلی)."""
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    current_password = request.POST.get('current_password', '')
    new_key = request.POST.get('security_key', '').strip()

    if chat_user.password != current_password:
        return JsonResponse({'error': 'پسورد فعلی اشتباهه'}, status=400)

    if len(new_key) < 3:
        return JsonResponse({'error': 'کلید امنیتی باید حداقل ۳ کاراکتر باشه'}, status=400)

    chat_user.security_key = new_key
    chat_user.save()

    return JsonResponse({'ok': True, 'message': '✅ کلید امنیتی ذخیره شد'})


# ============================================================
#                FORGOT PASSWORD (security key)
# ============================================================

def chat_forgot_view(request):
    """صفحه‌ی فراموشی رمز."""
    if not request.session.get('comment_unlocked'):
        return redirect('plants:landing')
    return render(request, 'plants/chat_forgot.html')


@require_POST
def chat_forgot_reset(request):
    """بازیابی پسورد با کلید امنیتی."""
    if not request.session.get('comment_unlocked'):
        return redirect('plants:landing')

    username = request.POST.get('username', '').strip()
    security_key = request.POST.get('security_key', '').strip()
    new_password = request.POST.get('new_password', '')
    new_password2 = request.POST.get('new_password2', '')

    if not username or not security_key or not new_password:
        messages.error(request, 'همه‌ی فیلدها الزامی هستن.')
        return redirect('plants:chat_forgot')

    user = ChatUser.objects.filter(username__iexact=username).first()
    if not user:
        messages.error(request, 'کاربری با این نام وجود نداره.')
        return redirect('plants:chat_forgot')

    if not user.security_key:
        messages.error(request, 'برای این کاربر کلید امنیتی تنظیم نشده. با مدیر تماس بگیر.')
        return redirect('plants:chat_forgot')

    if user.security_key != security_key:
        messages.error(request, 'کلید امنیتی اشتباهه.')
        return redirect('plants:chat_forgot')

    if len(new_password) < 4:
        messages.error(request, 'پسورد جدید باید حداقل ۴ کاراکتر باشه.')
        return redirect('plants:chat_forgot')

    if new_password != new_password2:
        messages.error(request, 'پسورد جدید و تکرارش یکسان نیستن.')
        return redirect('plants:chat_forgot')

    user.password = new_password
    user.save()

    messages.success(request, f'✅ پسورد {user.username} با موفقیت تغییر کرد. حالا می‌تونی وارد شوی.')
    return redirect('plants:chat_auth')


def chat_settings_info(request):
    """اطلاعات کاربر برای صفحه‌ی تنظیمات (نام کاربری، آیا کلید امنیتی داره)."""
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    return JsonResponse({
        'username': chat_user.username,
        'has_security_key': bool(chat_user.security_key),
    })


@require_POST
def chat_typing(request, peer_username):
    """علامت‌گذاری کاربر به عنوان در حال تایپ."""
    if not request.session.get('comment_unlocked'):
        return JsonResponse({'error': 'locked'}, status=403)

    chat_user = _get_current_chat_user(request)
    if not chat_user:
        return JsonResponse({'error': 'no user'}, status=403)

    try:
        peer = ChatUser.objects.get(username__iexact=peer_username)
    except ChatUser.DoesNotExist:
        return JsonResponse({'error': 'peer not found'}, status=404)

    if peer.pk == chat_user.pk:
        return JsonResponse({'error': 'self'}, status=400)

    # آپدیت last_typing
    ChatUser.objects.filter(pk=chat_user.pk).update(last_typing=timezone.now())

    return JsonResponse({'ok': True})


# ============================================================
#                       GUIDE
# ============================================================

def guide(request):
    """صفحه‌ی راهنمای استفاده."""
    return render(request, 'plants/guide.html')


def _serialize_message(msg, current_user):
    reply_data = None
    if msg.reply_to_id:
        r = msg.reply_to
        # پیش‌نمایش کوتاه
        if r.msg_type == 'text':
            r_preview = r.content[:80]
        elif r.msg_type == 'image':
            r_preview = '🖼️ تصویر'
        elif r.msg_type == 'video':
            r_preview = '🎬 ویدیو'
        else:
            r_preview = ''

        reply_data = {
            'id': r.pk,
            'sender': r.sender.username,
            'mine': r.sender_id == current_user.pk,
            'type': r.msg_type,
            'text': r.content[:80],
            'preview': r_preview,
            'file_url': r.file.url if r.file else '',
        }

    return {
        'id': msg.pk,
        'mine': msg.sender_id == current_user.pk,
        'type': msg.msg_type,
        'text': msg.content,
        'file_url': msg.file.url if msg.file else '',
        'file_name': msg.file.name.split('/')[-1] if msg.file else '',
        'time': msg.created_at.strftime('%H:%M'),
        'date': msg.created_at.strftime('%Y/%m/%d'),
        'sender': msg.sender.username,
        'reply_to': reply_data,
    }
