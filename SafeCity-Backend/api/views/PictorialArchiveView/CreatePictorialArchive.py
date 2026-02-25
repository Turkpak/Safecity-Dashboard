from ..common_imports import *

class PictorialArchiveCreateView(viewsets.ViewSet):
    queryset = PictorialArchive.objects.all()
    serializer_class = PictorialArchiveSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data

        try:
            serializer = PictorialArchiveSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            pictorial = PictorialArchive(
                project=serializer.validated_data['project'],
                image=serializer.validated_data['image'],
                image_date=serializer.validated_data['image_date'],
                description=serializer.validated_data.get('description')
            )
            pictorial.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Pictorial archive created successfully.",
                data=PictorialArchiveSerializer(pictorial).data,
                http_status=status.HTTP_201_CREATED
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
            