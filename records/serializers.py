from rest_framework import serializers
from .models import Record

class RecordSerializer(serializers.ModelSerializer):
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = Record
        fields = ['id', 'amount', 'type', 'scope', 'category', 'date', 'description', 'created_by', 'created_by_name', 'created_at']
        read_only_fields = ['id', 'created_at', 'created_by_name']
