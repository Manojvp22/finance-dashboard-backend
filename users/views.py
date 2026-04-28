from rest_framework import viewsets
from rest_framework import status
from django.core.mail import send_mail
from django.conf import settings
from django.utils import timezone
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import User, PasswordResetToken
from .serializers import UserSerializer
from .models import AccessToken
from .permissions import RolePermission, authenticate_token
from dashboard.models import AuditLog

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('name', 'id')
    serializer_class = UserSerializer
    permission_classes = [RolePermission]

    def perform_create(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            actor=getattr(self.request, 'auth_user', None),
            action='create',
            entity_type='user',
            entity_id=str(user.id),
            description=f'Created {user.role} account for {user.email}',
        )

    def perform_update(self, serializer):
        user = serializer.save()
        AuditLog.objects.create(
            actor=getattr(self.request, 'auth_user', None),
            action='update',
            entity_type='user',
            entity_id=str(user.id),
            description=f'Updated {user.role} account for {user.email}',
        )

    def perform_destroy(self, instance):
        AuditLog.objects.create(
            actor=getattr(self.request, 'auth_user', None),
            action='delete',
            entity_type='user',
            entity_id=str(instance.id),
            description=f'Deleted account for {instance.email}',
        )
        instance.delete()


@api_view(['POST'])
@permission_classes([])
def login_view(request):
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    user = User.objects.filter(email__iexact=email, status=True).first()
    if not user or not user.check_password(password):
        return Response({'detail': 'Invalid email or password.'}, status=status.HTTP_401_UNAUTHORIZED)

    raw_token, token = AccessToken.issue_for_user(user)
    AuditLog.objects.create(actor=user, action='login', entity_type='session', entity_id=str(token.id), description='User logged in')
    return Response({
        'token': raw_token,
        'expires_at': token.expires_at,
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([])
def signup_view(request):
    name = request.data.get('name', '').strip()
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    if not name:
        return Response({'detail': 'Name is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if not email:
        return Response({'detail': 'Email is required.'}, status=status.HTTP_400_BAD_REQUEST)

    if len(password) < 8:
        return Response({'detail': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

    if User.objects.filter(email__iexact=email).exists():
        return Response({'detail': 'An account with this email already exists.'}, status=status.HTTP_400_BAD_REQUEST)

    user = User(name=name, email=email, role='viewer', status=True)
    user.set_password(password)
    user.save()

    raw_token, token = AccessToken.issue_for_user(user)
    AuditLog.objects.create(
        actor=user,
        action='create',
        entity_type='user',
        entity_id=str(user.id),
        description=f'Self signup created User account for {user.email}',
    )

    return Response({
        'token': raw_token,
        'expires_at': token.expires_at,
        'user': UserSerializer(user).data,
    }, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([])
def logout_view(request):
    user = authenticate_token(request)
    if user and hasattr(request, 'auth_token'):
        AuditLog.objects.create(actor=user, action='logout', entity_type='session', entity_id=str(request.auth_token.id), description='User logged out')
        request.auth_token.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([])
def me_view(request):
    user = authenticate_token(request)
    if not user:
        return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(UserSerializer(user).data)


@api_view(['POST'])
@permission_classes([])
def password_reset_request_view(request):
    email = request.data.get('email', '').strip().lower()
    user = User.objects.filter(email__iexact=email, status=True).first()

    payload = {'detail': 'If that email exists, a reset link has been prepared.'}
    if not user:
        return Response(payload)

    raw_token, reset_token = PasswordResetToken.issue_for_user(user)
    reset_url = request.build_absolute_uri(f'/?reset_token={raw_token}')

    try:
        send_mail(
            'Finance Dashboard password reset',
            f'Use this link to reset your password: {reset_url}',
            getattr(settings, 'DEFAULT_FROM_EMAIL', 'no-reply@finance-dashboard.local'),
            [user.email],
            fail_silently=True,
        )
    except Exception:
        pass

    AuditLog.objects.create(actor=user, action='password_reset', entity_type='user', entity_id=str(user.id), description='Password reset requested')

    return Response(payload)


@api_view(['POST'])
@permission_classes([])
def password_reset_confirm_view(request):
    raw_token = request.data.get('token', '').strip()
    password = request.data.get('password', '')

    if len(password) < 8:
        return Response({'detail': 'Password must be at least 8 characters long.'}, status=status.HTTP_400_BAD_REQUEST)

    token_hash = PasswordResetToken.hash_token(raw_token)
    reset_token = PasswordResetToken.objects.select_related('user').filter(token_hash=token_hash).first()
    if not reset_token or not reset_token.is_active:
        return Response({'detail': 'Reset link is invalid or expired.'}, status=status.HTTP_400_BAD_REQUEST)

    user = reset_token.user
    user.set_password(password)
    user.save(update_fields=['password_hash'])
    reset_token.used_at = timezone.now()
    reset_token.save(update_fields=['used_at'])
    AccessToken.objects.filter(user=user).delete()

    AuditLog.objects.create(actor=user, action='password_reset', entity_type='user', entity_id=str(user.id), description='Password reset completed')
    return Response({'detail': 'Password has been reset. Please log in.'})
