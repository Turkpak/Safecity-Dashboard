from ..common_imports import *
from django.shortcuts import get_object_or_404

from api.quantity import QuantityError, apply_quantity_and_progress, quantity_payload


class UpdateTaskActualView(APIView):
    permission_classes = [HasSidebarPermission]
    sidebar_label = "Citywise Progress"
    sub_label = None

    def post(self, request, task_id):
        task = get_object_or_404(ProjectActivity, id=task_id)
        data = request.data

        try:
            apply_quantity_and_progress(task, data)
        except QuantityError as e:
            return Response(
                {"status": False, "message": str(e), "data": {e.field: [str(e)]}},
                status=400,
            )

        # Only overwrite fields that were actually sent
        if "actual_start" in data:
            task.actual_start = data.get("actual_start") or None
        if "actual_end" in data:
            task.actual_end = data.get("actual_end") or None
        if "remarks" in data:
            task.remarks = data.get("remarks")
        if "progress_date" in data:
            task.progress_date = data.get("progress_date") or None

        task.save()

        return Response({
            "status": True,
            "message": "Task updated successfully",
            "data": {"progress": task.progress, **quantity_payload(task)},
        })