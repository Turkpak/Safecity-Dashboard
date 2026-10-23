from django.test import TestCase
from rest_framework.test import APIClient

from api.urls import router

# Public on purpose
PUBLIC_ROUTER_PREFIXES = {"login-user"}

# Non-router paths from api/urls.py
PLAIN_PATHS = [
    "project-gantt/1/",
    "update-task-actual/1/",
    "project-gantt-nested/1/",
    "project-gantt-all/",
    "project-summary/",
    "add-delay-log/",
    "list-delay-log/",
    "update-delay-log/1/",
    "project-progress-summary/",
    "project-status-summary/",
    "physical-progress-report/",
    "dashboard/home/",
    "dashboard-page/home/",
]

# 401/403 = auth gate fired; 404/405 = nothing served. Never 2xx, 400 or 500.
BLOCKED = {401, 403, 404, 405}
METHODS = ("GET", "POST", "PUT", "PATCH", "DELETE")


class AnonymousAccessRegressionTests(TestCase):
    def setUp(self):
        self.client = APIClient()

    def _assert_blocked(self, url):
        for method in METHODS:
            response = self.client.generic(method, url)
            self.assertIn(
                response.status_code,
                BLOCKED,
                f"{method} {url} returned {response.status_code} for an anonymous caller",
            )

    def test_router_endpoints_reject_anonymous(self):
        for prefix, _viewset, _basename in router.registry:
            if prefix in PUBLIC_ROUTER_PREFIXES:
                continue
            self._assert_blocked(f"/api/{prefix}/")
            self._assert_blocked(f"/api/{prefix}/1/")

    def test_plain_paths_reject_anonymous(self):
        for path in PLAIN_PATHS:
            self._assert_blocked(f"/api/{path}")