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

        # ✅ manually assign values
        obj.progress = request.data.get("progress", obj.progress)

        if request.data.get("actual_start"):
            obj.actual_start = request.data.get("actual_start")

        if "actual_end" in request.data:
            obj.actual_end = request.data.get("actual_end")

        # ✅ ADD THIS (YOU MISSED THIS)
        if request.data.get("progress_date"):
            obj.progress_date = request.data.get("progress_date")

        obj.save()

        serializer = ProjectActivitySerializer(obj)
        return Response(serializer.data)