from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import DashboardSummaryView, AuditLogViewSet

router = DefaultRouter()
router.register(r'audit-logs', AuditLogViewSet)

urlpatterns = [
    path('dashboard/summary/', DashboardSummaryView.as_view()),
    path('', include(router.urls)),
]
