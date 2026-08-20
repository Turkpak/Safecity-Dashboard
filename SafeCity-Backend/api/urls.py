from django.contrib import admin
from django.conf import settings
from django.conf.urls.static import static
from django.urls import path, include
from rest_framework.routers import DefaultRouter
from api.views import *

router = DefaultRouter()

#--------------------------------- User View ---------------------------------
router.register(r'create-user', UserCreateView, basename='create-user')
router.register(r'login-user', UserLoginDashboardCreateView, basename='login-user')
router.register(r'get-user', GetUserView, basename='get-user')
router.register(r'update-user', UserUpdateView, basename='update-user')
router.register(r'user-permissions', UserPermissionViewSet, basename='user-permissions')

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
router.register(r'top-projects', TopProjectsView, basename='top-projects')
router.register(r'project-update-logs', ProjectUpdateLogView, basename='project-update-logs')

#---------------------------------- Project Activity View ----------------------------------
router.register(r'create-project-activity', ProjectActivityCreateView, basename='create-project-activity')
router.register(r'list-project-activity', ListProjectActivityView, basename='list-project-activity')
router.register(r'update-project-activity', ProjectActivityUpdateView, basename='update-project-activity')
router.register(r'delete-project-activity', ProjectActivityDeleteView, basename='delete-project-activity')
# router.register(r'project-gantt', ProjectGanttView, basename='project-gantt')

router.register(r'create-progress-image', ProgressImageCreateViewSet, basename='create-progress-image')
router.register(r'list-progress-image', ListProgressImageView, basename='list-progress-image')
router.register(r'update-progress-image', ProgressImageUpdateView, basename='update-progress-image')
router.register(r'delete-progress-image', DeleteProgressImageView, basename='delete-progress-image')

#--------------------------------- Pictorial Archive View ---------------------------------
router.register(r'create-pictorial-archive', PictorialArchiveCreateView, basename='create-pictorial-archive')
router.register(r'list-pictorial-archive', ListPictorialArchiveView, basename='list-pictorial-archive')
router.register(r'update-pictorial-archive', PictorialArchiveUpdateView, basename='update-pictorial-archive')
router.register(r'delete-pictorial-archive', PictorialArchiveDeleteView, basename='delete-pictorial-archive')

# ---------------------------------- Project Document View ----------------------------------

router.register(r'create-project-document', ProjectDocumentCreateView, basename='create-project-document')
router.register(r'list-project-document', ListProjectDocumentView, basename='list-project-document')
router.register(r'update-project-document', UpdateProjectDocumentView, basename='update-project-document')

urlpatterns = [

    path('api/', include(router.urls)),

    path('', include(router.urls)),

    # ✅ Gantt API
    path('project-gantt/<int:project_id>/', ProjectGanttView.as_view(), name='project-gantt'),

    # ✅ NEW: Update Actual Task Data
    path('update-task-actual/<int:task_id>/', UpdateTaskActualView.as_view(), name='update-task-actual'),

    # urls.py
    path('project-gantt-nested/<int:project_id>/', ProjectGanttNestedView.as_view(), name='project-gantt-nested'),

    path('project-gantt-all/', ProjectGanttAllView.as_view(), name='project-gantt-all'),
    # *
    path('project-summary/', ProjectSummaryView.as_view(), name='project-summary'),

    path("add-delay-log/", ActivityDelayLogCreateView.as_view()),
    path("list-delay-log/", ActivityDelayLogListView.as_view()),
    path("update-delay-log/<int:pk>/", ActivityDelayLogUpdateView.as_view()),

    path("project-progress-summary/", ProjectProgressSummaryView.as_view()),
    path("dashboard-progress-summary/", DashboardProgressSummaryView.as_view(), name="dashboard-progress-summary"),
    path("project-status-summary/", ProjectStatusSummaryView.as_view()),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)