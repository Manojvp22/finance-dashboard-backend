from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('users', '0003_password_reset_tokens'),
    ]

    operations = [
        migrations.AlterField(
            model_name='user',
            name='role',
            field=models.CharField(choices=[('viewer', 'User'), ('analyst', 'Analyst'), ('admin', 'Admin')], max_length=10),
        ),
    ]
