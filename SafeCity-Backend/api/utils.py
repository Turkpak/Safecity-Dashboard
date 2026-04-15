from rest_framework_simplejwt.tokens import RefreshToken
import jwt
from builtins import dict
import string
from typing import List, Dict, Any
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
from django.utils.text import slugify
from datetime import datetime, date
from django.db.models import Avg, Max, Min

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

    # 🔥 Use project name instead of ID
    project_name = slugify(instance.project.project_name)

    return os.path.join(
        f"projects/{project_name}/daily_logs/{date_folder}/",
        filename
    )

def project_doc_file_path(instance, filename):

    ext = filename.split('.')[-1].lower()
    filename = f"{uuid.uuid4()}.{ext}"

    # Project name with ID
    project_name = f"{instance.id}-{slugify(instance.project_name)}" if instance.project_name else "no-project"

    # Date folder
    date_folder = instance.created_at.strftime("%Y-%m-%d") if instance.created_at else datetime.now().strftime("%Y-%m-%d")

    # File type folder
    if ext == "xer":
        subfolder = "xer"
    elif ext in ["geojson", "json"]:
        subfolder = "geojson"
    else:
        subfolder = "others"

    return os.path.join(
        "projects",
        project_name,
        date_folder,
        subfolder,
        filename
    )

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
def parse_xer(file):

    wbs = {}
    tasks = []
    dependencies = []

    current_table = None
    fields = []

    # ✅ read directly from uploaded file (NO disk)
    for line in file:
        line = line.decode("utf-8", errors="ignore").strip()

        if line.startswith("%T"):
            current_table = line.split("\t")[1].strip().upper()

        elif line.startswith("%F"):
            fields = [f.strip().lower() for f in line.split("\t")[1:]]

        elif line.startswith("%R"):
            values = line.split("\t")[1:]
            row = dict(zip(fields, values))

            if current_table == "PROJWBS":
                wbs[row.get("wbs_id")] = {
                    "name": row.get("wbs_name"),
                    "parent": row.get("parent_wbs_id")
                }

            elif current_table == "TASK":
                tasks.append({
                    "activity_id": row.get("task_id") or row.get("task_id"),
                    "activity_name": row.get("task_name") or row.get("task_name"),
                    "wbs_id": row.get("wbs_id"),
                    "start_date": (
                        row.get("early_start_date") or row.get("target_start_date") or
                        row.get("start_date") or row.get("scheduled_start_date") or
                        row.get("planned_start_date")
                    ),
                    "end_date": (
                        row.get("early_end_date") or row.get("target_end_date") or
                        row.get("finish_date") or row.get("end_date") or
                        row.get("scheduled_end_date") or row.get("planned_finish_date")
                    ),
                    "progress": float(
                        row.get("phys_complete_pct") or row.get("percent_complete") or
                        row.get("pcomplete") or 0
                    ),
                    "duration": float(
                        row.get("target_drtn_hr_cnt") or row.get("duration") or
                        row.get("drtn_hr_cnt") or 0
                    )
                })

            elif current_table == "TASKPRED":
                dependencies.append({
                    "task_id": row.get("task_id"),
                    "pred_task_id": row.get("pred_task_id"),
                    "type": row.get("pred_type")
                })

    return {
        "wbs": wbs,
        "tasks": tasks,
        "dependencies": dependencies
    }
def get_xer_gantt_data(project_id):

    from .models import Project   # adjust if needed

    project = Project.objects.get(id=project_id)

    if not project.xer_file:
        return []

    xer_path = project.xer_file.path

    activities = parse_xer(xer_path)

    return activities


def _parse_date_only(value):
    """
    Best-effort parse for date/datetime strings coming from XER exports.
    Accepts 'YYYY-MM-DD', 'YYYY-MM-DD HH:mm', 'YYYY-MM-DD HH:mm:ss', etc.
    Returns a Python date or None.
    """
    if not value:
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, datetime):
        return value.date()
    if not isinstance(value, str):
        return None
    s = value.strip()
    if not s:
        return None
    s = s.split("T")[0].split(" ")[0]
    try:
        return datetime.strptime(s, "%Y-%m-%d").date()
    except Exception:
        return None


def parse_xer_file(file_path: str):
    """
    Minimal XER parser used by tests (SafeCity-Backend/api/tests/test_xer_parsing.py).
    Supports a simplified %T/%F/%R structure with a TASK table containing:
    TASK_ID, TASK_NAME, START_DATE, FINISH_DATE, PERCENT_COMPLETE.

    Returns a list of tasks:
    [{ id, label, start, end, progress }] where progress is 0..1
    """
    current_table = None
    fields = []
    out = []

    with open(file_path, "r", encoding="utf-8", errors="ignore") as file:
        for raw in file:
            line = raw.strip()
            if not line:
                continue
            if line.startswith("%T"):
                parts = line.split("\t")
                current_table = parts[1] if len(parts) > 1 else None
                continue
            if line.startswith("%F"):
                fields = line.split("\t")[1:]
                continue
            if line.startswith("%R"):
                if current_table != "TASK":
                    continue
                values = line.split("\t")[1:]
                row = dict(zip(fields, values))
                task_id = row.get("TASK_ID") or row.get("task_id")
                name = row.get("TASK_NAME") or row.get("task_name") or ""
                start = row.get("START_DATE") or row.get("start_date")
                end = row.get("FINISH_DATE") or row.get("finish_date") or row.get("END_DATE") or row.get("end_date")
                pct = row.get("PERCENT_COMPLETE") or row.get("percent_complete") or "0"
                try:
                    pct_num = float(pct)
                except Exception:
                    pct_num = 0.0
                out.append(
                    {
                        "id": str(task_id) if task_id is not None else "",
                        "label": name,
                        "start": (start.split(" ")[0] if isinstance(start, str) else start) or None,
                        "end": (end.split(" ")[0] if isinstance(end, str) else end) or None,
                        "progress": max(0.0, min(1.0, pct_num / 100.0)),
                    }
                )
    return out


def normalize_progress_to_percent(value):
    """
    Normalize progress into 0..100 (percent).
    Accepts:
    - 0..1 fractions
    - 0..100 percents
    """
    if value is None:
        return 0.0
    try:
        v = float(value)
    except (TypeError, ValueError):
        return 0.0
    if 0.0 <= v <= 1.0:
        v *= 100.0
    return max(0.0, min(100.0, v))


def recompute_project_activity_rollups(project):
    """
    Recompute derived fields for WBS/summary rows (ProjectActivity nodes with children):
    - start_date = min(child.start_date)
    - end_date = max(child.end_date)
    - progress = avg(child.progress) [simple rollup]

    Runs bottom-up so nested WBS nodes get correct values.
    """
    from .models import ProjectActivity

    nodes = list(ProjectActivity.objects.filter(project=project).values("id", "parent_id"))
    children_by_parent = {}
    for n in nodes:
        children_by_parent.setdefault(n["parent_id"], []).append(n["id"])

    parent_by_id = {n["id"]: n["parent_id"] for n in nodes}
    depth_cache = {}

    def depth(node_id, _seen=None):
        if node_id in depth_cache:
            return depth_cache[node_id]
        if _seen is None:
            _seen = set()
        if node_id in _seen:
            depth_cache[node_id] = 0
            return 0
        _seen.add(node_id)
        pid = parent_by_id.get(node_id)
        if not pid:
            depth_cache[node_id] = 0
            return 0
        d = 1 + depth(pid, _seen=_seen)
        depth_cache[node_id] = d
        return d

    ids_desc = sorted(parent_by_id.keys(), key=lambda i: depth(i), reverse=True)

    for node_id in ids_desc:
        if not children_by_parent.get(node_id):
            continue  # leaf

        qs = ProjectActivity.objects.filter(project=project, parent_id=node_id)
        dated = qs.filter(start_date__isnull=False, end_date__isnull=False)
        agg_start = dated.aggregate(Min("start_date")).get("start_date__min")
        agg_end = dated.aggregate(Max("end_date")).get("end_date__max")
        agg_progress = qs.aggregate(Avg("progress")).get("progress__avg")

        ProjectActivity.objects.filter(project=project, id=node_id).update(
            start_date=agg_start,
            end_date=agg_end,
            progress=float(agg_progress) if agg_progress is not None else 0.0,
        )


def recompute_activity_ancestors(activity):
    """
    Recompute rollups for all ancestors of a given activity.
    """
    from .models import ProjectActivity

    cur = activity.parent
    while cur is not None:
        qs = ProjectActivity.objects.filter(project=activity.project, parent=cur)
        dated = qs.filter(start_date__isnull=False, end_date__isnull=False)
        agg_start = dated.aggregate(Min("start_date")).get("start_date__min")
        agg_end = dated.aggregate(Max("end_date")).get("end_date__max")
        agg_progress = qs.aggregate(Avg("progress")).get("progress__avg")

        cur.start_date = agg_start
        cur.end_date = agg_end
        cur.progress = float(agg_progress) if agg_progress is not None else 0.0
        cur.save(update_fields=["start_date", "end_date", "progress"])

        cur = cur.parent