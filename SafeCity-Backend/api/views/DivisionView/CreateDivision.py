from ..common_imports import *

class DivisionCreateView(viewsets.ViewSet):
    queryset = Division.objects.all()
    serializer_class = DivisionSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Area Management"
    sub_label = "Division"
    def create(self, request, *args, **kwargs):
        data = request.data
        try:
            serializer = DivisionSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            mydivision = Division(
                province=serializer.validated_data['province'],
                division_name=serializer.validated_data['division_name'],
            )
            mydivision.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Division created successfully.",
                data=DivisionSerializer(mydivision).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except IntegrityError as e:
            error_msg = str(e)
            if 'division_name' in error_msg:
                duplicate_detail = {'division_name': ['This division already exists.']}
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
