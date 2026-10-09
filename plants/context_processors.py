from django.contrib.auth.models import User


def admin_stats(request):
    """آمار برای داشبورد ادمین"""
    if not request.path.startswith('/admin/'):
        return {}
    if not request.user.is_authenticated or not request.user.is_staff:
        return {}

    from .models import Plant, AdminPattern

    return {
        'total_plants': Plant.objects.count(),
        'featured_plants': Plant.objects.filter(is_featured=True).count(),
        'total_users': User.objects.count(),
        'total_admins': User.objects.filter(is_staff=True).count(),
        'total_patterns': AdminPattern.objects.count(),
        'recent_plants': Plant.objects.order_by('-created_at')[:5],
    }
