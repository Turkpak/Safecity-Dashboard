from django.db import models
from django.utils import timezone 
from django.contrib.auth.base_user import AbstractBaseUser,BaseUserManager
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.validators import FileExtensionValidator
from django.contrib.gis.db import models as gis_models
from .utils import project_doc_file_path, project_image_file_path
from dateutil.relativedelta import relativedelta
from django.conf import settings
from django.db.models.signals import pre_save
from django.dispatch import receiver
# from xerparser.xer import Reader

from django.contrib.auth.models import (
    AbstractBaseUser,
    BaseUserManager,
    PermissionsMixin
)

# --------------------------------------------------------
# User Manager
# --------------------------------------------------------

class MyUserManager(BaseUserManager):

    def create_user(self, email, company_name, password=None, **extra_fields):
        if not email:
            raise ValueError("Users must have an email address")

        email = self.normalize_email(email)

        user = self.model(
            email=email,
            company_name=company_name,
            **extra_fields
        )

        user.set_password(password)
        user.is_active = True
        user.save(using=self._db)
        return user

    def create_superuser(self, email, company_name, password=None, **extra_fields):

        extra_fields.setdefault('role', 'super_admin')
        extra_fields.setdefault('is_staff', True)
        extra_fields.setdefault('is_superuser', True)
        extra_fields.setdefault('is_verified', True)

        if extra_fields.get('is_staff') is not True:
            raise ValueError('Superuser must have is_staff=True.')

        if extra_fields.get('is_superuser') is not True:
            raise ValueError('Superuser must have is_superuser=True.')

        return self.create_user(
            email,
            company_name,
            password,
            **extra_fields
        )


# --------------------------------------------------------
# Custom User Model
# --------------------------------------------------------

class MyUser(AbstractBaseUser, PermissionsMixin):

    ROLE_CHOICES = (
        ('super_admin', 'Super Admin'),
        ('contractor', 'Contractor'),
        ('consultant', 'Consultant'),
    )

    email = models.EmailField(max_length=255, unique=True)

    stakeholder = models.ForeignKey(
        'Stakeholder',
        on_delete=models.DO_NOTHING,
        null=True,
        blank=True
    )

    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255)

    role = models.CharField(
        max_length=20,
        choices=ROLE_CHOICES,
        default='contractor'
    )

    companyLogo = models.ImageField(null=True, blank=True)
    profileImage = models.ImageField(null=True, blank=True)

    country = models.CharField(max_length=200, null=True, blank=True)
    address = models.CharField(max_length=400, null=True, blank=True)
    city = models.CharField(max_length=200, null=True, blank=True)
    zipcode = models.CharField(max_length=200, null=True, blank=True)

    # 🔐 Required Django Permission Fields
    is_active = models.BooleanField(default=True)
    is_staff = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)

    created_at = models.DateTimeField(default=timezone.now)

    objects = MyUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['company_name']

    def __str__(self):
        return self.email

    def get_full_name(self):
        return f"{self.first_name} {self.last_name}".strip()

    def get_short_name(self):
        return self.first_name

    def tokens(self):
        refresh = RefreshToken.for_user(self)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token)
        }
    
# --------------------------------------------------------
# Stakeholder Model
# --------------------------------------------------------

class Stakeholder(models.Model):
    # TYPE_CHOICES = (
    #     ('Client', 'Client'),
    #     ('Consultant', 'Consultant'),
    #     ('Contractor', 'Contractor'),
    #     ('Subcontractor', 'Subcontractor'),
    #     ('Supplier', 'Supplier'),
    #     ('Regulatory_Authority', 'Regulatory_Authority'),
    #     ('Other', 'Other'),
    # )
    # stakeholder_type = models.CharField(max_length=255, choices=TYPE_CHOICES)
    stakeholder_type = models.CharField(max_length=255)
    stakeholder_title = models.CharField(max_length=255)
    status_choices = (
        ('active', 'Active'),
        ('disable', 'Disable'),
    )
    status = models.CharField(max_length=255, choices=status_choices, default='active')

# --------------------------------------------------------
# Provices Administrative Divisions
# --------------------------------------------------------
class Province(models.Model):
    province_name = models.CharField(max_length=100)

    def __str__(self):
        return self.province_name

# --------------------------------------------------------
# Divisions Administrative Divisions
# --------------------------------------------------------
class Division(models.Model):
    division_name = models.CharField(max_length=100)
    province = models.ForeignKey(Province, on_delete=models.CASCADE, related_name='divisions')

    def __str__(self):
        return self.division_name

# --------------------------------------------------------
# Districts Administrative Divisions
# --------------------------------------------------------
class District(models.Model):
    district_name = models.CharField(max_length=100)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, related_name='districts')
    province = models.ForeignKey(Province, on_delete=models.CASCADE, related_name='districts')

    def __str__(self):
        return self.district_name

# --------------------------------------------------------
# Tehsils Administrative Divisions
# --------------------------------------------------------
class Tehsil(models.Model):
    tehsil_name = models.CharField(max_length=100)
    district = models.ForeignKey(District, on_delete=models.CASCADE, related_name='tehsils')
    division = models.ForeignKey(Division, on_delete=models.CASCADE, related_name='tehsils')
    province = models.ForeignKey(Province, on_delete=models.CASCADE, related_name='tehsils')

    def __str__(self):
        return self.tehsil_name
    
# --------------------------------------------------------
# Projects
# --------------------------------------------------------
class Project(models.Model):
    stakeholder = models.ManyToManyField(Stakeholder, related_name='projects', blank=True)
    project_name = models.CharField(max_length=255, null=True, blank=True)
    project_description = models.TextField(null=True, blank=True)
    project_starting_date = models.DateField(null=True, blank=True)
    project_reference_no = models.CharField(max_length=200, null=True, blank=True)
    province = models.ForeignKey(Province, on_delete=models.CASCADE, default=None)
    division = models.ForeignKey(Division, on_delete=models.CASCADE, default=None)
    district = models.ForeignKey(District, on_delete=models.CASCADE, default=None)
    tehsil = models.ForeignKey(Tehsil, on_delete=models.CASCADE, default=None)
    total_budget_allocated = models.CharField(max_length=200, null=True, blank=True)
    budget_utilized = models.CharField(max_length=200, null=True, blank=True)
    budget_variance = models.CharField(max_length=200, null=True, blank=True)
    budget_remaining = models.CharField(max_length=200, null=True, blank=True)
    xer_file = models.FileField(upload_to=project_doc_file_path, validators=[FileExtensionValidator(allowed_extensions=['xer'])],null=True, blank=True, max_length=500) 

    geom = gis_models.MultiPolygonField(srid=4326, null=True, blank=True)

    allocation_capital_cost = models.FloatField(default=0, null=True, blank=True)
    allocation_revenue_cost = models.FloatField(default=0, null=True, blank=True)  
    allocation_total_cost = models.FloatField(default=0, null=True, blank=True)

    pd_release_capital_cost = models.FloatField(default=0, null=True, blank=True)
    pd_release_cost = models.FloatField(default=0, null=True, blank=True)
    pd_release_total_cost = models.FloatField(default=0, null=True, blank=True)

    spending_release_capital_cost = models.FloatField(default=0, null=True, blank=True)
    spending_release_revenue_cost = models.FloatField(default=0, null=True, blank=True)
    spending_release_total_cost = models.FloatField(default=0, null=True, blank=True)   

    pifra_utilization_capital_cost = models.FloatField(default=0, null=True, blank=True)
    pifra_utilization_revenue_cost = models.FloatField(default=0, null=True, blank=True)
    pifra_utilization_total_cost = models.FloatField(default=0, null=True, blank=True)
    pifra_utilization_date = models.DateField(null=True, blank=True)

    percentage_utilization_capital = models.FloatField(default=0, null=True, blank=True)
    percentage_utilization_revenue = models.FloatField(default=0, null=True, blank=True)
    percentage_utilization_total = models.FloatField(default=0, null=True, blank=True)

    created_at = models.DateTimeField(auto_now_add=True) 
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.project_name


    def save(self, *args, **kwargs):

        # ---------- Budget ----------
        try:
            total = float(self.total_budget_allocated or 0)
            utilized = float(self.budget_utilized or 0)
        except (ValueError, TypeError):
            total = 0
            utilized = 0

        self.budget_variance = total - utilized
        self.budget_remaining = max(total - utilized, 0)

        # ---------- Allocation ----------
        self.allocation_total_cost = (
            (self.allocation_capital_cost or 0) +
            (self.allocation_revenue_cost or 0)
        )

        # ---------- PD Release ----------
        self.pd_release_total_cost = (
            (self.pd_release_capital_cost or 0) +
            (self.pd_release_cost or 0)
        )

        # ---------- Spending Release ----------
        self.spending_release_total_cost = (
            (self.spending_release_capital_cost or 0) +
            (self.spending_release_revenue_cost or 0)
        )

        # ---------- PIFRA Utilization ----------
        self.pifra_utilization_total_cost = (
            (self.pifra_utilization_capital_cost or 0) +
            (self.pifra_utilization_revenue_cost or 0)
        )

        # =====================================================
        # 🔥 PERCENTAGE FORMULAS (FINAL CORRECT VERSION)
        # =====================================================

        # ---------- TOTAL % ----------
        if self.allocation_total_cost and self.allocation_total_cost > 0:
            self.percentage_utilization_total = round(
                (self.pifra_utilization_total_cost / self.allocation_total_cost) * 100, 2
            )
        else:
            self.percentage_utilization_total = 0

        # ---------- CAPITAL % ----------
        if self.allocation_capital_cost and self.allocation_capital_cost > 0:
            self.percentage_utilization_capital = round(
                (self.pifra_utilization_capital_cost / self.allocation_capital_cost) * 100, 2
            )
        else:
            self.percentage_utilization_capital = 0

        # ---------- REVENUE % ----------
        if self.allocation_revenue_cost and self.allocation_revenue_cost > 0:
            self.percentage_utilization_revenue = round(
                (self.pifra_utilization_revenue_cost / self.allocation_revenue_cost) * 100, 2
            )
        else:
            self.percentage_utilization_revenue = 0

        super().save(*args, **kwargs)

    def parse_xer_file(self):
        """
        Parse the attached XER file and populate ProjectActivity / TaskDependency.
        Safe to call multiple times; it will no-op if there is no XER or activities already exist.
        """
        if not self.xer_file:
            return
        if self.activities.exists():
            return

        from api.utils import parse_xer
        from django.db import transaction

        # Ensure file pointer is at start (StorageFile supports open()).
        with self.xer_file.open("rb") as f:
            data = parse_xer(f)

        wbs = data.get("wbs", {})
        tasks = data.get("tasks", [])
        dependencies = data.get("dependencies", [])

        wbs_objects = {}
        task_map = {}

        with transaction.atomic():
            # 1) WBS nodes
            for wbs_id, w in wbs.items():
                parent = wbs_objects.get(w.get("parent"))
                obj = ProjectActivity.objects.create(
                    project=self,
                    activity_id=wbs_id,
                    activity_name=w.get("name"),
                    parent=parent,
                    task_type="wbs",
                )
                wbs_objects[wbs_id] = obj

            # 2) TASK nodes
            for task in tasks:
                parent = wbs_objects.get(task.get("wbs_id"))
                start = task.get("start_date")
                end = task.get("end_date")
                start = start.split(" ")[0] if isinstance(start, str) and start else None
                end = end.split(" ")[0] if isinstance(end, str) and end else None
                task_type = "milestone" if start and end and start == end else "task"

                obj = ProjectActivity.objects.create(
                    project=self,
                    activity_id=task.get("activity_id"),
                    activity_name=task.get("activity_name"),
                    parent=parent,
                    start_date=start,
                    end_date=end,
                    progress=task.get("progress") or 0,
                    duration=task.get("duration") or 0,
                    task_type=task_type,
                )
                task_map[task.get("activity_id")] = obj

            # 3) Dependencies
            for dep in dependencies:
                task_obj = task_map.get(dep.get("task_id"))
                pred_obj = task_map.get(dep.get("pred_task_id"))
                if task_obj and pred_obj:
                    TaskDependency.objects.create(
                        project=self,
                        task=task_obj,
                        predecessor=pred_obj,
                        type=dep.get("type"),
                    )
        
class ProjectActivity(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="activities")

    activity_id = models.CharField(max_length=100, null=True, blank=True)
    activity_name = models.CharField(max_length=255, null=True, blank=True)

    parent = models.ForeignKey(
        "self",
        null=True,
        blank=True,
        related_name="children",
        on_delete=models.CASCADE
    )

    # ✅ PLANNED (from XER)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)

    # ✅ ACTUAL (user input)
    actual_start = models.DateField(null=True, blank=True)
    actual_end = models.DateField(null=True, blank=True)

    remarks = models.TextField(null=True, blank=True)

    progress = models.FloatField(default=0)
    progress_date = models.DateField(null=True, blank=True)
    progress_status = models.CharField(
        max_length=20,
        default="Not Started",
        choices=[
            ("Not Started", "Not Started"),
            ("In Progress", "In Progress"),
            ("Completed", "Completed")
        ]
    )
    
    duration = models.FloatField(null=True, blank=True)

    task_type = models.CharField(max_length=20, default="task")

    class Meta:
        ordering = []
    def __str__(self):
        return f"{self.activity_name} ({self.project.project_name})"
    @property
    def duration_display(self):
        if self.duration:
            return f"{int(self.duration)} day" if self.duration == 1 else f"{int(self.duration)} days"
        return "0 days"
    
    # -----------------------------
    # Property to calculate total duration including subtasks
    # -----------------------------
    @property
    def total_duration(self):
        if self.children.exists():
            return sum(child.duration or 0 for child in self.children.all())
        return self.duration or 0
    
# -----------------------------
# Signal: Auto-calculate duration before saving
# -----------------------------
@receiver(pre_save, sender=ProjectActivity)
def update_activity_fields(sender, instance, **kwargs):
    # Calculate duration
    if instance.start_date and instance.end_date:
        instance.duration = (instance.end_date - instance.start_date).days + 1

    # Update progress_status based on progress
    if instance.progress == 0:
        instance.progress_status = "Not Started"
    elif instance.progress >= 100:
        instance.progress_status = "Completed"
    else:
        instance.progress_status = "In Progress"
    
class ProgressImage(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="images")
    activity = models.ForeignKey(ProjectActivity, on_delete=models.CASCADE, related_name="images")

    image = models.ImageField(upload_to=project_image_file_path)

    caption = models.CharField(max_length=255, null=True, blank=True)
    image_date = models.DateField(null=True, blank=True)

    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.activity.activity_name} - {self.image_date}"

class ProjectDocument(models.Model):
    project = models.ForeignKey(
        'Project',
        on_delete=models.CASCADE,
        related_name='documents'
    )

    activity = models.ForeignKey(
        'ProjectActivity',
        on_delete=models.CASCADE,
        related_name='documents',
        null=True,
        blank=True
    )

    file = models.FileField(
        upload_to='project_documents/',
        validators=[FileExtensionValidator(allowed_extensions=['pdf', 'docx', 'doc', 'xlsx'])],
        max_length=500,
        null=True,   
        blank=True  
    )

    title = models.CharField(max_length=255, null=True, blank=True)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return self.title or f"Document {self.id}"
    
class TaskDependency(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE)
    task = models.ForeignKey(ProjectActivity, related_name="successors", on_delete=models.CASCADE)
    predecessor = models.ForeignKey(ProjectActivity, related_name="predecessors", on_delete=models.CASCADE)
    type = models.CharField(max_length=10)  # FS, SS, FF


class ActivityDelayLog(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name="delay_logs")
    activity = models.ForeignKey(ProjectActivity, on_delete=models.CASCADE, related_name="delay_logs")

    # dates
    delay_start_date = models.DateField()
    delay_end_date = models.DateField()
    delay_days = models.IntegerField(default=0)

    # details
    originator = models.CharField(max_length=100, null=True, blank=True)
    category = models.CharField(max_length=100, null=True, blank=True)
    action_by = models.ForeignKey(Stakeholder, on_delete=models.DO_NOTHING, null=True, blank=True)

    issue = models.TextField(null=True, blank=True)
    recommended_action = models.TextField(null=True, blank=True)

    # tracking
    created_by = models.ForeignKey(MyUser, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def save(self, *args, **kwargs):
        # auto calculate delay days
        if self.delay_start_date and self.delay_end_date:
            self.delay_days = max(
                0,
                (self.delay_end_date - self.delay_start_date).days
            )
        super().save(*args, **kwargs)

    def __str__(self):
        return f"{self.activity.activity_name} - {self.delay_days} days delay"
# --------------------------------------------------------
# Pictorial Archive
# --------------------------------------------------------
class PictorialArchive(models.Model):
    project = models.ForeignKey(Project, on_delete=models.CASCADE, related_name='pictorial_archive')
    image = models.ImageField(upload_to=project_image_file_path)
    image_date = models.DateField()
    description = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        ordering = ['-image_date', '-created_at']

    def __str__(self):
        return f"{self.project.project_name} - {self.image_date}"



class UserPermission(models.Model):
    user = models.ForeignKey(settings.AUTH_USER_MODEL, on_delete=models.CASCADE)
    sidebar_label = models.CharField(max_length=100)  # e.g., "Project Management"
    sub_label = models.CharField(max_length=255, blank=True, null=True)
    can_view = models.BooleanField(default=False)
    can_create = models.BooleanField(default=False)
    can_update = models.BooleanField(default=False)
    can_delete = models.BooleanField(default=False)

    # Track who gave/updated the permission
    created_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="permissions_created"
    )
    updated_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name="permissions_updated"
    )

    class Meta:
        unique_together = ('user', 'sidebar_label', 'sub_label')

    def __str__(self):
        return f"{self.user.email} - {self.sidebar_label}"