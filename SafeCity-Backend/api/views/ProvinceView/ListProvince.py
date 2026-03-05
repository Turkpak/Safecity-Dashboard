from ..common_imports import *

class ListProvinceView(viewsets.ViewSet):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Area Management"
    sub_label = "Province"

    def list(self, request, *args, **kwargs):
        try:
            province_id = request.query_params.get("id")

            if province_id:
                queryset = Province.objects.filter(id=province_id).first()
                if not queryset:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Province not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = ProvinceSerializer(queryset)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Province Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            else:
                queryset = Province.objects.all()
                serializer = ProvinceSerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All Provinces Found.",
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