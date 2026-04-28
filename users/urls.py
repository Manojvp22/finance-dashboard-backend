from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, login_view, logout_view, me_view

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [
    path('auth/login/', login_view),
    path('auth/logout/', logout_view),
    path('auth/me/', me_view),
    path('', include(router.urls)),
]
