from ..common_imports import *
from django.db.models import Avg

class TopProjectsView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        try:
            limit = int(request.query_params.get("limit", 6))
            division_id = request.query_params.get("division_id")

            queryset = Project.objects.select_related("division")

            # ✅ Filter by division
            if division_id:
                queryset = queryset.filter(division_id=division_id)

            # ✅ 🔥 CALCULATE PROGRESS FROM ACTIVITIES
            queryset = queryset.annotate(
                progress=Avg('activities__progress')
            )

            # ✅ Order by calculated progress
            queryset = queryset.order_by('-progress')

            # ✅ LIMIT
            queryset = queryset[:limit]

            serializer = TopProjectSerializer(queryset, many=True)

            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Top projects fetched successfully.",
                data=serializer.data,
                http_status=status.HTTP_200_OK
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Error fetching top projects.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()