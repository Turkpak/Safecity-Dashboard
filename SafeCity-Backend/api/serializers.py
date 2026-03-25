from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import *
from django.contrib.gis.geos import GEOSGeometry
import json
from django.contrib.auth import get_user_model
from .utils import parse_xer
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
    class Meta:
        model = ProjectActivity
        fields = ["id", "project", "project_name", "activity_id", "activity_name", "start_date", "end_date", "progress"]
    
    def get_project_name(self, obj):
        return obj.project.project_name

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

        # Assign ManyToMany
        project.stakeholder.set(stakeholders)

        # Assign XER file
        if xer_file:
            project.xer_file = xer_file
            project.save()
            self._save_activities(project)  # 🔥 Parse XER and save activities

        # Handle GeoJSON
        if boundary_file:
            try:
                boundary_file.seek(0)
                geojson_data = json.load(boundary_file)
                geometry = (
                    geojson_data["features"][0]["geometry"]
                    if geojson_data.get("type") == "FeatureCollection"
                    else geojson_data.get("geometry")
                )
                project.geom = GEOSGeometry(json.dumps(geometry))
                project.boundary_file = boundary_file
            except Exception as e:
                raise serializers.ValidationError({"boundary_file": f"Invalid GeoJSON: {e}"})

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
            instance.xer_file = xer_file
            instance.save()
            # Delete old activities and parse new ones
            instance.activities.all().delete()
            self._save_activities(instance)

        # Handle GeoJSON
        if boundary_file:
            try:
                boundary_file.seek(0)
                geojson_data = json.load(boundary_file)
                geometry = (
                    geojson_data["features"][0]["geometry"]
                    if geojson_data.get("type") == "FeatureCollection"
                    else geojson_data.get("geometry")
                )
                instance.geom = GEOSGeometry(json.dumps(geometry))
                instance.boundary_file = boundary_file
            except Exception as e:
                raise serializers.ValidationError({"boundary_file": f"Invalid GeoJSON: {e}"})

        instance.save()
        return instance

    # ---------- Private: Parse XER and save tasks ----------
    def _save_activities(self, project):

        data = parse_xer(project.xer_file.path)

        wbs = data["wbs"]
        tasks = data["tasks"]

        wbs_objects = {}

        # Create WBS nodes.
        # IMPORTANT: create parents before children (dict iteration order is not guaranteed
        # to match hierarchy), otherwise parent links can be lost.
        def wbs_depth(wbs_id, _seen=None):
            if _seen is None:
                _seen = set()
            if wbs_id in _seen:
                return 0
            _seen.add(wbs_id)
            parent_id = (wbs.get(wbs_id) or {}).get("parent")
            if not parent_id:
                return 0
            return 1 + wbs_depth(parent_id, _seen=_seen)

        for wbs_id in sorted(wbs.keys(), key=wbs_depth):
            w = wbs[wbs_id]
            parent = wbs_objects.get(w.get("parent"))
            obj = ProjectActivity.objects.create(
                project=project,
                activity_id=wbs_id,
                activity_name=w.get("name"),
                parent=parent,
            )
            wbs_objects[wbs_id] = obj

        # Create tasks
        for task in tasks:

            parent = wbs_objects.get(task["wbs_id"])

            # Store as DateField (YYYY-MM-DD); strip time if present.
            start = task.get("start_date")
            end = task.get("end_date")
            if isinstance(start, str):
                start = start.split(" ")[0].split("T")[0]
            if isinstance(end, str):
                end = end.split(" ")[0].split("T")[0]

            # Frontend expects progress in percent 0..100.
            from .utils import normalize_progress_to_percent, recompute_project_activity_rollups

            prog = normalize_progress_to_percent(task.get("progress"))

            ProjectActivity.objects.create(
                project=project,
                activity_id=task["activity_id"],
                activity_name=task["activity_name"],
                parent=parent,
                start_date=start,
                end_date=end,
                progress=prog
            )

        # Roll up WBS/summary rows so Gantt/WBS can render correct header spans and progress.
        recompute_project_activity_rollups(project)
class SubActivitySerializer(serializers.ModelSerializer):
    class Meta:
        model = ProjectActivity
        fields = ['id', 'title', 'planned_progress', 'actual_progress', 'start_date', 'end_date', 'owner']

class ActivitySerializer(serializers.ModelSerializer):
    children = serializers.SerializerMethodField()

    class Meta:
        model = ProjectActivity
        fields = ['id', 'title', 'weight', 'status', 'children']

    def get_children(self, obj):
        # Fetch sub-activities where parent == this activity
        sub_activities = ProjectActivity.objects.filter(parent=obj)
        return SubActivitySerializer(sub_activities, many=True).data
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