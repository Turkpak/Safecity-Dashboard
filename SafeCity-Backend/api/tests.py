from django.test import TestCase
from rest_framework.test import APIRequestFactory

from api.models import MyUser
from api.views.DashboardView import DashboardPageDataView, _top_projects


class DashboardPageAliasTests(TestCase):
    def setUp(self):
        self.factory = APIRequestFactory()
        self.user = MyUser.objects.create_user(
            email="admin@example.com",
            company_name="Test Co",
            password="secret123",
            role="super_admin",
        )

    def _get(self, page):
        request = self.factory.get(f"/dashboard/{page}/")
        request.user = self.user
        return DashboardPageDataView.as_view()(request, page=page)

    def test_legacy_dashboard_page_aliases_are_supported(self):
        original = DashboardPageDataView.permission_classes
        DashboardPageDataView.permission_classes = []
        try:
            response = self._get("zones")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["page"], "zones")

            response = self._get("circles")
            self.assertEqual(response.status_code, 200)
            self.assertEqual(response.data["page"], "circles")
        finally:
            DashboardPageDataView.permission_classes = original

    def test_best_performing_projects_excludes_low_values(self):
        rows = [
            {"id": 1, "project_name": "Low", "overall_progress": 30, "physical_progress": 0, "financial_progress": 60},
            {"id": 2, "project_name": "Best", "overall_progress": 90, "physical_progress": 85, "financial_progress": 95},
            {"id": 3, "project_name": "Strong", "overall_progress": 80, "physical_progress": 75, "financial_progress": 85},
            {"id": 4, "project_name": "Fair", "overall_progress": 70, "physical_progress": 60, "financial_progress": 80},
        ]

        result = _top_projects(rows, limit=6, minimum_overall=80)

        self.assertEqual([item["id"] for item in result], [2, 3])
