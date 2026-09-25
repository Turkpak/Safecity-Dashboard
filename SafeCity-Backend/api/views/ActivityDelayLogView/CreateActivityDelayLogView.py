# api\views\ActivityDelayLogView\CreateActivityDelayLogView.py
from ..common_imports import *
from rest_framework.views import APIView
from rest_framework.response import Response


class ActivityDelayLogCreateView(APIView):
    permission_classes = [HasSidebarPermission]
    sidebar_label = "Citywise Progress"
    sub_label = None

    def post(self, request):
        serializer = ActivityDelayLogSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(
                created_by=request.user,
                originator=request.user.role
            )
            return Response({
                "message": "Delay log created successfully",
                "data": serializer.data
            }, status=201)

        return Response(serializer.errors, status=400)