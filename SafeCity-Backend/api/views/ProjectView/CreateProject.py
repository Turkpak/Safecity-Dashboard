from ..common_imports import *

class ProjectCreateView(viewsets.ViewSet):
    queryset = Project.objects.all()
    serializer_class = ProjectSerializer
    permission_classes = [AllowAny]

    def create(self, request, *args, **kwargs):
        data = request.data

        try:
            
            serializer = ProjectSerializer(data=data)
            serializer.is_valid(raise_exception=True)

            myproject = Project(
                stakeholder=serializer.validated_data['stakeholder'],
                project_name=serializer.validated_data['project_name'],
                project_description=serializer.validated_data['project_description'],
                project_starting_date=serializer.validated_data['project_starting_date'],
                project_reference_no=serializer.validated_data['project_reference_no'],
                province=serializer.validated_data['province'],
                division=serializer.validated_data['division'],
                district=serializer.validated_data['district'],
                tehsil=serializer.validated_data['tehsil'],
                total_budget_allocated=serializer.validated_data['total_budget_allocated'],
                budget_utilized=serializer.validated_data['budget_utilized'],
                budget_variance=serializer.validated_data['budget_variance'],
                budget_remaining=serializer.validated_data['budget_remaining'],
                xer_file=serializer.validated_data['xer_file'],
                boundary_file=serializer.validated_data['boundary_file'],
                geom=serializer.validated_data['geom'],
            )
            myproject.save()

            return ApiResponse(
                status=status.HTTP_201_CREATED,
                message="Project created successfully.",
                data=ProjectSerializer(myproject).data,
                http_status=status.HTTP_201_CREATED
            ).create_response()

        except IntegrityError as e:
            error_msg = str(e)
            duplicate_detail = {}
            if 'project_name' in error_msg:
                duplicate_detail = {'': ['This project already exists.']}
            else:
                duplicate_detail = {'detail': ['Duplicate entry error.']}

            return ApiResponse(
                status=status.HTTP_400_BAD_REQUEST,
                message="Duplicate entry error.",
                data=duplicate_detail,
                http_status=status.HTTP_400_BAD_REQUEST
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
                status=status.HTTP_400_BAD_REQUEST,
                message="Exception error.",
                data=str(e),
                http_status=status.HTTP_400_BAD_REQUEST
            ).create_response()
