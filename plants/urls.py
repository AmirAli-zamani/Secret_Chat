from django.urls import path
from . import views

app_name = 'plants'

urlpatterns = [
    path('', views.landing, name='landing'),
    path('plants/', views.plant_list, name='list'),
    path('guide/', views.guide, name='guide'),
    path('plants/<str:slug>/', views.plant_detail, name='detail'),

    # قفل الگو
    path('api/check-pattern/', views.check_pattern, name='check_pattern'),

    # نظرات
    path('comment/', views.comment_form, name='comment'),
    path('comment/submit/', views.submit_comment, name='submit_comment'),

    # چت — auth
    path('welcome/', views.welcome, name='welcome'),
    path('auth/', views.chat_auth, name='chat_auth'),
    path('auth/login/', views.chat_login, name='chat_login'),
    path('auth/signup/', views.chat_signup, name='chat_signup'),
    path('auth/forgot/', views.chat_forgot_view, name='chat_forgot'),
    path('auth/forgot/reset/', views.chat_forgot_reset, name='chat_forgot_reset'),
    path('welcome/logout/', views.chat_logout, name='chat_logout'),

    # چت — account settings
    path('welcome/account/change-password/', views.chat_change_password, name='chat_change_password'),
    path('welcome/account/set-security-key/', views.chat_set_security_key, name='chat_set_security_key'),
    path('welcome/account/info/', views.chat_settings_info, name='chat_settings_info'),

    # چت — main
    path('welcome/chat/<str:peer_username>/', views.chat_room, name='chat_room'),
    path('welcome/api/send/<str:peer_username>/', views.chat_send, name='chat_send'),
    path('welcome/api/fetch/<str:peer_username>/', views.chat_fetch, name='chat_fetch'),
    path('welcome/api/typing/<str:peer_username>/', views.chat_typing, name='chat_typing'),
    path('welcome/api/search/', views.chat_search, name='chat_search'),
    path('welcome/api/peers/', views.chat_peers_api, name='chat_peers_api'),
    path('welcome/api/settings/', views.chat_settings, name='chat_settings'),
]
