from ..common_imports import *


class ProgressImageCreateViewSet(viewsets.ModelViewSet):
    queryset = ProgressImage.objects.all()
    serializer_class = ProgressImageSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            activity = serializer.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Project activity image created successfully.",
                data=ProgressImageSerializer(activity).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Error creating activity image.",
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()