from ..common_imports import *
from django.shortcuts import get_object_or_404


class UpdateTaskActualView(APIView):
    permission_classes = [HasSidebarPermission]
    sidebar_label = "Citywise Progress"
    sub_label = None

    def post(self, request, task_id):
        task = get_object_or_404(ProjectActivity, id=task_id)

        # Only overwrite fields that were actually sent — otherwise POSTing
        # just {"progress": 40} would null out actual_start/actual_end/remarks
        # on every save.
        if "actual_start" in request.data:
            task.actual_start = request.data.get("actual_start")
        if "actual_end" in request.data:
            task.actual_end = request.data.get("actual_end")
        if "progress" in request.data:
            task.progress = request.data.get("progress", task.progress)
        if "remarks" in request.data:
            task.remarks = request.data.get("remarks")
        if "progress_date" in request.data:
            task.progress_date = request.data.get("progress_date")

        task.save()

        return Response({
            "status": True,
            "message": "Task updated successfully"
        })