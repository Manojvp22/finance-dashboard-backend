from rest_framework import viewsets
from .models import Record
from .serializers import RecordSerializer
from users.permissions import RolePermission

class RecordViewSet(viewsets.ModelViewSet):
    queryset = Record.objects.all().order_by('-date', '-created_at')
    serializer_class = RecordSerializer
    permission_classes = [RolePermission]

    def get_queryset(self):
        queryset = Record.objects.all().order_by('-date', '-created_at')

        type_param = self.request.query_params.get('type')
        category = self.request.query_params.get('category')
        date = self.request.query_params.get('date')

        if type_param:
            queryset = queryset.filter(type=type_param)

        if category:
            queryset = queryset.filter(category=category)

        if date:
            queryset = queryset.filter(date=date)

        return queryset
