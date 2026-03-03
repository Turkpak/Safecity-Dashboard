from ..common_imports import *


class ProjectActivityCreateView(viewsets.ModelViewSet):
    queryset = ProjectActivity.objects.all()
    serializer_class = ProjectActivitySerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        try:
            serializer = self.get_serializer(data=request.data)
            serializer.is_valid(raise_exception=True)
            activity = serializer.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Project activity created successfully.",
                data=ProjectActivitySerializer(activity).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Error creating activity.",
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()