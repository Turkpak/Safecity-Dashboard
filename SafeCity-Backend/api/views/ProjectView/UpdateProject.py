from ..common_imports import *
import datetime

class ProjectUpdateView(viewsets.ViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [IsAuthenticated, HasSidebarPermission] 
    sidebar_label = "Project Management"

    def update(self, request, *args, **kwargs):
        data = request.data
        project_id = kwargs.get('pk') 

        try:
            myproject = Project.objects.get(id=project_id)

        except Project.DoesNotExist:
            return ApiResponse(
                status=status.HTTP_404_NOT_FOUND,
                message="Project not found.",
                http_status=status.HTTP_404_NOT_FOUND
            ).create_response()

        try:
            serializer = ProjectSerializer(myproject, data=data, partial=True)
            if serializer.is_valid():
                changes = {}
                for field, value in serializer.validated_data.items():
                    if field == 'stakeholder':
                        old_value = list(myproject.stakeholder.values_list('id', flat=True))
                        new_value = [s.id for s in value]
                    elif hasattr(value, 'name'):
                        old_value = getattr(myproject, field, None)
                        new_value = getattr(value, 'name', str(value))
                    else:
                        old_value = getattr(myproject, field, None)
                        new_value = value

                    if old_value != new_value:
                        if isinstance(old_value, (datetime.date, datetime.datetime)):
                            old_value = old_value.isoformat()
                        if isinstance(new_value, (datetime.date, datetime.datetime)):
                            new_value = new_value.isoformat()
                        changes[field] = {
                            'old': old_value,
                            'new': new_value,
                        }

                serializer.save()
                if changes:
                    ProjectUpdateLog.objects.create(
                        project=myproject,
                        updated_by=request.user if request.user.is_authenticated else None,
                        changes=changes,
                    )

                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Project updated successfully.",
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
