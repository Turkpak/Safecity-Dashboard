from ..common_imports import *

class DistrictDeleteView(viewsets.ViewSet):
    queryset = District.objects.all()
    serializer_class = DistrictSerializer
    permission_classes = [AllowAny]

    def destroy(self, request, *args, **kwargs):
        district_id = kwargs.get('pk')

        try:
            mydistrict = District.objects.get(id=district_id)
        except District.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="District not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()       
        try:
            mydistrict.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="District deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()
        
        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this District because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except IntegrityError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this District because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
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
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()