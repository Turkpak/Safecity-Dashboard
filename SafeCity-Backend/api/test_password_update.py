from rest_framework.test import APIClient
from django.test import TestCase

from api.models import MyUser


class PasswordUpdateTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.user = MyUser(email="u@example.com", role="contractor", is_active=True)
        self.user.set_password("Old-Str0ng-Pass-1!")
        self.user.save()
        self.client.force_authenticate(user=self.user)

    def test_password_is_hashed_on_update(self):
        response = self.client.put(
            f"/api/update-user/{self.user.pk}/",
            {"password": "New-Str0ng-Pass-2!", "current_password": "Old-Str0ng-Pass-1!"},
            format="json",
        )
        self.assertEqual(response.status_code, 200, response.json())
        self.user.refresh_from_db()
        self.assertNotEqual(self.user.password, "New-Str0ng-Pass-2!")
        self.assertTrue(self.user.check_password("New-Str0ng-Pass-2!"))
        self.assertFalse(self.user.check_password("Old-Str0ng-Pass-1!"))

    def test_wrong_current_password_is_rejected(self):
        response = self.client.put(
            f"/api/update-user/{self.user.pk}/",
            {"password": "New-Str0ng-Pass-2!", "current_password": "wrong"},
            format="json",
        )
        self.assertEqual(response.status_code, 400)
        self.user.refresh_from_db()
        self.assertTrue(self.user.check_password("Old-Str0ng-Pass-1!"))