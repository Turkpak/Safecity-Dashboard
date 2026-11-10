from django.db import IntegrityError, transaction
from django.db.models import ProtectedError

from api.utils import safe_error_data
from ..common_imports import *


def get_linked_counts(obj):
    """Count the rows in every table that still point to this object."""
    counts = {}
    for rel in obj._meta.related_objects:
        n = rel.related_model._base_manager.filter(**{rel.field.name: obj}).count()
        if n:
            counts[str(rel.related_model._meta.verbose_name_plural)] = n
    return counts


class StakeholderDeleteView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasSidebarPermission]

    def destroy(self, request, *args, **kwargs):
        try:
            stakeholder = Stakeholder.objects.get(id=kwargs.get('pk'))
        except (Stakeholder.DoesNotExist, ValueError, TypeError):
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Stakeholder not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        linked = get_linked_counts(stakeholder)
        if linked:
            summary = ", ".join(f"{n} {name}" for name, n in linked.items())
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message=(f"Cannot delete this stakeholder because it is still used by: {summary}. "
                         "Disable it instead, or remove those links first."),
                data={"linked": linked},
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        try:
            with transaction.atomic():
                stakeholder.delete()
        except (ProtectedError, IntegrityError):
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this stakeholder because other records still depend on it.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Server error.",
                data=safe_error_data(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()

        return ApiResponse(
            status=status.HTTP_200_OK,
            message="Stakeholder deleted successfully.",
            http_status=status.HTTP_200_OK
        ).create_response()