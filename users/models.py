from django.db import models

class User(models.Model):
    ROLE_CHOICES = [
        ('viewer', 'Viewer'),
        ('analyst', 'Analyst'),
        ('admin', 'Admin'),
    ]

    name = models.CharField(max_length=100)
    email = models.EmailField(unique=True)
    role = models.CharField(max_length=10, choices=ROLE_CHOICES)
    status = models.BooleanField(default=True)  # active/inactive
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.name