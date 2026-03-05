from ..common_imports import *

class ProjectDeleteView(viewsets.ViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Project Management"

    def destroy(self, request, *args, **kwargs):
        project_id = kwargs.get('pk')

        try:
            myproject = Project.objects.get(id=project_id)
        except Province.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Project not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()       
        try:
            myproject.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Project deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()
        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Project because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except IntegrityError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Project because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        
        except serializers.ValidationError as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()