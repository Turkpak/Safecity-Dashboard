from ..common_imports import *

class IsSuperAdmin(permissions.BasePermission):
    def has_permission(self, request, view):
        return request.user.role == "super_admin"

class UserPermissionViewSet(viewsets.ModelViewSet):
    serializer_class = UserPermissionSerializer
    permission_classes = [permissions.IsAuthenticated, IsSuperAdmin]

    def get_queryset(self):
        """
        Superadmin should see all user permissions except their own,
        so they can manage other users.
        """
        return UserPermission.objects.exclude(user=self.request.user)

    def list(self, request, *args, **kwargs):
        """
        Custom list to show all users and their permissions.
        """
        # Get all users except superadmin itself
        users = MyUser.objects.exclude(id=request.user.id)
        data = []

        for user in users:
            permissions = UserPermission.objects.filter(user=user)
            perm_serializer = UserPermissionSerializer(permissions, many=True)
            data.append({
                "user_id": user.id,
                "full_name": user.get_full_name(),
                "email": user.email,
                "role": user.role,
                "permissions": perm_serializer.data
            })

        return Response(data)

    def perform_create(self, serializer):
        serializer.save(created_by=self.request.user)

    def perform_update(self, serializer):
        serializer.save(updated_by=self.request.user)