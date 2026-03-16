from ..common_imports import *

class DeleteProjectProgressDocumentView(viewsets.ViewSet):
    queryset = ProjectProgressDocument.objects.all()
    serializer_class = ProjectProgressDocumentSerializer
    permission_classes = [AllowAny]

    def destroy(self, request, *args, **kwargs):
        doc_id = kwargs.get('pk')
        try:
            doc = ProjectProgressDocument.objects.get(id=doc_id)
        except ProjectProgressDocument.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Progress document not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            doc.delete()
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Progress document deleted successfully.",
                http_status=status.HTTP_200_OK
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()
