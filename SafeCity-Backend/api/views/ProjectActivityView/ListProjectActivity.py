from ..common_imports import *
from rest_framework.decorators import action

class ListProjectActivityView(viewsets.ViewSet):
    def list(self, request):
        project_id = request.query_params.get("project")
        if project_id:
            activities = ProjectActivity.objects.filter(project_id=project_id)

            # if no activities exist yet try re-parsing the XER file so that
            # newly-uploaded projects populate automatically
            if not activities.exists():
                from ...models import Project
                try:
                    proj = Project.objects.get(id=project_id)
                    if proj.xer_file:
                        proj.parse_xer_file()
                        activities = ProjectActivity.objects.filter(project_id=project_id)
                except Project.DoesNotExist:
                    pass
        else:
            activities = ProjectActivity.objects.none()
        serializer = ProjectActivitySerializer(activities, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='gantt-data')
    def gantt_data(self, request):
        """Return Gantt tasks parsed directly from the project's XER file.

        This endpoint is used by the frontend for charting; it ignores any
        existing ProjectActivity rows and simply returns whatever the parser
        extracts from the attached XER.  Query parameter name is `project`.
        """
        project_id = request.query_params.get("project")
        if not project_id:
            return Response(
                {"status": False, "message": "project parameter is required", "tasks": []},
                status=status.HTTP_400_BAD_REQUEST,
            )
        try:
            result = get_xer_gantt_data(int(project_id))
            return Response({"status": True, "tasks": result.get("tasks", []), "message": result.get("message")})
        except ValueError as e:
            return Response({"status": False, "message": str(e), "tasks": []}, status=status.HTTP_400_BAD_REQUEST)
        except Exception as e:
            return Response({"status": False, "message": str(e), "tasks": []}, status=status.HTTP_500_INTERNAL_SERVER_ERROR)