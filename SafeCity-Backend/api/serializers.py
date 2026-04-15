from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import *
from django.contrib.gis.geos import GEOSGeometry, Polygon, MultiPolygon
import json
from django.contrib.auth import get_user_model
from .utils import parse_xer
from datetime import datetime
# --------------------------------------------------------
# MyUser Serializer
# --------------------------------------------------------
class MyUserSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()

    class Meta:
        model = MyUser
        fields = [
            "id",
            "email",
            "full_name",
            "first_name",
            "last_name",
            # "company_name",
            "role",             # Added role
            "stakeholder",      # Assign stakeholder if needed
            "is_active",
            "password",
        ]
        extra_kwargs = {
            "password": {"write_only": True},
        }

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"

    def create(self, validated_data):
        password = validated_data.pop("password", None)
        user = MyUser(**validated_data)

        # Set password properly
        if password:
            user.set_password(password)

        # Super admin automatically sets is_staff=True for admin or themselves
        if validated_data.get("role") in ["admin", "super_admin"]:
            user.is_staff = True

        user.save()
        return user


class MyUserLoginDashboardSerializer(serializers.ModelSerializer):
    email = serializers.EmailField()
    password = serializers.CharField(write_only=True)
    class Meta:
        model = MyUser
        fields = [
            "id",
            "email",
            "password",
            "full_name",
            "stakeholder_type",
            "stakeholder_id", 
            "is_active",
        ]
        extra_kwargs = {
            "password": {"write_only": True},
        }
    def get_stakeholder_type(self, obj):
        # If user has a stakeholder, return its type, else default to 'Client'
        return obj.stakeholder.stakeholder_type if obj.stakeholder else "Client"

    def get_stakeholder_id(self, obj):
        # If user has a stakeholder, return its id, else None
        return obj.stakeholder.id if obj.stakeholder else None

User = get_user_model()

class UserPermissionSerializer(serializers.ModelSerializer):
    user_email = serializers.ReadOnlyField(source='user.email')
    user_full_name = serializers.ReadOnlyField(source='user.get_full_name')
    created_by_email = serializers.ReadOnlyField(source='created_by.email')
    updated_by_email = serializers.ReadOnlyField(source='updated_by.email')

    class Meta:
        model = UserPermission
        fields = [
            'id',
            'user',
            'user_email',
            'user_full_name',
            'sidebar_label',
            'sub_label',
            'can_view',
            'can_create',
            'can_update',
            'can_delete',
            'created_by',
            'created_by_email',
            'updated_by',
            'updated_by_email',
        ]
        extra_kwargs = {
            'sub_label': {'required': False, 'allow_null': True, 'allow_blank': True},
        }

class UserWithPermissionsSerializer(serializers.ModelSerializer):
    full_name = serializers.SerializerMethodField()
    permissions = UserPermissionSerializer(source="userpermission_set", many=True, read_only=True)

    class Meta:
        model = MyUser
        fields = [
            "id",
            "email",
            "full_name",
            "role",
            "is_active",
            "permissions",
        ]

    def get_full_name(self, obj):
        return f"{obj.first_name} {obj.last_name}"
# --------------------------------------------------------
# Province Administrative Divisions
# --------------------------------------------------------
class ProvinceSerializer(serializers.ModelSerializer):
    class Meta:
        model = Province
        fields = ["id", "province_name"]

# --------------------------------------------------------
# Division Administrative Divisions
# --------------------------------------------------------
class DivisionSerializer(serializers.ModelSerializer):
    province_name = serializers.SerializerMethodField()
    class Meta:
        model = Division
        fields = ["id", "division_name", "province", "province_name"]

    def get_province_name(self, obj):
        return obj.province.province_name

# --------------------------------------------------------
# District Administrative Divisions
# --------------------------------------------------------
class DistrictSerializer(serializers.ModelSerializer):
    province_name = serializers.SerializerMethodField()
    division_name = serializers.SerializerMethodField()
    class Meta:
        model = District
        fields = ["id", "district_name", "division", "province", "province_name", "division_name"]

    def get_province_name(self, obj):
        return obj.province.province_name

    def get_division_name(self, obj):
        return obj.division.division_name

# --------------------------------------------------------
# Tehsil Administrative Divisions
# --------------------------------------------------------
class TehsilSerializer(serializers.ModelSerializer):
    province_name = serializers.SerializerMethodField()
    division_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()
    class Meta:
        model = Tehsil
        fields = ["id", "tehsil_name", "district", "division", "province", "province_name", "division_name", "district_name"]
    
    def get_province_name(self, obj):
        return obj.province.province_name

    def get_division_name(self, obj):
        return obj.division.division_name

    def get_district_name(self, obj):
        return obj.district.district_name

# --------------------------------------------------------
# Stakeholder
# --------------------------------------------------------
class StakeholderSerializer(serializers.ModelSerializer):
    class Meta:
        model = Stakeholder
        fields = ['id', 'stakeholder_type', 'stakeholder_title', 'status']

class ProjectActivitySerializer(serializers.ModelSerializer):
    project_name = serializers.SerializerMethodField()
    duration_display = serializers.SerializerMethodField()
    class Meta:
        model = ProjectActivity
        fields = ["id", "project", "project_name", "activity_id", "activity_name", "start_date", "end_date", "progress", "actual_start", "actual_end", "progress_date", "progress_status", "duration", "duration_display"]
    
    def get_project_name(self, obj):
        return obj.project.project_name
    
    def get_duration_display(self, obj):
        # Use total_duration property to include child durations if needed
        duration = getattr(obj, "total_duration", obj.duration) or 0
        return f"{int(duration)} day" if duration == 1 else f"{int(duration)} days"

class ProgressImageSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProgressImage
        fields = "__all__"

class ProjectDocumentSerializer(serializers.ModelSerializer):
    file_url = serializers.SerializerMethodField()

    class Meta:
        model = ProjectDocument
        fields = [
            "id",
            "project",
            "activity",
            "title",
            "file",
            "file_url",
            "uploaded_at",
        ]

    def get_file_url(self, obj):
        request = self.context.get("request")
        if obj.file and request:
            return request.build_absolute_uri(obj.file.url)
        return None
# --------------------------------------------------------
# Project
# --------------------------------------------------------

class ProjectSerializer(GeoFeatureModelSerializer):
    province_name = serializers.SerializerMethodField()
    division_name = serializers.SerializerMethodField()
    district_name = serializers.SerializerMethodField()
    tehsil_name = serializers.SerializerMethodField()
    stakeholder_details = serializers.SerializerMethodField()
    stakeholder = serializers.PrimaryKeyRelatedField(
        many=True,
        queryset=Stakeholder.objects.all(),
        required=False
    )
    activities = ProjectActivitySerializer(many=True, read_only=True)
    project_starting_date = serializers.DateField(
        input_formats=["%Y-%m-%d", "%Y-%m-%d %H:%M"]
    )
    boundary_file = serializers.FileField(write_only=True, required=False)
    xer_file = serializers.FileField(write_only=True, required=False)

    class Meta:
        model = Project
        geo_field = "geom"
        fields = [
            'id', 'stakeholder', 'stakeholder_details',
            'project_name', 'project_description',
            'project_starting_date', 'project_reference_no',
            'province', 'province_name',
            'division', 'division_name', 'district', 'district_name',
            'tehsil', 'tehsil_name',
            'total_budget_allocated', 'budget_utilized',
            'budget_variance', 'budget_remaining',
            'xer_file', 'boundary_file', 'geom',
            'allocation_capital_cost', 'allocation_revenue_cost', 'allocation_total_cost', 
            'pd_release_capital_cost', 'pd_release_cost', 'pd_release_total_cost',
            'spending_release_capital_cost', 'spending_release_revenue_cost', 'spending_release_total_cost',
            'pifra_utilization_capital_cost', 'pifra_utilization_revenue_cost', 'pifra_utilization_total_cost', 'pifra_utilization_date',
            'percentage_utilization_capital', 'percentage_utilization_revenue', 'percentage_utilization_total',
            'created_at', 'updated_at', "activities"
        ]

    # ---------- Readable Names ----------
    def get_province_name(self, obj):
        return obj.province.province_name if obj.province else None

    def get_division_name(self, obj):
        return obj.division.division_name if obj.division else None

    def get_district_name(self, obj):
        return obj.district.district_name if obj.district else None

    def get_tehsil_name(self, obj):
        return obj.tehsil.tehsil_name

    # ---------- Stakeholder Details ----------
    def get_stakeholder_details(self, obj):
        return [
            {
                "stakeholder_type": s.stakeholder_type,
                "stakeholder_title": s.stakeholder_title
            }
            for s in obj.stakeholder.all()
        ]

    # ---------- Create ----------
    def create(self, validated_data):
        stakeholders = validated_data.pop('stakeholder', [])
        xer_file = validated_data.pop('xer_file', None)
        boundary_file = validated_data.pop('boundary_file', None)

        project = Project.objects.create(**validated_data)
        project.stakeholder.set(stakeholders)

        if xer_file:
            # Parse the uploaded XER in-memory and create activities without
            # persisting the file to local storage.
            try:
                self._save_activities(project, xer_file)
            except Exception:
                pass
        # Handle GeoJSON
        if boundary_file:
            project.geom = self._parse_boundary_file(boundary_file)

        project.save()

        return project

    # ---------- Update ----------
    def update(self, instance, validated_data):
        stakeholders = validated_data.pop('stakeholder', None)
        xer_file = validated_data.pop('xer_file', None)
        boundary_file = validated_data.pop('boundary_file', None)

        for attr, value in validated_data.items():
            setattr(instance, attr, value)

        if stakeholders is not None:
            instance.stakeholder.set(stakeholders)

        if xer_file:
            # Rebuild activities from the uploaded XER without saving the file.
            instance.activities.all().delete()
            try:
                self._save_activities(instance, xer_file)
            except Exception:
                pass

        # Handle GeoJSON
        if boundary_file:
            instance.geom = self._parse_boundary_file(boundary_file)

        instance.save()
        return instance

    # ------------------------
    # Generate file path without saving
    # ------------------------
    def _generate_xer_path(self, project, filename):
        from django.utils.text import slugify
        from datetime import datetime
        import uuid
        import os

        ext = filename.split('.')[-1].lower()
        filename = f"{uuid.uuid4()}.{ext}"

        project_name = f"{project.id}-{slugify(project.project_name)}" if project.project_name else "no-project"
        date_folder = datetime.now().strftime("%Y-%m-%d")
        subfolder = "xer"

        path = os.path.join("projects", project_name, date_folder, subfolder, filename)
        return path.replace("\\", "/")  # Ensure forward slashes for frontend
    # ---------- Private: Parse GeoJSON & Ensure MultiPolygon ----------
    def _parse_boundary_file(self, boundary_file):
        try:
            boundary_file.seek(0)
            geojson_data = json.load(boundary_file)
            geometry = (
                geojson_data["features"][0]["geometry"]
                if geojson_data.get("type") == "FeatureCollection"
                else geojson_data.get("geometry")
            )

            geom_obj = GEOSGeometry(json.dumps(geometry))

            # Ensure MultiPolygon
            if isinstance(geom_obj, Polygon):
                geom_obj = MultiPolygon(geom_obj)
            elif not isinstance(geom_obj, MultiPolygon):
                raise serializers.ValidationError("Geometry must be Polygon or MultiPolygon.")

            return geom_obj

        except Exception as e:
            raise serializers.ValidationError({
                "boundary_file": f"Invalid GeoJSON: {e}"
            })

    # ---------- Private: Parse XER and save tasks ----------
    def _save_activities(self, project, xer_file):
        def _parse_xer_date(value):
            if not value:
                return None
            if isinstance(value, datetime):
                return value.date()
            if isinstance(value, str):
                date_string = value.strip().split(" ")[0]
                try:
                    return datetime.strptime(date_string, "%Y-%m-%d").date()
                except ValueError:
                    return None
            return None

        xer_file.seek(0)
        data = parse_xer(xer_file)

        wbs = data["wbs"]
        tasks = data["tasks"]
        dependencies = data["dependencies"]

        wbs_objects = {}
        task_map = {}

        # 1. WBS
        for wbs_id, w in wbs.items():
            parent = wbs_objects.get(w["parent"])
            obj = ProjectActivity.objects.create(
                project=project,
                activity_id=wbs_id,
                activity_name=w["name"],
                parent=parent,
                task_type="wbs"
            )
            wbs_objects[wbs_id] = obj

        # 2. TASKS
        for task in tasks:
            parent = wbs_objects.get(task["wbs_id"])
            start = _parse_xer_date(task.get("start_date"))
            end = _parse_xer_date(task.get("end_date"))
            task_type = "milestone" if start and end and start == end else "task"

            obj = ProjectActivity.objects.create(
                project=project,
                activity_id=task.get("activity_id"),
                activity_name=task.get("activity_name"),
                parent=parent,
                start_date=start,
                end_date=end,
                progress=task.get("progress") or 0,
                duration=task.get("duration") or 0,
                task_type=task_type
            )
            task_map[task.get("activity_id")] = obj

        # 3. DEPENDENCIES
        for dep in dependencies:
            task_obj = task_map.get(dep.get("task_id"))
            pred_obj = task_map.get(dep.get("pred_task_id"))
            if task_obj and pred_obj:
                TaskDependency.objects.create(
                    project=project,
                    task=task_obj,
                    predecessor=pred_obj,
                    type=dep.get("type")
                )

class TopProjectSerializer(serializers.ModelSerializer):
    division_name = serializers.CharField(source='division.division_name', read_only=True)
    progress = serializers.FloatField(read_only=True)

    class Meta:
        model = Project
        fields = [
            "id",
            "project_name",
            "division_name",
            "progress"
        ]
class TaskSerializer(serializers.ModelSerializer):
    parent_id = serializers.PrimaryKeyRelatedField(
        source='parent',
        read_only=True
    )

    class Meta:
        model = ProjectActivity
        fields = [
            "id", "activity_id", "activity_name", "parent_id",
            # planned
            "start_date",
            "end_date",

            # actual
            "actual_start",
            "actual_end",

            "progress",
            "duration",
            "task_type"
        ]

class ActivityDelayLogSerializer(serializers.ModelSerializer):
    action_by_info = serializers.SerializerMethodField()

    class Meta:
        model = ActivityDelayLog
        fields = "__all__"
        read_only_fields = ["originator", "created_by"]

    def get_action_by_info(self, obj):
        if obj.action_by:
            return {
                "stakeholder_type": obj.action_by.stakeholder_type,
                "stakeholder_title": obj.action_by.stakeholder_title
            }
        return None
# --------------------------------------------------------
# Pictorial Archive
# --------------------------------------------------------
class PictorialArchiveSerializer(serializers.ModelSerializer):
    project_name = serializers.SerializerMethodField()
    class Meta:
        model = PictorialArchive
        fields = ['id', 'project', 'project_name', 'image', 'image_date', 'description', 'created_at', 'updated_at' ]

    def get_project_name(self, obj):
        return obj.project.project_name