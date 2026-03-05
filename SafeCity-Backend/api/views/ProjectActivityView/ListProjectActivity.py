from ..common_imports import *
from rest_framework.decorators import action
# from ...utils.xer_parser import get_xer_gantt_data

class ListProjectActivityView(viewsets.ViewSet):
    queryset = ProjectActivity.objects.all()
    serializer_class = ProjectActivitySerializer
    permission_classes = [AllowAny]

    def list(self, request, *args, **kwargs):
        try:
            activity_id = request.query_params.get("id")
            project_id = request.query_params.get("project_id")

            if activity_id:
                queryset = ProjectActivity.objects.filter(id=activity_id).first()
                if not queryset:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Project Activity not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()
                serializer = ProjectActivitySerializer(queryset)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Project Activity Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            elif project_id:
                queryset = ProjectActivity.objects.filter(project_id=project_id)
                serializer = ProjectActivitySerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Project Activities Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()
            else:
                queryset = ProjectActivity.objects.all()
                serializer = ProjectActivitySerializer(queryset, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All Projects activities Found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
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
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()

    @action(detail=False, methods=['get'], url_path='gantt-data')
    def gantt_data(self, request, *args, **kwargs):
        """GET /api/list-project-activity/gantt-data/?project_id=1"""
        try:
            project_id = request.query_params.get("project_id")
            
            if not project_id:
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="project_id is required",
                    http_status=status.HTTP_400_BAD_REQUEST
                ).create_response()
            
            activities = ProjectActivity.objects.filter(project_id=project_id).order_by('activity_id')
            
            tasks = []
            for activity in activities:
                tasks.append({
                    'id': str(activity.activity_id),
                    'label': activity.activity_name,
                    'start': activity.start_date.isoformat() if activity.start_date else None,
                    'end': activity.finish_date.isoformat() if activity.finish_date else None,
                    'progress': min(100, max(0, activity.percent_complete)) / 100.0,
                })
            
            return ApiResponse(
                status=status.HTTP_200_OK,
                message="Gantt data retrieved",
                data={'tasks': tasks},
                http_status=status.HTTP_200_OK
            ).create_response()
        
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()

    @action(detail=False, methods=['get'], url_path='xer-gantt-data')
    def xer_gantt_data(self, request, *args, **kwargs):
        """GET /api/list-project-activity/xer-gantt-data/?project_id=1 - Get Gantt data from XER file"""
        try:
            project_id = request.query_params.get("project_id")
            
            if not project_id:
                return ApiResponse(
                    status=status.HTTP_400_BAD_REQUEST,
                    message="project_id is required",
                    http_status=status.HTTP_400_BAD_REQUEST
                ).create_response()
            
            # Get XER gantt data
            result = get_xer_gantt_data(int(project_id))
            
            return ApiResponse(
                status=status.HTTP_200_OK,
                message=result.get('message', 'XER Gantt data retrieved'),
                data={'tasks': result['tasks']},
                http_status=status.HTTP_200_OK
            ).create_response()
        
        except ValueError as e:
            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
        
        except Exception as e:
            return ApiResponse(
                status=status.HTTP_500_INTERNAL_SERVER_ERROR,
                message="Server error.",
                data=str(e),
                http_status=status.HTTP_500_INTERNAL_SERVER_ERROR
            ).create_response()