from ..common_imports import *
class ActivityDelayLogUpdateView(APIView):

    def put(self, request, pk):
        try:
            instance = ActivityDelayLog.objects.get(pk=pk)
        except ActivityDelayLog.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        serializer = ActivityDelayLogSerializer(instance, data=request.data)

        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Delay log updated successfully",
                "data": serializer.data
            })

        return Response(serializer.errors, status=400)

    def patch(self, request, pk):
        try:
            instance = ActivityDelayLog.objects.get(pk=pk)
        except ActivityDelayLog.DoesNotExist:
            return Response({"error": "Not found"}, status=404)

        serializer = ActivityDelayLogSerializer(instance, data=request.data, partial=True)

        if serializer.is_valid():
            serializer.save()
            return Response({
                "message": "Delay log partially updated",
                "data": serializer.data
            })

        return Response(serializer.errors, status=400)