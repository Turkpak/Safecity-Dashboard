from ..common_imports import *

class TehsilCreateView(viewsets.ViewSet):
    queryset = Tehsil.objects.all()
    serializer_class = TehsilSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Area Management"
    sub_label = "Tehsil"

    def create(self, request, *args, **kwargs):
        data = request.data
        try:
            serializer = TehsilSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            mytehsil = Tehsil(
                province=serializer.validated_data['province'],
                division=serializer.validated_data['division'],
                district=serializer.validated_data['district'],
                tehsil_name=serializer.validated_data['tehsil_name'],
            )
            mytehsil.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Tehsil created successfully.",
                data=TehsilSerializer(mytehsil).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except IntegrityError as e:
            error_msg = str(e)
            if 'tehsil_name' in error_msg:
                duplicate_detail = {'tehsil_name': ['This tehsil already exists.']}
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
