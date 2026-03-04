from ..common_imports import *

class ProvinceCreateView(viewsets.ViewSet):
    queryset = Province.objects.all()
    serializer_class = ProvinceSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Area Management"
    sub_label = "Province"

    def create(self, request, *args, **kwargs):
        data = request.data

        try:
            
            serializer = ProvinceSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            myprovince = Province(
                province_name=serializer.validated_data['province_name'],
            )
            myprovince.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Province created successfully.",
                data=ProvinceSerializer(myprovince).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except IntegrityError as e:
            error_msg = str(e)
            duplicate_detail = {}
            if 'province_name' in error_msg:
                duplicate_detail = {'': ['This province already exists.']}
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
