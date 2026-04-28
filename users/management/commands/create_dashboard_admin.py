from django.core.management.base import BaseCommand, CommandError
from getpass import getpass
from users.models import User


class Command(BaseCommand):
    help = 'Create or update a Finance Dashboard admin login.'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--name', default='Dashboard Admin')
        parser.add_argument('--password')

    def handle(self, *args, **options):
        email = options['email'].strip().lower()
        name = options['name'].strip()
        password = options.get('password') or getpass('Password: ')

        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters long.')

        user, created = User.objects.get_or_create(
            email=email,
            defaults={
                'name': name,
                'role': 'admin',
                'status': True,
            },
        )

        user.name = user.name or name
        user.role = 'admin'
        user.status = True
        user.set_password(password)
        user.save()

        action = 'Created' if created else 'Updated'
        self.stdout.write(self.style.SUCCESS(f'{action} dashboard admin login for {user.email}.'))
