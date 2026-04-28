from rest_framework import viewsets
from rest_framework import status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.response import Response
from .models import User
from .serializers import UserSerializer
from .models import AccessToken
from .permissions import RolePermission, authenticate_token

class UserViewSet(viewsets.ModelViewSet):
    queryset = User.objects.all().order_by('name', 'id')
    serializer_class = UserSerializer
    permission_classes = [RolePermission]


@api_view(['POST'])
@permission_classes([])
def login_view(request):
    email = request.data.get('email', '').strip().lower()
    password = request.data.get('password', '')

    user = User.objects.filter(email__iexact=email, status=True).first()
    if not user or not user.check_password(password):
        return Response({'detail': 'Invalid email or password.'}, status=status.HTTP_401_UNAUTHORIZED)

    raw_token, token = AccessToken.issue_for_user(user)
    return Response({
        'token': raw_token,
        'expires_at': token.expires_at,
        'user': UserSerializer(user).data,
    })


@api_view(['POST'])
@permission_classes([])
def logout_view(request):
    user = authenticate_token(request)
    if user and hasattr(request, 'auth_token'):
        request.auth_token.delete()
    return Response(status=status.HTTP_204_NO_CONTENT)


@api_view(['GET'])
@permission_classes([])
def me_view(request):
    user = authenticate_token(request)
    if not user:
        return Response({'detail': 'Authentication credentials were not provided.'}, status=status.HTTP_401_UNAUTHORIZED)
    return Response(UserSerializer(user).data)
