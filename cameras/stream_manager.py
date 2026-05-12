import subprocess
import os
from pathlib import Path
from django.conf import settings

# {camera_id: subprocess.Popen}
_processes: dict[int, subprocess.Popen] = {}


def _streams_dir() -> Path:
    d = Path(settings.MEDIA_ROOT) / 'streams'
    d.mkdir(parents=True, exist_ok=True)
    return d


def start_stream(camera) -> tuple[bool, str]:
    """FFmpeg RTSP → HLS stream boshlash."""
    if is_alive(camera.id):
        return True, "Allaqachon efirda"

    m3u8_path = _streams_dir() / f"{camera.stream_slug}.m3u8"

    cmd = [
        'ffmpeg', '-y',
        '-rtsp_transport', 'tcp',
        '-i', camera.rtsp_url,
        '-vsync', '0',
        '-copyts',
        '-vcodec', 'copy',
        '-an',
        '-hls_time', '10',
        '-hls_list_size', '10',
        '-start_number', '0',
        '-hls_wrap', '30',
        str(m3u8_path),
    ]

    try:
        proc = subprocess.Popen(
            cmd,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
        )
        _processes[camera.id] = proc
        return True, "Stream boshlandi"
    except FileNotFoundError:
        return False, "ffmpeg topilmadi — PATH'ni tekshiring"
    except Exception as exc:
        return False, str(exc)


def stop_stream(camera) -> tuple[bool, str]:
    """Stream to'xtatish va HLS fayllarini tozalash."""
    proc = _processes.pop(camera.id, None)
    if proc is None:
        return False, "Faol stream topilmadi"

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

    # Eski segmentlarni o'chirish
    streams = _streams_dir()
    slug = camera.stream_slug
    for f in streams.glob(f"{slug}*"):
        try:
            f.unlink()
        except OSError:
            pass

    return True, "Stream to'xtatildi"


def is_alive(camera_id: int) -> bool:
    proc = _processes.get(camera_id)
    if proc is None:
        return False
    if proc.poll() is not None:
        _processes.pop(camera_id, None)
        return False
    return True


def alive_ids() -> set[int]:
    dead = [cid for cid, p in _processes.items() if p.poll() is not None]
    for cid in dead:
        _processes.pop(cid)
    return set(_processes.keys())
