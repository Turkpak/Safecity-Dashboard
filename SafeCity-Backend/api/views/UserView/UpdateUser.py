from ..common_imports import *

class UserUpdateView(viewsets.ViewSet):
    queryset = MyUser.objects.all()
    serializer_class = MyUserSerializer
    permission_classes = [AllowAny]

    def update(self, request, *args, **kwargs):
        data = request.data
        user_id = kwargs.get('pk') 
        try:
            myuser = MyUser.objects.get(id=user_id)  

        except MyUser.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="User not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            serializer = MyUserSerializer(myuser, data=data, partial=True)  
            if serializer.is_valid():
                serializer.save()
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="User updated successfully.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Validation error.",
                data=serializer.errors,
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()
