from rest_framework.views import APIView
from rest_framework.response import Response
from records.models import Record
from django.db.models import Sum
from django.shortcuts import render
from users.permissions import RolePermission


def frontend_dashboard(request):
    return render(request, 'dashboard/index.html')

class DashboardSummaryView(APIView):
    permission_classes = [RolePermission]

    def get(self, request):

        total_income = Record.objects.filter(type='income').aggregate(Sum('amount'))['amount__sum'] or 0
        total_expense = Record.objects.filter(type='expense').aggregate(Sum('amount'))['amount__sum'] or 0

        net_balance = total_income - total_expense

        category_totals = Record.objects.values('category').annotate(total=Sum('amount'))

        recent_transactions = Record.objects.order_by('-created_at')[:5]

        data = {
            "total_income": total_income,
            "total_expense": total_expense,
            "net_balance": net_balance,
            "category_totals": list(category_totals),
            "recent_transactions": [
                {
                    "amount": r.amount,
                    "type": r.type,
                    "category": r.category
                } for r in recent_transactions
            ]
        }

        return Response(data)
