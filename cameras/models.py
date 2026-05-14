import re
from django.db import models


class Camera(models.Model):
    name = models.CharField(max_length=100)
    location = models.CharField(max_length=200, blank=True, verbose_name="Joylashuv/Tavsif")
    cam_username = models.CharField(max_length=100, verbose_name="Foydalanuvchi nomi")
    cam_password = models.CharField(max_length=100, verbose_name="Parol")
    ip = models.CharField(max_length=50, verbose_name="IP manzil")
    port = models.PositiveIntegerField(default=554, verbose_name="Port")
    resolution = models.CharField(max_length=20, default='1920x1080')
    fps = models.PositiveIntegerField(default=25)
    audio = models.BooleanField(default=False, verbose_name="Ovoz")
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ['id']
        verbose_name = "Kamera"
        verbose_name_plural = "Kameralar"

    def __str__(self):
        return self.name

    @property
    def rtsp_url(self):
        return f"rtsp://{self.cam_username}:{self.cam_password}@{self.ip}:{self.port}"

    @property
    def stream_slug(self):
        safe = re.sub(r'[^\w]', '_', self.name)
        return f"{safe}_{self.id}"

    def to_dict(self, is_live=False, private=False):
        data = {
            "id": self.id,
            "name": self.name,
            "location": self.location,
            "resolution": self.resolution,
            "fps": self.fps,
            "audio": self.audio,
            "status": "live" if is_live else "stopped",
            "bitrate": 0,
            "uptime": "—",
            "stream_url": f"/hls/{self.stream_slug}.m3u8",
        }
        if private:
            data.update({
                "rtsp": f"rtsp://{self.ip}:{self.port}",
                "ip": self.ip,
                "port": self.port,
                "cam_username": self.cam_username,
                "cam_password": self.cam_password,
            })
        return data
