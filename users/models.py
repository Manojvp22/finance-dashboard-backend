from django.db import models
from django.contrib.auth.hashers import check_password, make_password
from django.utils import timezone
from datetime import timedelta
import hashlib
import secrets

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
    password_hash = models.CharField(max_length=128, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def set_password(self, raw_password):
        self.password_hash = make_password(raw_password)

    def check_password(self, raw_password):
        if not self.password_hash:
            return False
        return check_password(raw_password, self.password_hash)

    def __str__(self):
        return self.name


class AccessToken(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE, related_name='access_tokens')
    token_hash = models.CharField(max_length=64, unique=True)
    created_at = models.DateTimeField(auto_now_add=True)
    expires_at = models.DateTimeField()
    last_used_at = models.DateTimeField(null=True, blank=True)

    @staticmethod
    def hash_token(raw_token):
        return hashlib.sha256(raw_token.encode('utf-8')).hexdigest()

    @classmethod
    def issue_for_user(cls, user):
        raw_token = secrets.token_urlsafe(48)
        token = cls.objects.create(
            user=user,
            token_hash=cls.hash_token(raw_token),
            expires_at=timezone.now() + timedelta(hours=12),
        )
        return raw_token, token

    @property
    def is_expired(self):
        return timezone.now() >= self.expires_at
