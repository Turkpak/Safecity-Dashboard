from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import *

router = DefaultRouter()

#--------------------------------- Province View ---------------------------------
router.register(r'create-province', ProvinceCreateView, basename='create-province')
router.register(r'list-province', ListProvinceView, basename='list-province')
router.register(r'update-province', ProvinceUpdateView, basename='update-province') 
router.register(r'delete-province', ProvinceDeleteView, basename='delete-province')

#--------------------------------- Division View ---------------------------------
router.register(r'create-division', DivisionCreateView, basename='create-division')
router.register(r'list-division', ListDivisionView, basename='list-division')
router.register(r'update-division', DivisionUpdateView, basename='update-division') 
router.register(r'delete-division', DivisionDeleteView, basename='delete-division')

#--------------------------------- District View ---------------------------------
router.register(r'create-district', DistrictCreateView, basename='create-district')
router.register(r'list-district', ListDistrictView, basename='list-district')
router.register(r'update-district', DistrictUpdateView, basename='update-district') 
router.register(r'delete-district', DistrictDeleteView, basename='delete-district')

#---------------------------------- Tehsil View ----------------------------------
router.register(r'create-tehsil', TehsilCreateView, basename='create-tehsil')
router.register(r'list-tehsil', ListTehsilView, basename='list-tehsil')
router.register(r'update-tehsil', TehsilUpdateView, basename='update-tehsil') 
router.register(r'delete-tehsil', TehsilDeleteView, basename='delete-tehsil')

#---------------------------------- Stakeholder View ----------------------------------
router.register(r'create-stakeholder', StakeholderCreateView, basename='create-stakeholder')
router.register(r'list-stakeholder', ListStakeholderView, basename='list-stakeholder')
router.register(r'update-stakeholder', StakeholderUpdateView, basename='update-stakeholder')
router.register(r'delete-stakeholder', StakeholderDeleteView, basename='delete-stakeholder')

#---------------------------------- Project View ----------------------------------
router.register(r'create-project', ProjectCreateView, basename='create-project')
router.register(r'list-project', ListProjectView, basename='list-project')
router.register(r'update-project', ProjectUpdateView, basename='update-project') 
router.register(r'delete-project', ProjectDeleteView, basename='delete-project')

urlpatterns = [
    path('admin/', admin.site.urls),
    path('api/', include(router.urls)),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)