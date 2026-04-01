from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from api.models import ProjectActivity
from api.serializers import ProjectActivitySerializer

class ProjectActivityUpdateView(viewsets.ViewSet):

    def update(self, request, pk=None):
        try:
            obj = ProjectActivity.objects.get(pk=pk)
        except ProjectActivity.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        serializer = ProjectActivitySerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=400)