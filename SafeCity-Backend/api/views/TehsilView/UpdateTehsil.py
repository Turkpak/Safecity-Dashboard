from ..common_imports import *

class TehsilUpdateView(viewsets.ViewSet):
    queryset = Tehsil.objects.all()
    serializer_class = TehsilSerializer
    permission_classes = [AllowAny]

    def update(self, request, *args, **kwargs):
        data = request.data
        tehsil_id = kwargs.get('pk') 

        try:
            mytehsil = Tehsil.objects.get(id=tehsil_id)

        except Tehsil.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Tehsil not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            serializer = TehsilSerializer(mytehsil, data=data, partial=True)  
            if serializer.is_valid():
                serializer.save()
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Tehsil updated successfully.",
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
