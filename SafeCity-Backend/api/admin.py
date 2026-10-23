import logging

from captcha.fields import CaptchaField
from django.contrib import admin
from django.contrib.auth.signals import user_logged_in
from django.dispatch import receiver
from django_otp.admin import OTPAdminSite
from django_otp.forms import OTPAuthenticationForm

from api.admin_security import get_client_ip

audit_log = logging.getLogger("admin.audit")


class CaptchaAdminLoginForm(OTPAuthenticationForm):
    captcha = CaptchaField()


# Require a verified TOTP device for every admin page
admin.site.__class__ = OTPAdminSite
admin.site.login_form = CaptchaAdminLoginForm


@receiver(user_logged_in)
def log_staff_login(sender, request, user, **kwargs):
    if user.is_staff or user.is_superuser:
        ip = get_client_ip(request) if request else "n/a"
        audit_log.warning("Admin login: user_id=%s ip=%s", user.pk, ip)