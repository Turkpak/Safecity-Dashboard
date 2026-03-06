from api.utils import parse_xer
from ..common_imports import *

class ProjectGanttView(APIView):

    def get(self, request, project_id):
        try:
            project = Project.objects.get(id=project_id)
            
            if not project.xer_file:
                return Response({
                    "status": False,
                    "message": "No XER file found for this project."
                }, status=status.HTTP_400_BAD_REQUEST)

            activities = parse_xer(project.xer_file.path)

            return Response({
                "status": True,
                "data": activities
            })

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