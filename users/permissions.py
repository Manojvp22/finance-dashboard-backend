from rest_framework.permissions import BasePermission
from django.utils import timezone
from .models import AccessToken


def authenticate_token(request):
    auth_header = request.headers.get('Authorization', '')
    if not auth_header.startswith('Bearer '):
        return None

    raw_token = auth_header.removeprefix('Bearer ').strip()
    if not raw_token:
        return None

    token_hash = AccessToken.hash_token(raw_token)
    token = AccessToken.objects.select_related('user').filter(token_hash=token_hash).first()
    if not token or token.is_expired or not token.user.status:
        if token and token.is_expired:
            token.delete()
        return None

    token.last_used_at = timezone.now()
    token.save(update_fields=['last_used_at'])
    request.auth_token = token
    request.auth_user = token.user
    return token.user

class RolePermission(BasePermission):

    def has_permission(self, request, view):
        user = authenticate_token(request)
        if not user:
            return False

        user_role = user.role

        view_name = getattr(view, 'basename', None)
        class_name = view.__class__.__name__

        if view_name == 'records' or class_name == 'RecordViewSet':
            if request.method in ['GET', 'POST']:
                return user_role in ['viewer', 'analyst', 'admin']
            if request.method in ['PUT', 'PATCH']:
                return user_role in ['viewer', 'analyst', 'admin']
            return user_role == 'admin'

        if view_name == 'users' or class_name == 'UserViewSet':
            return user_role == 'admin'

        if view_name == 'audit-logs' or class_name == 'AuditLogViewSet':
            return request.method == 'GET' and user_role == 'admin'

        if class_name == 'DashboardSummaryView':
            return request.method == 'GET' and user_role in ['viewer', 'analyst', 'admin']

        return True
