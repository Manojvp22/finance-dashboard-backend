from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import viewsets
from records.models import Record
from django.db.models import Q, Sum
from django.shortcuts import render
from users.permissions import RolePermission
from .models import AuditLog
from .serializers import AuditLogSerializer


def frontend_dashboard(request):
    return render(request, 'dashboard/index.html')

class DashboardSummaryView(APIView):
    permission_classes = [RolePermission]

    def get(self, request):
        user = getattr(request, 'auth_user', None)
        records = Record.objects.all()
        if user and user.role == 'viewer':
            records = records.filter(created_by=user, scope='personal')
        elif user and user.role == 'analyst':
            records = records.filter(Q(scope='team') | Q(created_by=user))

        records = records.distinct()

        total_income = records.filter(type='income').aggregate(Sum('amount'))['amount__sum'] or 0
        total_expense = records.filter(type='expense').aggregate(Sum('amount'))['amount__sum'] or 0

        net_balance = total_income - total_expense

        category_totals = records.values('category').annotate(total=Sum('amount'))

        recent_transactions = records.order_by('-created_at')[:5]

        data = {
            "total_income": total_income,
            "total_expense": total_expense,
            "net_balance": net_balance,
            "category_totals": list(category_totals),
            "recent_transactions": [
                {
                    "amount": r.amount,
                    "type": r.type,
                    "category": r.category,
                    "scope": r.scope,
                } for r in recent_transactions
            ]
        }

        return Response(data)


class AuditLogViewSet(viewsets.ReadOnlyModelViewSet):
    queryset = AuditLog.objects.select_related('actor').all()
    serializer_class = AuditLogSerializer
    permission_classes = [RolePermission]
