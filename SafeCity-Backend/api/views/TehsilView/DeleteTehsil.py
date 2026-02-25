from ..common_imports import *

class TehsilDeleteView(viewsets.ViewSet):
    queryset = Tehsil.objects.all()
    serializer_class = TehsilSerializer
    permission_classes = [AllowAny]

    def destroy(self, request, *args, **kwargs):
        tehsil_id = kwargs.get('pk')

        try:
            mytehsil = Tehsil.objects.get(id=tehsil_id)
        except Tehsil.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Tehsil not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()       
        try:
            mytehsil.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Tehsil deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()
        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Tehsil because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except IntegrityError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Tehsil because it is linked to other records.",
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