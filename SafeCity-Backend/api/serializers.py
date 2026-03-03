from rest_framework import serializers
from rest_framework_gis.serializers import GeoFeatureModelSerializer
from .models import *
from django.contrib.gis.geos import GEOSGeometry
import json

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
    class Meta:
        model = ProjectActivity
        fields = [
            'id',
            'project',
            'activity_id',
            'activity_name',
            'start_date',
            'finish_date',
            'percent_complete'
        ]
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
            'created_at', 'updated_at', 'activities'
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