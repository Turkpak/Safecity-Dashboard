from ..common_imports import *
from django.shortcuts import get_object_or_404

class UpdateTaskActualView(APIView):
    def post(self, request, task_id):
        task = get_object_or_404(ProjectActivity, id=task_id)

        task.actual_start = request.data.get("actual_start")
        task.actual_end = request.data.get("actual_end")
        task.progress = request.data.get("progress", task.progress)
        task.remarks = request.data.get("remarks")

        task.save()

        return Response({
            "status": True,
            "message": "Task updated successfully"
        })