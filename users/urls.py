from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import UserViewSet, login_view, signup_view, logout_view, me_view, password_reset_request_view, password_reset_confirm_view

router = DefaultRouter()
router.register(r'users', UserViewSet)

urlpatterns = [
    path('auth/login/', login_view),
    path('auth/signup/', signup_view),
    path('auth/logout/', logout_view),
    path('auth/me/', me_view),
    path('auth/password-reset/', password_reset_request_view),
    path('auth/password-reset/confirm/', password_reset_confirm_view),
    path('', include(router.urls)),
]
