from django.test import TestCase
from rest_framework.test import APIClient, APIRequestFactory

from api.models import MyUser, Stakeholder
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


class CurrentUserEndpointTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = MyUser.objects.create_user(
            email="current-user@example.com",
            company_name="Test Co",
            password="test-password-123",
            role="super_admin",
        )

    def test_current_user_endpoint_returns_no_user_without_authentication(self):
        response = self.client.get("/api/get-user/me/")

        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.data["data"])

    def test_user_list_endpoint_still_requires_authentication(self):
        response = self.client.get("/api/get-user/")

        self.assertEqual(response.status_code, 401)

    def test_current_user_endpoint_allows_refresh_for_existing_session(self):
        self.client.cookies["safecity_refresh_token"] = "present"

        response = self.client.get("/api/get-user/me/")

        self.assertEqual(response.status_code, 401)

    def test_current_user_endpoint_returns_only_authenticated_user_profile(self):
        self.client.force_authenticate(user=self.user)

        response = self.client.get("/api/get-user/me/")

        self.assertEqual(response.status_code, 200)
        self.assertEqual(
            set(response.data["data"]),
            {"first_name", "last_name", "role", "permissions", "stakeholder_type"},
        )

    def test_public_user_creation_is_rejected(self):
        response = self.client.post("/api/create-user/", {}, format="json")

        self.assertIn(response.status_code, (401, 403))

    def test_superadmin_can_create_consultant_without_captcha(self):
        self.client.force_authenticate(user=self.user)
        stakeholder = Stakeholder.objects.create(
            stakeholder_type="Consultant",
            stakeholder_title="Test Consultant",
        )

        response = self.client.post(
            "/api/create-user/",
            {
                "email": "consultant@example.com",
                "first_name": "Test",
                "last_name": "Consultant",
                "company_name": "Test Co",
                "password": "SafeCity-test-password-2026",
                "stakeholder": stakeholder.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        created_user = MyUser.objects.get(email="consultant@example.com")
        self.assertEqual(created_user.role, "consultant")   # comes from the stakeholder type
        self.assertTrue(created_user.is_active)
        self.assertTrue(created_user.check_password("SafeCity-test-password-2026"))

    def test_superadmin_cannot_create_another_superadmin_through_user_management(self):
        self.client.force_authenticate(user=self.user)
        stakeholder = Stakeholder.objects.create(
            stakeholder_type="Contractor",
            stakeholder_title="Test Contractor",
        )

        # Sending role=super_admin must be ignored: the role comes from the stakeholder type
        response = self.client.post(
            "/api/create-user/",
            {
                "email": "new-admin@example.com",
                "first_name": "New",
                "last_name": "Admin",
                "company_name": "Test Co",
                "password": "SafeCity-test-password-2026",
                "role": "super_admin",
                "is_superuser": True,
                "is_staff": True,
                "stakeholder": stakeholder.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 201, response.json())
        created_user = MyUser.objects.get(email="new-admin@example.com")
        self.assertEqual(created_user.role, "contractor")
        self.assertFalse(created_user.is_superuser)
        self.assertFalse(created_user.is_staff)

    def test_stakeholder_type_cannot_be_used_to_create_a_superadmin(self):
        self.client.force_authenticate(user=self.user)
        bad_stakeholder = Stakeholder.objects.create(
            stakeholder_type="Super Admin",
            stakeholder_title="Bad Type",
        )

        response = self.client.post(
            "/api/create-user/",
            {
                "email": "sneaky-admin@example.com",
                "first_name": "Sneaky",
                "last_name": "Admin",
                "company_name": "Test Co",
                "password": "SafeCity-test-password-2026",
                "stakeholder": bad_stakeholder.pk,
            },
            format="json",
        )

        self.assertEqual(response.status_code, 400)
        self.assertFalse(MyUser.objects.filter(email="sneaky-admin@example.com").exists())
