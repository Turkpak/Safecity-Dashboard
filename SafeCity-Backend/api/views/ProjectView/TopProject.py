from collections import defaultdict
from ..common_imports import *

class TopProjectsView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated]

    def list(self, request):
        try:
            limit = int(request.query_params.get("limit", 6))
            division_id = request.query_params.get("division_id")

            queryset = Project.objects.select_related("division")

            if division_id:
                queryset = queryset.filter(division_id=division_id)

            projects = list(queryset)

            for project in projects:
                activities = list(
                    ProjectActivity.objects.filter(project=project)
                    .only("id", "parent_id", "progress", "duration", "start_date", "end_date")
                )

                project.progress = round(self._calc_project_progress(activities), 2)

            projects = sorted(projects, key=lambda x: x.progress, reverse=True)[:limit]

            serializer = TopProjectSerializer(projects, many=True)

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

    def _calc_project_progress(self, activities):
        if not activities:
            return 0

        from collections import defaultdict
        from datetime import datetime

        tree = defaultdict(list)
        ROOT = 0

        # Build tree
        for a in activities:
            parent_id = a.parent_id or 0
            tree[parent_id].append(a)

        def normalize(p):
            if p is None:
                return 0
            return p * 100 if p <= 1 else p

        def calc(node):
            children = tree.get(node.id, [])

            # ---------- LEAF ----------
            if not children:
                return {
                    "progress": normalize(node.progress),
                    "start": node.start_date,
                    "end": node.end_date
                }

            # ---------- CHILDREN ----------
            child_results = [calc(c) for c in children]

            # 🔥 SAME AS GANTT: recompute duration from dates
            start_dates = [c["start"] for c in child_results if c["start"]]
            end_dates = [c["end"] for c in child_results if c["end"]]

            if start_dates and end_dates:
                start = min(start_dates)
                end = max(end_dates)
                duration = (end - start).days + 1
            else:
                duration = 0

            total_weight = 0
            weighted_sum = 0

            for c, res in zip(children, child_results):
                # fallback duration
                d = (res["end"] - res["start"]).days + 1 if res["start"] and res["end"] else (c.duration or 1)

                weighted_sum += res["progress"] * d
                total_weight += d

            avg_progress = weighted_sum / total_weight if total_weight else 0

            return {
                "progress": avg_progress,
                "start": start_dates and min(start_dates),
                "end": end_dates and max(end_dates)
            }

        roots = tree.get(ROOT, [])

        total = 0
        weight = 0

        for r in roots:
            res = calc(r)

            if res["start"] and res["end"]:
                d = (res["end"] - res["start"]).days + 1
            else:
                d = r.duration or 1

            total += res["progress"] * d
            weight += d

        return (total / weight) * 100 if weight else 0