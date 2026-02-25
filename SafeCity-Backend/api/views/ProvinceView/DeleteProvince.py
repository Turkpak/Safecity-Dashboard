from ...utils import ApiResponse
from rest_framework import viewsets, status, serializers
from rest_framework.permissions import AllowAny
from ...models import *
from ...serializers import *
from django.db import IntegrityError
from django.db.models import ProtectedError

class ProvinceDeleteView(viewsets.ViewSet):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    permission_classes = [AllowAny]

    def destroy(self, request, *args, **kwargs):
        province_id = kwargs.get('pk')

        try:
            myprovince = Province.objects.get(id=province_id)
        except Province.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Province not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()       
        try:
            myprovince.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Province deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()
        except ProtectedError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Province because it is linked to other records.",
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        except IntegrityError:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Cannot delete this Province because it is linked to other records.",
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