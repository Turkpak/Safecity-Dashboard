from ..common_imports import *

class DistrictCreateView(viewsets.ViewSet):
    queryset = District.objects.all()
    serializer_class = DistrictSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Area Management"
    sub_label = "District"

    def create(self, request, *args, **kwargs):
        data = request.data
        try:
            serializer = DistrictSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            mydistrict = District(
                province=serializer.validated_data['province'],
                division=serializer.validated_data['division'],
                district_name=serializer.validated_data['district_name'],
            )
            mydistrict.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="District created successfully.",
                data=DistrictSerializer(mydistrict).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except IntegrityError as e:
            error_msg = str(e)
            if 'district_name' in error_msg:
                duplicate_detail = {'district_name': ['This district already exists.']}
            else:
                duplicate_detail = {'detail': ['Duplicate entry error.']}

            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Duplicate entry error.",
                data=duplicate_detail,
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
                status=status.HTTP_400_BAD_REQUEST,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
