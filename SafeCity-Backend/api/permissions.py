from rest_framework.permissions import BasePermission
from .models import UserPermission

class HasSidebarPermission(BasePermission):
    def has_permission(self, request, view):
        if not request.user or not request.user.is_authenticated:
            return False  # currently missing — would crash on AnonymousUser.role

        role = str(getattr(request.user, "role", "") or "").strip().lower().replace(" ", "_")
        if role == "super_admin" or request.user.is_superuser:
            return True

        sidebar_label = getattr(view, "sidebar_label", None)
        sub_label = getattr(view, "sub_label", None)

        if not sidebar_label:
            return False

        permission = UserPermission.objects.filter(
            user=request.user,
            sidebar_label=sidebar_label,
            sub_label=sub_label
        ).first()

        if not permission:
            return False

        if request.method == "GET":
            if permission.can_view:
                return True
            fallback_label = getattr(view, "get_permission_fallback_label", None)
            fallback_sub_label = getattr(view, "get_permission_fallback_sub_label", None)
            if fallback_label:
                fallback = UserPermission.objects.filter(
                    user=request.user,
                    sidebar_label=fallback_label,
                    sub_label=fallback_sub_label,
                ).first()
                return bool(fallback and fallback.can_create)
            return False
        elif request.method == "POST":
            return permission.can_create
        elif request.method in ["PUT", "PATCH"]:
            return permission.can_update or (
                getattr(view, "allow_create_for_update", False) and permission.can_create
            )
        elif request.method == "DELETE":
            return permission.can_delete

        return False