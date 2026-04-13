from ..common_imports import *
from rest_framework import viewsets, status
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from api.models import ProjectDocument
from api.serializers import ProjectDocumentSerializer

# Custom pagination class
class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10  # default page size
    page_size_query_param = "page_size"
    max_page_size = 100

class ListProjectDocumentView(viewsets.ViewSet):
    """
    ViewSet to list Project Documents.
    Optional query params:
        ?project=1       → filter by project ID
        ?activity=2      → filter by activity ID
        ?page=1          → pagination
        ?page_size=10    → custom page size
    """

    pagination_class = StandardResultsSetPagination

    def list(self, request):
        # Get query params
        project_id = request.query_params.get("project")
        activity_id = request.query_params.get("activity")

        # Base queryset
        queryset = ProjectDocument.objects.all().order_by("-uploaded_at")

        # Apply filters if present
        if project_id:
            queryset = queryset.filter(project_id=project_id)
        if activity_id:
            queryset = queryset.filter(activity_id=activity_id)

        # Apply pagination
        paginator = self.pagination_class()
        page = paginator.paginate_queryset(queryset, request)
        serializer = ProjectDocumentSerializer(
            page, many=True, context={"request": request}
        )

        return paginator.get_paginated_response({
            "success": True,
            "data": serializer.data
        })