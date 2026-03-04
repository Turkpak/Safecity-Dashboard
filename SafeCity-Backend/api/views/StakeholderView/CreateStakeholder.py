from ..common_imports import * 
class StakeholderCreateView(viewsets.ViewSet):
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Stakeholders"
    
    def create(self, request, *args, **kwargs):
        data = request.data
        try:
            if not data.get('stakeholder_type') or not data.get('stakeholder_title'):
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="Stakeholder fields cannot be empty.",
                    data={},
                    http_status=status.HTTP_400_BAD_REQUEST
                ).create_response()

            if Stakeholder.objects.filter(
                stakeholder_type__iexact=data.get('stakeholder_type'),
                stakeholder_title__iexact=data.get('stakeholder_title'),
            ).exists():
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="Duplicate entry: Stakeholder already exists.",
                    data={},
                    http_status=status.HTTP_400_BAD_REQUEST
                ).create_response()

            mystakeholder = Stakeholder.objects.create(
                stakeholder_type=data.get('stakeholder_type'),
                stakeholder_title=data.get('stakeholder_title'),
                status=data.get('status') or 'active'
            )

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Stakeholder created successfully.",
                data=StakeholderSerializer(mystakeholder).data,
                http_status=status.HTTP_201_CREATED
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
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()
