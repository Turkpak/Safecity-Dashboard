from ..common_imports import *

class ListDivisionView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Area Management"
    sub_label = "Division"
    def list(self, request, *args, **kwargs):
        try:
            division_id = request.query_params.get("id")
            province_id = request.query_params.get("province")

            # Case 1: Get single division by ID
            if division_id:
                division = Division.objects.filter(id=division_id).first()
                if not division:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Division not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = DivisionSerializer(division)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Division Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            # Case 2: Filter by province
            elif province_id:
                divisions = Division.objects.filter(province_id=province_id)
                if not divisions.exists():
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="No divisions found for this province.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = DivisionSerializer(divisions, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Divisions Found for the Province.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            # Case 3: Return all divisions
            else:
                divisions = Division.objects.all()
                serializer = DivisionSerializer(divisions, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All Divisions Found.",
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
