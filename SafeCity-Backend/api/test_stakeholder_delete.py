from django.test import TestCase
from rest_framework.test import APIClient

from api.models import MyUser, Stakeholder


class StakeholderDeleteTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.admin = MyUser(email="admin@example.com", role="super_admin", is_active=True)
        self.admin.set_password("Str0ng-Pass-123!")
        self.admin.save()
        self.client.force_authenticate(user=self.admin)

    def _stakeholder(self, title):
        return Stakeholder.objects.create(stakeholder_type="Consultant", stakeholder_title=title)

    def test_unused_stakeholder_is_deleted(self):
        s = self._stakeholder("Unused")
        response = self.client.delete(f"/api/delete-stakeholder/{s.pk}/")
        self.assertEqual(response.status_code, 200)
        self.assertFalse(Stakeholder.objects.filter(pk=s.pk).exists())

    def test_stakeholder_with_a_user_is_blocked_not_500(self):
        s = self._stakeholder("Has user")
        user = MyUser(email="c@example.com", role="consultant", stakeholder=s, is_active=True)
        user.set_password("Str0ng-Pass-123!")
        user.save()
        response = self.client.delete(f"/api/delete-stakeholder/{s.pk}/")
        self.assertEqual(response.status_code, 400)
        self.assertTrue(Stakeholder.objects.filter(pk=s.pk).exists())

