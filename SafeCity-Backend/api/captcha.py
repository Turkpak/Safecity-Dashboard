from rest_framework.views import APIView
from rest_framework.permissions import AllowAny
from rest_framework.response import Response

from captcha.models import CaptchaStore
from captcha.helpers import captcha_image_url
from rest_framework.throttling import ScopedRateThrottle

class CaptchaView(APIView):
    permission_classes = [AllowAny]
    authentication_classes = []   
    throttle_classes = [ScopedRateThrottle]
    throttle_scope = "captcha"

    def get(self, request):
        # Generate a new CAPTCHA
        captcha_key = CaptchaStore.generate_key()

        # Generate the CAPTCHA image URL
        image_url = captcha_image_url(captcha_key)

        return Response({
            "key": captcha_key,
            "image_url": request.build_absolute_uri(image_url),
        })