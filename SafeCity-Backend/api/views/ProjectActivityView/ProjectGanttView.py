from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..common_imports import *
from api.models import Project, ProjectActivity
from api.serializers import TaskSerializer  # import your serializer

from api.models import TaskDependency

class ProjectGanttView(APIView):

    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)

            activities = ProjectActivity.objects.filter(project=project)
            serializer = TaskSerializer(activities, many=True)

            dependencies = TaskDependency.objects.filter(project=project)

            dep_data = [
                {
                    "id": d.id,
                    "source": d.predecessor.id,
                    "target": d.task.id,
                    "type": d.type
                }
                for d in dependencies
            ]

            return Response({
                "status": True,
                "tasks": serializer.data,
                "links": dep_data   # 🔥 important for arrows
            })

        except Exception as e:
            return Response({
                "status": False,
                "message": str(e)
            })