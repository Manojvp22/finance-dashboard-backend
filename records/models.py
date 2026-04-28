from django.db import models
from users.models import User

class Record(models.Model):
    TYPE_CHOICES = [
        ('income', 'Income'),
        ('expense', 'Expense'),
    ]
    SCOPE_CHOICES = [
        ('personal', 'Personal'),
        ('team', 'Team'),
    ]

    amount = models.DecimalField(max_digits=10, decimal_places=2)
    type = models.CharField(max_length=10, choices=TYPE_CHOICES)
    scope = models.CharField(max_length=12, choices=SCOPE_CHOICES, default='personal')
    category = models.CharField(max_length=100)
    date = models.DateField()
    description = models.TextField(blank=True)
    created_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.type} - {self.amount}"
