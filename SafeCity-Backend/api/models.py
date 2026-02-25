from django.db import models
from django.utils import timezone 
from django.contrib.auth.base_user import AbstractBaseUser,BaseUserManager
from rest_framework_simplejwt.tokens import RefreshToken
from django.core.validators import FileExtensionValidator
from django.contrib.gis.db import models as gis_models
from .utils import project_doc_file_path, project_image_file_path
from dateutil.relativedelta import relativedelta

# --------------------------------------------------------
# User Manager Model
# --------------------------------------------------------

class MyUserManager(BaseUserManager):
    def create_user(self, email, company_name, password=None):
        """
        Creates and saves a User with the given email, date of
        birth and password.
        """
        if not email:
            raise ValueError('Users must have an email address')

        user = self.model(
            email=self.normalize_email(email),
            company_name=company_name,
        )

        user.set_password(password)
        user.save(using=self._db)
        return user

    def create_superuser(self, email, company_name, password=None):
        """
        Creates and saves a superuser with the given email, date of
        birth and password.
        """
        user = self.create_user(
            email,
            password=password,
            company_name=company_name,
        )
        user.is_admin = True
        user.save(using=self._db)
        return user
    
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
# Custom User Model
# --------------------------------------------------------

class MyUser(AbstractBaseUser):
    email = models.EmailField(
        max_length=255,
        unique=True,
    )
    stakeholder = models.ForeignKey(Stakeholder, on_delete=models.DO_NOTHING, null=True, blank=True)
    first_name = models.CharField(max_length=255)
    last_name = models.CharField(max_length=255)
    company_name = models.CharField(max_length=255)
    # companyLogo  = models.URLField(null=True,blank=True)
    companyLogo = models.ImageField(
        # upload_to=project_image_file_path,
        null=True,
        blank=True
    )
    is_active = models.BooleanField(default=True)
    country = models.CharField(max_length=200, null=True, blank=True)
    address = models.CharField(max_length=400, null=True, blank=True)
    city = models.CharField(max_length=200, null=True, blank=True)
    zipcode = models.CharField(max_length=200, null=True, blank=True)
    is_admin = models.BooleanField(default=False)
    is_verified = models.BooleanField(default=False)
    profileImage  =  models.ImageField(
        # upload_to=project_image_file_path,
        null=True,
        blank=True
    )

    objects = MyUserManager()

    USERNAME_FIELD = 'email'
    REQUIRED_FIELDS = ['company_name']

    def __str__(self):
        return self.email

    def has_perm(self, perm, obj=None):
        "Does the user have a specific permission?"
        # Simplest possible answer: Yes, always
        return True

    def has_module_perms(self, app_label):
        "Does the user have permissions to view the app `app_label`?"
        # Simplest possible answer: Yes, always
        return True

    @property
    def is_staff(self):
        "Is the user a member of staff?"
        # Simplest possible answer: All admins are staff
        return self.is_admin

    @property
    def get_full_name(self):
        '''
        Returns the first_name plus the last_name, with a space in between.
        '''
        full_name = '%s %s' % (self.first_name, self.last_name)
        return full_name.strip()

    def tokens(self):
        refresh = RefreshToken.for_user(self)
        return {
            'refresh': str(refresh),
            'access': str(refresh.access_token)
        }

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
    stakeholder = models.ForeignKey(Stakeholder, on_delete=models.CASCADE, related_name='project')
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
    xer_file = models.FileField(upload_to=project_doc_file_path, validators=[FileExtensionValidator(allowed_extensions=['xer'])],null=True, blank=True) 
    boundary_file = models.FileField(
        upload_to=project_doc_file_path,
        validators=[FileExtensionValidator(allowed_extensions=['geojson', 'json'])],
        null=True,
        blank=True
    )

    geom = gis_models.MultiPolygonField(srid=4326, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True) 
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return self.project_name

    
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
