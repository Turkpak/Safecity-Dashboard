from ..common_imports import *

class ActivityDelayLogListView(APIView):

    def get(self, request):
        project_id = request.query_params.get("project")
        activity_id = request.query_params.get("activity")

        queryset = ActivityDelayLog.objects.all().order_by("-created_at")

        if project_id:
            queryset = queryset.filter(project_id=project_id)

        if activity_id:
            queryset = queryset.filter(activity_id=activity_id)

        serializer = ActivityDelayLogSerializer(queryset, many=True)

        return Response({
            "count": queryset.count(),
            "data": serializer.data
        })