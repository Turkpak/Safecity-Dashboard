from ..common_imports import *
from django.db import IntegrityError 

class UserCreateView(viewsets.ViewSet):
    queryset = MyUser.objects.all()
    serializer_class = MyUserSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data.copy()

        try:
            serializer = MyUserSerializer(data=data)
            serializer.is_valid(raise_exception=True)
            # stakeholder = Stakeholder.objects.get(id=data.get('stakeholder'))
            myuser = MyUser(
                email=serializer.validated_data['email'],
                first_name=serializer.validated_data['first_name'],
                last_name=serializer.validated_data['last_name'],
                company_name=serializer.validated_data['company_name'],
                country=serializer.validated_data['country'],
                address=serializer.validated_data['address'],
                city=serializer.validated_data['city'],
                # stakeholder=stakeholder
            )
            myuser.set_password(data.get('password'))
            myuser.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="User created successfully.",
                data=MyUserSerializer(myuser).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()


        except IntegrityError as e:       
            error_msg = str(e)
            if 'username' in error_msg:
                duplicate_detail = {'username': ['This username already exists.']}
            elif 'email' in error_msg:
                duplicate_detail = {'email': ['This email is already registered.']}          
            else:
                duplicate_detail = {'detail': ['Duplicate entry error.']}

            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Duplicate entry error.",
                data=duplicate_detail,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        except serializers.ValidationError as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Serializer error.",
                data=e.detail,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()

        except Exception as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
