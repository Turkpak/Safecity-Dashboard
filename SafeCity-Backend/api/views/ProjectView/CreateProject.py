from ..common_imports import *

class ProjectCreateView(viewsets.ViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Project Management"
    sub_label = "Create"

    def create(self, request, *args, **kwargs):
        try:
            serializer = ProjectSerializer(data=request.data)
            serializer.is_valid(raise_exception=True)

            project = serializer.save()   

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Project created successfully.",
                data=ProjectSerializer(project).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except serializers.ValidationError as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Serializer error.",
                data=e.detail,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()