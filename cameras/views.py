import json
from pathlib import Path

from django.conf import settings
from django.contrib.auth import authenticate, login, logout
from django.http import FileResponse, Http404, JsonResponse
from django.shortcuts import render
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .models import Camera
from . import stream_manager


def index(request):
    return render(request, 'index.html')


# ─── Auth ─────────────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def api_login(request):
    try:
        body = json.loads(request.body)
    except json.JSONDecodeError:
        return JsonResponse({'error': "Noto'g'ri JSON"}, status=400)
    user = authenticate(request, username=body.get('username', ''), password=body.get('password', ''))
    if user is None:
        return JsonResponse({'error': "Login yoki parol noto'g'ri"}, status=401)
    login(request, user)
    return JsonResponse({'ok': True, 'username': user.username})


@csrf_exempt
@require_http_methods(['POST'])
def api_logout(request):
    logout(request)
    return JsonResponse({'ok': True})


def api_me(request):
    if request.user.is_authenticated:
        return JsonResponse({'authenticated': True, 'username': request.user.username})
    return JsonResponse({'authenticated': False})


def _require_auth(request):
    if not request.user.is_authenticated:
        return JsonResponse({'error': 'Tizimga kiring'}, status=401)
    return None


# ─── Camera list / create ─────────────────────────────────────────────────────

@csrf_exempt
def cameras_list(request):
    try:
        if request.method == 'GET':
            alive = stream_manager.alive_ids()
            data = [c.to_dict(is_live=c.id in alive) for c in Camera.objects.all()]
            return JsonResponse(data, safe=False)

        err = _require_auth(request)
        if err:
            return err

        if request.method == 'POST':
            body = json.loads(request.body)
            required = ('name', 'cam_username', 'cam_password', 'ip', 'port')
            for field in required:
                if not body.get(field):
                    return JsonResponse({'error': f"'{field}' maydoni talab qilinadi"}, status=400)

            cam = Camera.objects.create(
                name=body['name'],
                location=body.get('location', ''),
                cam_username=body['cam_username'],
                cam_password=body['cam_password'],
                ip=body['ip'],
                port=int(body['port']),
                resolution=body.get('resolution', '1920x1080'),
                fps=int(body.get('fps', 25)),
            )
            is_live = False
            if body.get('status') == 'live':
                ok, _ = stream_manager.start_stream(cam)
                is_live = ok
            return JsonResponse(cam.to_dict(is_live=is_live), status=201)

        return JsonResponse({'error': 'Method not allowed'}, status=405)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─── Camera detail / update / delete ─────────────────────────────────────────

@csrf_exempt
def camera_detail(request, pk):
    try:
        try:
            cam = Camera.objects.get(pk=pk)
        except Camera.DoesNotExist:
            return JsonResponse({'error': 'Topilmadi'}, status=404)

        if request.method == 'GET':
            return JsonResponse(cam.to_dict(is_live=stream_manager.is_alive(cam.id)))

        err = _require_auth(request)
        if err:
            return err

        if request.method in ('PUT', 'PATCH'):
            body = json.loads(request.body)
            was_live = stream_manager.is_alive(cam.id)
            if was_live:
                stream_manager.stop_stream(cam)

            cam.name = body.get('name', cam.name)
            cam.location = body.get('location', cam.location)
            cam.cam_username = body.get('cam_username', cam.cam_username)
            if body.get('cam_password'):
                cam.cam_password = body['cam_password']
            cam.ip = body.get('ip', cam.ip)
            cam.port = int(body.get('port', cam.port))
            cam.resolution = body.get('resolution', cam.resolution)
            cam.fps = int(body.get('fps', cam.fps))
            if 'audio' in body:
                cam.audio = bool(body['audio'])
            cam.save()

            is_live = False
            if was_live:
                ok, _ = stream_manager.start_stream(cam)
                is_live = ok
            return JsonResponse(cam.to_dict(is_live=is_live))

        if request.method == 'DELETE':
            stream_manager.stop_stream(cam)
            cam.delete()
            return JsonResponse({'ok': True})

        return JsonResponse({'error': 'Method not allowed'}, status=405)
    except Exception as e:
        return JsonResponse({'error': str(e)}, status=500)


# ─── Stream control ───────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def camera_start(request, pk):
    err = _require_auth(request)
    if err:
        return err
    try:
        cam = Camera.objects.get(pk=pk)
    except Camera.DoesNotExist:
        return JsonResponse({'error': 'Topilmadi'}, status=404)
    ok, msg = stream_manager.start_stream(cam)
    return JsonResponse({'ok': ok, 'msg': msg, 'status': 'live' if ok else 'error'})


@csrf_exempt
@require_http_methods(['POST'])
def camera_stop(request, pk):
    err = _require_auth(request)
    if err:
        return err
    try:
        cam = Camera.objects.get(pk=pk)
    except Camera.DoesNotExist:
        return JsonResponse({'error': 'Topilmadi'}, status=404)
    ok, msg = stream_manager.stop_stream(cam)
    return JsonResponse({'ok': ok, 'msg': msg, 'status': 'stopped'})


# ─── Audio toggle ────────────────────────────────────────────────────────────

@csrf_exempt
@require_http_methods(['POST'])
def camera_toggle_audio(request, pk):
    err = _require_auth(request)
    if err:
        return err
    try:
        cam = Camera.objects.get(pk=pk)
    except Camera.DoesNotExist:
        return JsonResponse({'error': 'Topilmadi'}, status=404)
    cam.audio = not cam.audio
    cam.save()
    was_live = stream_manager.is_alive(cam.id)
    if was_live:
        stream_manager.stop_stream(cam)
        stream_manager.start_stream(cam)
    return JsonResponse(cam.to_dict(is_live=was_live))


# ─── FFmpeg logs ──────────────────────────────────────────────────────────────

def camera_logs(request, pk):
    err = _require_auth(request)
    if err:
        return err
    logs = stream_manager.get_logs(pk)
    return JsonResponse({'logs': logs})


# ─── HLS file serving ─────────────────────────────────────────────────────────

def serve_hls(request, filename):
    if '..' in filename or filename.startswith('/'):
        raise Http404
    filepath = Path(settings.MEDIA_ROOT) / 'streams' / filename
    if not filepath.exists():
        raise Http404
    if filename.endswith('.m3u8'):
        content_type = 'application/vnd.apple.mpegurl'
    elif filename.endswith('.ts'):
        content_type = 'video/mp2t'
    else:
        raise Http404
    return FileResponse(open(filepath, 'rb'), content_type=content_type)
