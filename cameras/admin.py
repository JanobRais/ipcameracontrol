from django.contrib import admin
from .models import Camera

@admin.register(Camera)
class CameraAdmin(admin.ModelAdmin):
    list_display = ('id', 'name', 'ip', 'port', 'resolution', 'fps', 'created_at')
    search_fields = ('name', 'ip', 'location')
