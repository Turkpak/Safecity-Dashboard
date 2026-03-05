from rest_framework.permissions import BasePermission
from .models import UserPermission

class HasSidebarPermission(BasePermission):

    def has_permission(self, request, view):

        # super_admin can do everything
        if request.user.role == "super_admin":
            return True

        # Get top-level menu label and optional sub-menu label from the view
        sidebar_label = getattr(view, "sidebar_label", None)
        sub_label = getattr(view, "sub_label", None)  # New: sub-menu

        if not sidebar_label:
            return False

        # Query permission with optional sub_label
        permission = UserPermission.objects.filter(
            user=request.user,
            sidebar_label=sidebar_label,
            sub_label=sub_label  # This distinguishes District / Province etc.
        ).first()

        if not permission:
            return False

        # Map HTTP methods to permission fields
        if request.method == "GET":
            return permission.can_view
        elif request.method == "POST":
            return permission.can_create
        elif request.method in ["PUT", "PATCH"]:
            return permission.can_update
        elif request.method == "DELETE":
            return permission.can_delete

        return False