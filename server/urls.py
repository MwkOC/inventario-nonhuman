from django.conf import settings
from django.http import FileResponse, HttpResponse, JsonResponse
from django.db import connection, DatabaseError
from django.views.decorators.cache import never_cache
from django.views.decorators.http import require_safe
from django.urls import path, re_path
from lab import views

def index(request):
    page = settings.BASE_DIR / 'dist' / 'index.html'
    return FileResponse(page.open('rb'), content_type='text/html') if page.exists() else HttpResponse('Run npm run build or use http://localhost:5173')

@require_safe
@never_cache
def health(request):
    try:
        with connection.cursor() as cursor:
            cursor.execute('SELECT 1')
        if not (settings.BASE_DIR / 'dist' / 'index.html').is_file():
            return JsonResponse({'status':'unavailable'}, status=503)
    except DatabaseError:
        return JsonResponse({'status':'unavailable'}, status=503)
    return JsonResponse({'status':'ok'})

urlpatterns = [path('healthz', health), path('api/<str:action>', views.api), re_path(r'^(?!api/).*$', index)]
