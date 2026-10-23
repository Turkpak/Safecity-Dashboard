from django.contrib.auth import get_user_model
from rest_framework.test import APIClient
from django.test import TestCase

from api.models import MyUser, Stakeholder


class CreateUserPrivilegeTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.stakeholder = Stakeholder.objects.create(
            stakeholder_type="Contractor", stakeholder_title="Test")
        self.admin = MyUser(email="admin@example.com", role="super_admin", is_active=True)
        self.admin.set_password("Str0ng-Pass-123!")
        self.admin.save()

    def _payload(self, **extra):
        # Add any other required MyUser fields here if you get a 400
        return {
            "email": "new@example.com",
            "password": "Str0ng-Pass-123!",
            "first_name": "New",
            "last_name": "User",
            "stakeholder": self.stakeholder.pk,
            **extra,
        }

    def test_anonymous_cannot_create_user(self):
        response = self.client.post("/api/create-user/", self._payload(), format="json")
        self.assertIn(response.status_code, (401, 403))
        self.assertFalse(get_user_model().objects.filter(email="new@example.com").exists())

    def test_non_admin_cannot_create_user(self):
        user = MyUser(email="c@example.com", role="contractor", is_active=True)
        user.set_password("Str0ng-Pass-123!")
        user.save()
        self.client.force_authenticate(user=user)
        response = self.client.post("/api/create-user/", self._payload(), format="json")
        self.assertEqual(response.status_code, 403)

    def test_privilege_fields_are_ignored(self):
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/create-user/",
            self._payload(role="super_admin", is_superuser=True, is_staff=True),
            format="json",
        )
        self.assertEqual(response.status_code, 201, response.json())
        created = get_user_model().objects.get(email="new@example.com")
        self.assertEqual(created.role, "contractor")   # from the stakeholder, not the request
        self.assertFalse(created.is_superuser)
        self.assertFalse(created.is_staff)

    def test_admin_stakeholder_type_cannot_create_admin(self):
        # Needs the "super_admin" role guard in UserCreateView (Fix 2b)
        bad = Stakeholder.objects.create(stakeholder_type="Super Admin", stakeholder_title="Bad")
        self.client.force_authenticate(user=self.admin)
        response = self.client.post(
            "/api/create-user/", self._payload(stakeholder=bad.pk), format="json")
        self.assertEqual(response.status_code, 400)