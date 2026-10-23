from api.utils import safe_error_data
from ..common_imports import *


class ProjectDocumentCreateView(viewsets.ModelViewSet):
    queryset = ProjectDocument.objects.all()
    serializer_class = ProjectDocumentSerializer
    permission_classes = [HasSidebarPermission]
    sidebar_label = "Citywise Progress"
    sub_label = None

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            document = serializer.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Project document created successfully.",
                data=serializer.data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Error creating document.",
                data=safe_error_data(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()