from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    initial = True

    dependencies = [
        ('users', '0002_secure_tokens'),
    ]

    operations = [
        migrations.CreateModel(
            name='AuditLog',
            fields=[
                ('id', models.BigAutoField(auto_created=True, primary_key=True, serialize=False, verbose_name='ID')),
                ('action', models.CharField(choices=[('create', 'Create'), ('update', 'Update'), ('delete', 'Delete'), ('login', 'Login'), ('logout', 'Logout'), ('password_reset', 'Password Reset')], max_length=32)),
                ('entity_type', models.CharField(max_length=64)),
                ('entity_id', models.CharField(blank=True, max_length=64)),
                ('description', models.TextField(blank=True)),
                ('created_at', models.DateTimeField(auto_now_add=True)),
                ('actor', models.ForeignKey(blank=True, null=True, on_delete=django.db.models.deletion.SET_NULL, related_name='audit_actions', to='users.user')),
            ],
            options={
                'ordering': ['-created_at'],
            },
        ),
    ]
