# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from api.models import Project, ProjectActivity, TaskDependency
from django.shortcuts import get_object_or_404
class ProjectGanttNestedView(APIView):

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)

        activities = ProjectActivity.objects.filter(project=project)\
            .select_related('parent')\
            .order_by('id')   # ✅ keep original insert order

        # -----------------------------
        # STEP 1: group children
        # -----------------------------
        children_map = {}

        for act in activities:
            parent_id = act.parent_id or 0
            children_map.setdefault(parent_id, []).append(act)

        # -----------------------------
        # STEP 2: recursive builder
        # -----------------------------
        def build_tree(parent_id=0, prefix=""):
            nodes = []

            children = children_map.get(parent_id, [])

            for index, act in enumerate(children, start=1):
                new_id = f"{prefix}{index}" if prefix else str(index)

                node = {
                    "_id": new_id,   # ✅ GENERATED HIERARCHICAL ID
                    "id": act.id,     # ✅ DB ID (needed for updates)
                    "activity_id": act.activity_id,
                    "name": act.activity_name,
                    "duration": act.duration or 0,
                    "start_date": act.start_date.isoformat() if act.start_date else None,
                    "end_date": act.end_date.isoformat() if act.end_date else None,
                    "progress": act.progress or 0,
                    "actual_start": act.actual_start.isoformat() if act.actual_start else None,
                    "actual_end": act.actual_end.isoformat() if act.actual_end else None,
                    "subtasks": build_tree(act.id, new_id)
                }

                nodes.append(node)

            return nodes

        # -----------------------------
        # STEP 3: build full tree
        # -----------------------------
        root_tasks = build_tree()

        # -----------------------------
        # STEP 4: project summary
        # -----------------------------
        all_start = [a.start_date for a in activities if a.start_date]
        all_end = [a.end_date for a in activities if a.end_date]

        start_date = min(all_start).isoformat() if all_start else None
        end_date = max(all_end).isoformat() if all_end else None

        duration = 0
        if all_start and all_end:
            duration = (max(all_end) - min(all_start)).days

        schedule = {
            "_id": str(project.id),
            "project": project.project_reference_no or "",
            "project_name": project.project_name,
            "start_date": start_date,
            "end_date": end_date,
            "duration": duration,
            "schedulePercentageComplete": 0,
            "performancePercentageComplete": 0,
            "tasks": root_tasks
        }

        return Response({
            "success": True,
            "schedules": [schedule]
        })