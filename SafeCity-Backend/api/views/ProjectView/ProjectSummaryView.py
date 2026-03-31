from django.db.models import Sum
from rest_framework.views import APIView
from ..common_imports import *

class ProjectSummaryView(APIView):

    def get(self, request):
        try:
            project_id = request.query_params.get("project_id")

            # ----------------------------------------
            # FILTER (IMPORTANT)
            # ----------------------------------------
            queryset = Project.objects.all()

            if project_id:
                queryset = queryset.filter(id=project_id)

                if not queryset.exists():
                    return ApiResponse(
                        status=404,
                        message="Project not found",
                        http_status=404
                    ).create_response()

            # ----------------------------------------
            # AGGREGATE
            # ----------------------------------------
            data = queryset.aggregate(
                total_allocation=Sum('allocation_total_cost'),
                total_pd_release=Sum('pd_release_total_cost'),
                total_spending_release=Sum('spending_release_total_cost'),
                total_pifra=Sum('pifra_utilization_total_cost'),

                total_allocation_capital=Sum('allocation_capital_cost'),
                total_allocation_revenue=Sum('allocation_revenue_cost'),

                total_pifra_capital=Sum('pifra_utilization_capital_cost'),
                total_pifra_revenue=Sum('pifra_utilization_revenue_cost'),
            )

            # ---------- SAFE VALUES ----------
            allocation = data['total_allocation'] or 0
            pifra = data['total_pifra'] or 0

            allocation_capital = data['total_allocation_capital'] or 0
            allocation_revenue = data['total_allocation_revenue'] or 0

            pifra_capital = data['total_pifra_capital'] or 0
            pifra_revenue = data['total_pifra_revenue'] or 0

            # ---------- PERCENTAGES ----------
            percentage_total = (pifra / allocation * 100) if allocation > 0 else 0
            percentage_capital = (pifra_capital / allocation_capital * 100) if allocation_capital > 0 else 0
            percentage_revenue = (pifra_revenue / allocation_revenue * 100) if allocation_revenue > 0 else 0

            # ----------------------------------------
            # RESPONSE
            # ----------------------------------------
            response = {
                "project_id": project_id if project_id else "ALL",

                "total_allocation": allocation,
                "total_pd_release": data['total_pd_release'] or 0,
                "total_spending_release": data['total_spending_release'] or 0,
                "total_pifra": pifra,

                "percentage_total": round(percentage_total, 2),
                "percentage_capital": round(percentage_capital, 2),
                "percentage_revenue": round(percentage_revenue, 2),
            }

            return ApiResponse(
                status=200,
                message="Project Summary",
                data=response,
                http_status=200
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=500,
                message="Error",
                data=str(e),
                http_status=500
            ).create_response()