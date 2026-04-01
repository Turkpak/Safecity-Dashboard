from ..common_imports import *

class ActivityDelayLogView(APIView):

    def post(self, request):
        serializer = ActivityDelayLogSerializer(data=request.data)

        if serializer.is_valid():
            serializer.save(
                created_by=request.user,
                originator=request.user.role   
            )
            return Response({
                "message": "Delay log saved",
                "data": serializer.data
            })

        return Response(serializer.errors, status=400)