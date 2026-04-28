from django.contrib import admin
from django.urls import path, include
from dashboard.views import frontend_dashboard

urlpatterns = [
    path('', frontend_dashboard, name='frontend-dashboard'),
    path('admin/', admin.site.urls),
    path('api/', include('users.urls')),
    path('api/', include('records.urls')),
    path('api/', include('dashboard.urls')),
]
