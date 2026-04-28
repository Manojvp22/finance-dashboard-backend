from rest_framework import viewsets
from rest_framework.exceptions import PermissionDenied
from django.db.models import Q
from .models import Record
from .serializers import RecordSerializer
from users.permissions import RolePermission
from dashboard.models import AuditLog

class RecordViewSet(viewsets.ModelViewSet):
    queryset = Record.objects.all().order_by('-date', '-created_at')
    serializer_class = RecordSerializer
    permission_classes = [RolePermission]

    def get_queryset(self):
        queryset = Record.objects.all().order_by('-date', '-created_at')
        user = getattr(self.request, 'auth_user', None)
        if not user:
            return Record.objects.none()

        if user.role == 'viewer':
            queryset = queryset.filter(created_by=user, scope='personal')
        elif user.role == 'analyst':
            queryset = queryset.filter(Q(scope='team') | Q(created_by=user))

        type_param = self.request.query_params.get('type')
        category = self.request.query_params.get('category')
        date = self.request.query_params.get('date')
        scope = self.request.query_params.get('scope')

        if type_param:
            queryset = queryset.filter(type=type_param)

        if category:
            queryset = queryset.filter(category=category)

        if date:
            queryset = queryset.filter(date=date)

        if scope:
            queryset = queryset.filter(scope=scope)

        return queryset.distinct().order_by('-date', '-created_at')

    def perform_create(self, serializer):
        user = getattr(self.request, 'auth_user', None)
        scope = self.request.data.get('scope', 'personal')

        if user.role == 'viewer' and scope != 'personal':
            raise PermissionDenied('Users can only create personal records.')

        if user.role != 'admin':
            record = serializer.save(created_by=user)
        else:
            record = serializer.save()

        AuditLog.objects.create(
            actor=user,
            action='create',
            entity_type='record',
            entity_id=str(record.id),
            description=f'{record.type} {record.scope} record for {record.category}',
        )

    def perform_update(self, serializer):
        user = getattr(self.request, 'auth_user', None)
        record = self.get_object()
        if user.role != 'admin' and record.created_by_id != user.id:
            raise PermissionDenied('You can only update your own records.')
        if user.role == 'viewer' and self.request.data.get('scope', record.scope) != 'personal':
            raise PermissionDenied('Users can only keep personal records.')

        updated = serializer.save(created_by=record.created_by if user.role != 'admin' else serializer.validated_data.get('created_by', record.created_by))
        AuditLog.objects.create(
            actor=user,
            action='update',
            entity_type='record',
            entity_id=str(updated.id),
            description=f'Updated {updated.type} {updated.scope} record for {updated.category}',
        )

    def perform_destroy(self, instance):
        user = getattr(self.request, 'auth_user', None)
        AuditLog.objects.create(
            actor=user,
            action='delete',
            entity_type='record',
            entity_id=str(instance.id),
            description=f'Deleted {instance.type} {instance.scope} record for {instance.category}',
        )
        instance.delete()
