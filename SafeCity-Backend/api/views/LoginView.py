from .common_imports import *

class LoginView(APIView):
    def post(self, request):
        if 'email' not in request.data or 'password' not in request.data:
            return Response({'msg': 'Credentials missing'}, status=status.HTTP_400_BAD_REQUEST)
        email = request.POST.get('email')
        password = request.POST.get('password')
        user = authenticate(request, email=email, password=password)
        if user is not None:
            login(request, user)
            auth_data = utils.get_tokens_for_user(request.user)
            verified = user.is_verified

            res = {
                'msg': {
                    'login': 'Login Success',
                    'verified': verified,
                },
                **auth_data
            }
            return Response(res, status=status.HTTP_200_OK)
        return Response({'msg': 'Invalid Credentials'}, status=status.HTTP_401_UNAUTHORIZED)