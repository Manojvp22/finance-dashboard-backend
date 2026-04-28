from django.core.management.base import BaseCommand, CommandError
from getpass import getpass
from users.models import User


class Command(BaseCommand):
    help = 'Set a password for an existing finance dashboard user.'

    def add_arguments(self, parser):
        parser.add_argument('email')
        parser.add_argument('--password')

    def handle(self, *args, **options):
        email = options['email']
        password = options.get('password') or getpass('Password: ')

        if len(password) < 8:
            raise CommandError('Password must be at least 8 characters long.')

        user = User.objects.filter(email__iexact=email).first()
        if not user:
            raise CommandError(f'No user found with email {email}.')

        user.set_password(password)
        user.save(update_fields=['password_hash'])
        self.stdout.write(self.style.SUCCESS(f'Password updated for {user.email}.'))
