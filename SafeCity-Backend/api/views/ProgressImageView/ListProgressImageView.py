from ..common_imports import *
from api.models import ProgressImage
from api.serializers import ProgressImageSerializer


class ListProgressImageView(viewsets.ViewSet):

    def list(self, request, *args, **kwargs):
        try:
            image_id = request.query_params.get("id")
            project_id = request.query_params.get("project")
            activity_id = request.query_params.get("activity")

            # ✅ Case 1: Get single image
            if image_id:
                image = ProgressImage.objects.filter(id=image_id).first()

                if not image:
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="Image not found.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = ProgressImageSerializer(image)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Image found.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            # ✅ Case 2: Filter by activity (MOST IMPORTANT)
            elif activity_id:
                images = ProgressImage.objects.filter(activity_id=activity_id)

                if not images.exists():
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="No images found for this activity.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = ProgressImageSerializer(images, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Images found for activity.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            # ✅ Case 3: Filter by project
            elif project_id:
                images = ProgressImage.objects.filter(project_id=project_id)

                if not images.exists():
                    return ApiResponse(
                        status=status.HTTP_404_NOT_FOUND,
                        message="No images found for this project.",
                        http_status=status.HTTP_404_NOT_FOUND
                    ).create_response()

                serializer = ProgressImageSerializer(images, many=True)
                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="Images found for project.",
                    data=serializer.data,
                    http_status=status.HTTP_200_OK
                ).create_response()

            # ✅ Case 4: Get all images
            else:
                images = ProgressImage.objects.all()
                serializer = ProgressImageSerializer(images, many=True)

                return ApiResponse(
                    status=status.HTTP_200_OK,
                    message="All images found.",
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