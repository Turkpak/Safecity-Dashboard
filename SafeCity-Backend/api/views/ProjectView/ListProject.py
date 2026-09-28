from ..common_imports import *

class ListProjectView(viewsets.ViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Project Management"
    sub_label = "View" 
    
    def list(self, request, *args, **kwargs):
        try:
            project_id = request.query_params.get("id")

            if project_id:
                queryset = Project.objects.select_related(
                    "province", "division", "district", "tehsil"
                ).prefetch_related(
                    "stakeholder", "activities"
                ).filter(id=project_id).first()
                if not queryset:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Project not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = ProjectSerializer(queryset)   # full detail — unchanged
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Project Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            else:
                queryset = Project.objects.select_related(
                    "province", "division", "district", "tehsil"
                ).prefetch_related(
                    "stakeholder"          # dropped "activities" — list view doesn't need it
                ).all()
                serializer = ProjectListSerializer(queryset, many=True)   # ← lightweight serializer
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All Projects Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
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
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()