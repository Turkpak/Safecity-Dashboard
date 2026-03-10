# from api.utils import parse_xer
# from ..common_imports import *

# class ProjectGanttView(APIView):

#     def get(self, request, project_id):
#         try:
#             project = Project.objects.get(id=project_id)
            
#             if not project.xer_file:
#                 return Response({
#                     "status": False,
#                     "message": "No XER file found for this project."
#                 }, status=status.HTTP_400_BAD_REQUEST)

#             activities = parse_xer(project.xer_file.path)

#             return Response({
#                 "status": True,
#                 "data": activities
#             })

#         except Project.DoesNotExist:
#             return Response({
#                 "status": False,
#                 "message": "Project not found."
#             }, status=status.HTTP_404_NOT_FOUND)

#         except Exception as e:
#             return Response({
#                 "status": False,
#                 "message": str(e)
#             }, status=status.HTTP_400_BAD_REQUEST)

from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status
from ..common_imports import *
from api.models import Project, ProjectActivity


class ProjectGanttView(APIView):

    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)

            activities = ProjectActivity.objects.filter(project=project).values(
                "id",
                "activity_id",
                "activity_name",
                "parent_id",
                "start_date",
                "end_date",
                "progress"
            )

            return Response({
                "status": True,
                "data": list(activities)
            }, status=status.HTTP_200_OK)

        except Project.DoesNotExist:
            return Response({
                "status": False,
                "message": "Project not found."
            }, status=status.HTTP_404_NOT_FOUND)

        except Exception as e:
            return Response({
                "status": False,
                "message": str(e)
            }, status=status.HTTP_400_BAD_REQUEST)