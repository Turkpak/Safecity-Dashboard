from ..common_imports import *

class ListTehsilView(viewsets.ViewSet):
    queryset = Tehsil.objects.all()
    serializer_class = TehsilSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Area Management"
    sub_label = "Tehsil"

    def list(self, request, *args, **kwargs):
        try:
            tehsil_id = request.query_params.get("id")
            district_id = request.query_params.get("district")

            if tehsil_id:
                queryset = Tehsil.objects.filter(id=tehsil_id).first()
                if not queryset:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Tehsil not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = TehsilSerializer(queryset)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Tehsil Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            elif district_id:
                tehsils = Tehsil.objects.filter(district_id=district_id)
                if not tehsils.exists():
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="No tehsils found for this district.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = TehsilSerializer(tehsils, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Tehsils Found for the District.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            else:
                queryset = Tehsil.objects.all()
                serializer = TehsilSerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All Tehsils Found.",
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