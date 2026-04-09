from ..common_imports import *
from rest_framework import viewsets, status
from rest_framework.response import Response
from api.models import ProjectDocument
from api.serializers import ProjectDocumentSerializer


class UpdateProjectDocumentView(viewsets.ViewSet):

    def update(self, request, pk=None):
        try:
            document = ProjectDocument.objects.get(pk=pk)
        except ProjectDocument.DoesNotExist:
            return Response(
                {"success": False, "message": "Document not found."},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ProjectDocumentSerializer(
            document,
            data=request.data,
            partial=True
        )

        if serializer.is_valid():
            serializer.save()
            return Response(
                {
                    "success": True,
                    "message": "Document updated successfully.",
                    "data": serializer.data
                },
                status=status.HTTP_200_OK
            )

        return Response(
            {
                "success": False,
                "errors": serializer.errors
            },
            status=status.HTTP_400_BAD_REQUEST
        )