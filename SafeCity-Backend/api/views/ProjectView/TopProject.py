from ..common_imports import *
from django.db.models import Avg, FloatField, Value
from django.db.models.functions import Coalesce

class TopProjectsView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        try:
            limit = int(request.query_params.get("limit", 6))
            division_id = request.query_params.get("division_id")

            queryset = Project.objects.select_related("division")

            # ✅ Filter
            if division_id:
                queryset = queryset.filter(division_id=division_id)

            # ✅ Calculate average safely
            queryset = queryset.annotate(
                progress=Coalesce(
                    Avg('activities__progress'),
                    Value(0),
                    output_field=FloatField()
                )
            )

            # ✅ 🔥 Convert to percentage (IMPORTANT FIX)
            for obj in queryset:
                obj.progress = round((obj.progress or 0) * 100, 2)

            # ✅ Order
            queryset = sorted(queryset, key=lambda x: x.progress, reverse=True)

            # ✅ Limit
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