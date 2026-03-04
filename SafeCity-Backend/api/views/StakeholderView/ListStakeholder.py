from ..common_imports import *

class ListStakeholderView(viewsets.ViewSet):
    queryset = Stakeholder.objects.all()
    serializer_class = StakeholderSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Stakeholders"

    def list(self, request, *args, **kwargs):
        stakeholder_id = request.query_params.get("id")
        try:
            if stakeholder_id:
                stakeholder = Stakeholder.objects.filter(id=stakeholder_id).first()
                if not stakeholder:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Stakeholder Data not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = StakeholderSerializer(stakeholder)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Stakeholder detail.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            else:
                queryset = Stakeholder.objects.all()
                serializer = StakeholderSerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Stakeholder list.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()
