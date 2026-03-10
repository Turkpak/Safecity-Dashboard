from rest_framework.permissions import *
from rest_framework.response import Response
from rest_framework.views import APIView
from django.contrib.auth import authenticate, logout, login
import api.utils  as utils
from api.utils import *
from rest_framework import viewsets, permissions, status
from ..models import *
from ..serializers import *
from django.db.models import Q
from django.db import IntegrityError
from django.db.models import ProtectedError
from rest_framework.parsers import MultiPartParser, FormParser
from ..permissions import *
# from ..utils.xer_parser import get_xer_gantt_data