from ..common_imports import *

class ProjectActivityDeleteView(viewsets.ViewSet):
    queryset = ProjectActivity.objects.all()
    serializer_class = ProjectActivitySerializer
    permission_classes = [AllowAny]

    def destroy(self, request, *args, **kwargs):
        activity_id = kwargs.get('pk')

        try:
            activity = ProjectActivity.objects.get(id=activity_id)
        except ProjectActivity.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Project Activity not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()       
        try:
            activity.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Project Activity deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()
        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Project Activity because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except IntegrityError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Project Activity because it is linked to other records.",
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