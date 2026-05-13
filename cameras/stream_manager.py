import subprocess
import threading
from collections import deque
from pathlib import Path
from django.conf import settings

# {camera_id: subprocess.Popen}
_processes: dict[int, subprocess.Popen] = {}

# {camera_id: deque of log lines}
_logs: dict[int, deque] = {}
LOG_LINES = 100


def _streams_dir() -> Path:
    d = Path(settings.MEDIA_ROOT) / 'streams'
    d.mkdir(parents=True, exist_ok=True)
    return d


def _read_stderr(camera_id: int, proc: subprocess.Popen):
    """Orqa fonda ffmpeg stderr ni o'qib _logs ga yozadi."""
    buf = _logs.setdefault(camera_id, deque(maxlen=LOG_LINES))
    try:
        for line in proc.stderr:
            buf.append(line.decode('utf-8', errors='replace').rstrip())
    except Exception:
        pass


def start_stream(camera) -> tuple[bool, str]:
    if is_alive(camera.id):
        return True, "Allaqachon efirda"

    m3u8_path = _streams_dir() / f"{camera.stream_slug}.m3u8"
    _logs[camera.id] = deque(maxlen=LOG_LINES)

    cmd = [
        'ffmpeg', '-y',
        '-rtsp_transport', 'tcp',
        '-i', camera.rtsp_url,
        '-vsync', '0',
        '-copyts',
        '-vcodec', 'copy',
        *(['-acodec', 'aac'] if getattr(camera, 'audio', False) else ['-an']),
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
            stderr=subprocess.PIPE,
        )
        _processes[camera.id] = proc
        t = threading.Thread(target=_read_stderr, args=(camera.id, proc), daemon=True)
        t.start()
        return True, "Stream boshlandi"
    except FileNotFoundError:
        return False, "ffmpeg topilmadi — PATH ni tekshiring"
    except Exception as exc:
        return False, str(exc)


def stop_stream(camera) -> tuple[bool, str]:
    proc = _processes.pop(camera.id, None)
    if proc is None:
        return False, "Faol stream topilmadi"

    proc.terminate()
    try:
        proc.wait(timeout=5)
    except subprocess.TimeoutExpired:
        proc.kill()

    streams = _streams_dir()
    for f in streams.glob(f"{camera.stream_slug}*"):
        try:
            f.unlink()
        except OSError:
            pass

    return True, "Stream to'xtatildi"


def get_logs(camera_id: int) -> list[str]:
    return list(_logs.get(camera_id, []))


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
