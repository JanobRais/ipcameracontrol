from django.urls import path, include, re_path
from django.views.static import serve
from django.conf import settings

urlpatterns = [
    re_path(r'^static/(?P<path>.*)$', serve, {'document_root': settings.BASE_DIR / 'static'}),
    path('', include('cameras.urls')),
]
