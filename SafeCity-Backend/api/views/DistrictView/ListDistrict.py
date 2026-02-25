from ..common_imports import *

class ListDistrictView(viewsets.ViewSet):
    queryset = District.objects.all()
    serializer_class = DistrictSerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        try:
            district_id = request.query_params.get("id")
            division_id = request.query_params.get("division")

            if district_id:
                district = District.objects.filter(id=district_id).first()
                if not district:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="District not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = DistrictSerializer(district)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="District Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            elif division_id:
                districts = District.objects.filter(division_id=division_id)
                if not districts.exists():
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="No districts found for this division.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = DistrictSerializer(districts, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Districts Found for the Division.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            else:
                queryset = District.objects.all()
                serializer = DistrictSerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All District Found.",
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