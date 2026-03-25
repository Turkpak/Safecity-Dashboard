# views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from api.models import Project, ProjectActivity, TaskDependency
from django.shortcuts import get_object_or_404

class ProjectGanttNestedView(APIView):
    """
    Returns a project Gantt in the nested 'schedules -> tasks -> subtasks' format
    """

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)

        activities = ProjectActivity.objects.filter(project=project).select_related('parent')
        
        # Step 1: build a dict {id: activity_dict}
        activity_dict = {}
        for act in activities:
            activity_dict[act.id] = {
                "_id": str(act.id),
                "name": act.activity_name,
                "duration": act.duration or 0,
                "start_date": act.start_date.isoformat() if act.start_date else None,
                "end_date": act.end_date.isoformat() if act.end_date else None,
                "subtasks": []
            }

        # Step 2: attach children to parent
        root_tasks = []
        for act in activities:
            if act.parent_id:
                parent = activity_dict.get(act.parent_id)
                if parent:
                    parent["subtasks"].append(activity_dict[act.id])
            else:
                root_tasks.append(activity_dict[act.id])

        # Step 3: build schedule
        schedule = {
            "_id": str(project.id),
            "project": project.project_reference_no or "",
            "project_name": project.project_name,
            "start_date": project.project_starting_date.isoformat() if project.project_starting_date else None,
            "end_date": None,
            "duration": 0,
            "schedulePercentageComplete": 0,  # you can calculate
            "performancePercentageComplete": 0,  # you can calculate
            "tasks": root_tasks
        }

        # optional: calculate project end_date and duration
        all_dates = [a.end_date for a in activities if a.end_date]
        all_start_dates = [a.start_date for a in activities if a.start_date]
        if all_dates and all_start_dates:
            schedule["end_date"] = max(all_dates).isoformat()
            schedule["start_date"] = min(all_start_dates).isoformat()
            schedule["duration"] = (max(all_dates) - min(all_start_dates)).days

        return Response({
            "success": True,
            "schedules": [schedule]
        })