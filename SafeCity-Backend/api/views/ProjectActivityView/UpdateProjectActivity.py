# from ..common_imports import *

# class ProjectActivityUpdateView(viewsets.ViewSet):
#     queryset = ProjectActivity.objects.all()
#     serializer_class = ProjectActivitySerializer
#     permission_classes = [AllowAny]

#     def update(self, request, *args, **kwargs):
#         data = request.data
#         projectactivity_id = kwargs.get('pk') 

#         try:
#             myprojectactivity = ProjectActivity.objects.get(id=projectactivity_id)

#         except ProjectActivity.DoesNotExist:
#             return ApiResponse(
#                 status=status.HTTP_404_NOT_FOUND,
#                 message="Project Activity not found.",
#                 http_status=status.HTTP_404_NOT_FOUND
#             ).create_response()

#         try:
#             serializer = ProjectActivitySerializer(myprojectactivity, data=data, partial=True)  
#             if serializer.is_valid():
#                 serializer.save()
#                 return ApiResponse(
#                     status=status.HTTP_200_OK,
#                     message="Project Activity updated successfully.",
#                     data=serializer.data,
#                     http_status=status.HTTP_200_OK
#                 ).create_response()
            
#             return ApiResponse(
#                 status=status.HTTP_400_BAD_REQUEST,
#                 message="Validation error.",
#                 data=serializer.errors,
#                 http_status=status.HTTP_400_BAD_REQUEST
#             ).create_response()
        
#         except Exception as e:
#             return ApiResponse(
#                 status=status.HTTP_500_INTERNAL_SERVER_ERROR,
#                 message="Exception error.",
#                 data=str(e),
#                 http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
#             ).create_response()

from rest_framework import viewsets
from rest_framework.response import Response
from rest_framework import status
from api.models import ProjectActivity
from api.serializers import ProjectActivitySerializer

class ProjectActivityUpdateView(viewsets.ViewSet):

    def update(self, request, pk=None):
        try:
            obj = ProjectActivity.objects.get(pk=pk)
        except ProjectActivity.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        serializer = ProjectActivitySerializer(obj, data=request.data, partial=True)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data)

        return Response(serializer.errors, status=400)