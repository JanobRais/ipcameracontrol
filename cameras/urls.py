from django.urls import path
from . import views

urlpatterns = [
    path('', views.index, name='index'),          # Public viewer
    path('admin/', views.index, name='admin'),     # Admin panel (same template, React handles routing)

    # Auth
    path('api/login/', views.api_login, name='api-login'),
    path('api/logout/', views.api_logout, name='api-logout'),
    path('api/me/', views.api_me, name='api-me'),

    # Camera CRUD
    path('api/cameras/', views.cameras_list, name='cameras-list'),
    path('api/cameras/<int:pk>/', views.camera_detail, name='camera-detail'),

    # Stream boshqaruv
    path('api/cameras/<int:pk>/start/', views.camera_start, name='camera-start'),
    path('api/cameras/<int:pk>/stop/', views.camera_stop, name='camera-stop'),
    path('api/cameras/<int:pk>/logs/', views.camera_logs, name='camera-logs'),
    path('api/cameras/<int:pk>/toggle-audio/', views.camera_toggle_audio, name='camera-toggle-audio'),

    # HLS fayllari
    path('hls/<str:filename>', views.serve_hls, name='hls-serve'),
]
