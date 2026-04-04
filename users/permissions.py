from rest_framework.permissions import BasePermission

class RolePermission(BasePermission):

    def has_permission(self, request, view):
        user_role = request.headers.get('Role')

        if view.basename == 'records':
            if request.method in ['GET']:
                return user_role in ['analyst', 'admin']
            return user_role == 'admin'

        if view.basename == 'users':
            return user_role == 'admin'

        return True