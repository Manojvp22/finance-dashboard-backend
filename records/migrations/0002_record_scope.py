from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('records', '0001_initial'),
    ]

    operations = [
        migrations.AddField(
            model_name='record',
            name='scope',
            field=models.CharField(choices=[('personal', 'Personal'), ('team', 'Team')], default='personal', max_length=12),
        ),
    ]
