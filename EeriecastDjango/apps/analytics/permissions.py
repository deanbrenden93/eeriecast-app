from rest_framework.permissions import BasePermission


class IsStaffSuperuser(BasePermission):
    """
    Allow access only to authenticated users who are BOTH `is_staff` and
    `is_superuser`. Admin analytics include revenue, personally
    identifying aggregates, and full-site totals — so we gate them
    beyond plain `IsAdminUser` (which only checks `is_staff`).
    """

    message = "Admin analytics require a staff superuser account."

    def has_permission(self, request, view):
        user = getattr(request, "user", None)
        if user is None or not user.is_authenticated:
            return False
        return bool(user.is_staff and user.is_superuser)
