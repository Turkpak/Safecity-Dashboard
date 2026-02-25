from rest_framework_simplejwt.tokens import RefreshToken
import jwt
from builtins import dict
import string
from django.http import JsonResponse
from rest_framework.response import Response
from rest_framework import status as http_status
from rest_framework_simplejwt.tokens import RefreshToken
import jwt
import secrets
import os 
import uuid 
from django.utils.crypto import get_random_string
from rest_framework.permissions import BasePermission
from rest_framework.pagination import PageNumberPagination
from collections import defaultdict
from rest_framework.pagination import PageNumberPagination

def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)

    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }



def get_user_name_token(token):
    decoded_token = jwt.decode(token, algorithms=['RS256'], options={"verify_signature": False})
    
    return decoded_token['username']


class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10  # Default items per page
    page_size_query_param = 'page_size'
    max_page_size = 100
    page_query_param = 'page'

    def paginate_queryset(self, queryset, request, view=None):
        # Handle sorting
        sort_by = request.query_params.get('sortBy')
        sort_dir = request.query_params.get('sortDir', 'asc')

        if sort_by:
            if sort_dir == 'desc':
                sort_by = f'-{sort_by}'
            queryset = queryset.order_by(sort_by)

        return super().paginate_queryset(queryset, request, view)

    def get_paginated_response(self, data):
        return Response({
            'links': {
                'next': self.get_next_link(),
                'previous': self.get_previous_link()
            },
            'count': self.page.paginator.count,
            'results': data
        })
def project_image_file_path(instance, filename):
    ext = filename.split('.')[-1]
    filename = f"{uuid.uuid4()}.{ext}"

    # Use image_date if available
    if instance.image_date:
        date_folder = instance.image_date.strftime("%Y-%m-%d")
    else:
        date_folder = "undated"

    return os.path.join(
        f"projects/{instance.project.id}/daily_logs/{date_folder}/",
        filename
    )


def project_doc_file_path(instance, filename):
    """Generate file path for new project image using UUID"""
    ext = filename.split('.')[-1]  # Get the file extension
    filename = f'{uuid.uuid4()}.{ext}'  # Generate a new filename using UUID
    return os.path.join('docs/', filename)

passkey = get_random_string(length=8)

def generate_random_string(length=8, allowed_chars=string.ascii_letters + string.digits):
  return ''.join(secrets.choice(allowed_chars) for i in range(length))


class ApiResponse:
    """
    A class for constructing a standardized server response.
   """
    def __init__(self, status: int, message: str = None, data: dict = None, error_traceback=None, http_status=http_status.HTTP_200_OK):
        self.response = {}
        self.status = status
        self.message = message
        self.data = data if data is not None else {}
        self.error_traceback = error_traceback.replace("\n", ",") if error_traceback else None
        self.http_status = http_status  # Use the default if not provided
    def create_response(self):
        """
        Creates a DRF Response object and returns it.
        """
        self.response['status'] = self.status
        self.response['message'] = self.message
        self.response['data'] = self.data
        self.response['error_traceback'] = self.error_traceback
        return Response(self.response, status=self.http_status)

    def create_json_response(self):
        """
        Creates a Django JsonResponse object and returns it.
        """
        self.response['status'] = self.status
        self.response['message'] = self.message
        self.response['data'] = self.data
        self.response['error_traceback'] = self.error_traceback
        return JsonResponse(self.response, status=self.http_status)

def get_error_message(serializer):
    """
    Extracts the first error message from a serializer's errors.
    """
    errors = list(serializer.errors.values())
    error_message = errors[0][0] if errors else 'Unknown error'
    return error_message

def get_error_message_list(error):
    """
    Converts error details into a list of error messages.
    """
    if isinstance(error, str):
        return [error]
    if hasattr(error, 'detail') and isinstance(error.detail, list):
        return error.detail
    error_message = []
    for key, value in error.detail.items():
        error_message.append(f"{key}: {value[0]}")
    return error_message

def get_error_message_list_serializer(errors):
    """
    Converts serializer errors into a dictionary of field-specific error messages.
    """
    error_messages = {}
    for field, error_list in errors.items():
        error_messages[field] = error_list[0] if isinstance(error_list, list) else error_list
    return error_messages



def get_tokens_for_user(user):
    refresh = RefreshToken.for_user(user)
    print("refrest", refresh)
    return {
        'refresh': str(refresh),
        'access': str(refresh.access_token),
    }


def get_user_name_token(token):
    decoded_token = jwt.decode(token, algorithms=['RS256'], options={
                               "verify_signature": False})

    return decoded_token['username']




class IsAdminUserForCreate(BasePermission):
    def has_permission(self, request, view):
        if request.method == 'POST':
            return request.user and request.user.is_admin  
        return True




def parse_nested_query_dict(query_dict):
    """
    Parse a QueryDict with nested keys into a standard dictionary.
    """
    data = defaultdict(lambda: defaultdict(dict))

    for key, value in query_dict.items():
        if 'multipleuserdoc[' in key:
            # Extract the index and field name
            base_key, sub_key = key.split('[')[0], key.split('[')[1].split(']')[0]
            index = int(key.split('[')[1].split(']')[0])
            field = key.split('[')[1].split(']')[1][1:-1]  # e.g., doc_name, doc_type, etc.
            
            # Assign the value to the correct field in the nested dict
            data[base_key][index][field] = value
        else:
            data[key] = value

    # Convert defaultdict back to dict to avoid unexpected behavior
    for base_key in data:
        if isinstance(data[base_key], defaultdict):
            data[base_key] = [dict(item) for item in data[base_key].values()]
            
    return dict(data)



class StandardResultsSetPagination(PageNumberPagination):
    page_size = 10  # Default items per page
    page_size_query_param = 'page_size'
    max_page_size = 100
    page_query_param = 'page'

    def paginate_queryset(self, queryset, request, view=None):
        # Handle sorting
        sort_by = request.query_params.get('sortBy')
        sort_dir = request.query_params.get('sortDir', 'asc')

        if sort_by:
            if sort_dir == 'desc':
                sort_by = f'-{sort_by}'
            queryset = queryset.order_by(sort_by)

        return super().paginate_queryset(queryset, request, view)

    def get_paginated_response(self, data):
        return Response({
            'links': {
                'next': self.get_next_link(),
                'previous': self.get_previous_link()
            },
            'count': self.page.paginator.count,
            'results': data
        })

