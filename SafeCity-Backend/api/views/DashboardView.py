from __future__ import annotations

from collections import defaultdict
from decimal import Decimal, InvalidOperation

from django.core.cache import cache
from django.db.models import Prefetch

from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from .common_imports import *
from api.progress_calculations import calculate_project_physical_progress_map

CACHE_TIMEOUT_SECONDS = 60


# ============================================================
# Helpers
# ============================================================

def _number(value):
    """
    Convert database values such as:
        "100000"
        "100,000"
        Decimal(...)
        None

    into float.
    """
    if value in (None, ""):
        return 0.0

    try:
        return max(
            0.0,
            float(
                Decimal(
                    str(value)
                    .replace(",", "")
                    .strip()
                )
            )
        )
    except (InvalidOperation, TypeError, ValueError):
        return 0.0


def _percent(value):
    """
    Normalize percentage values.

    0.5   -> 50
    50    -> 50
    150   -> 100
    """
    value = _number(value)

    if 0 < value <= 1:
        value *= 100

    return round(
        max(0.0, min(100.0, value)),
        2
    )


def _activity_weight(activity):
    """
    Duration is used as the weight when calculating
    project physical progress.
    """
    return max(
        _number(activity.duration),
        1.0
    )


# ============================================================
# Physical Progress
# ============================================================

def _calculate_project_physical_progress(activities):
    """
    Calculate one physical-progress value for a project.

    Parent/WBS activities are calculated from their children.
    Leaf activities use their own progress.
    """

    if not activities:
        return 0.0

    by_parent = defaultdict(list)

    for activity in activities:
        by_parent[activity.parent_id].append(activity)

    calculated = {}

    def node_value(activity):

        if activity.id in calculated:
            return calculated[activity.id]

        children = by_parent.get(activity.id, [])

        # -----------------------------------------
        # Parent / WBS
        # -----------------------------------------
        if children:

            weighted_total = 0.0
            total_weight = 0.0

            for child in children:

                child_progress, child_weight = node_value(child)

                weighted_total += (
                    child_progress * child_weight
                )

                total_weight += child_weight

            if total_weight:
                progress = (
                    weighted_total /
                    total_weight
                )
            else:
                progress = _percent(
                    activity.progress
                )

            weight = max(
                total_weight,
                _activity_weight(activity)
            )

        # -----------------------------------------
        # Leaf task
        # -----------------------------------------
        else:

            progress = _percent(
                activity.progress
            )

            weight = _activity_weight(
                activity
            )

        calculated[activity.id] = (
            progress,
            weight
        )

        return calculated[activity.id]

    roots = (
        by_parent.get(None, [])
        or activities
    )

    weighted_total = 0.0
    total_weight = 0.0

    for root in roots:

        progress, weight = node_value(root)

        weighted_total += (
            progress * weight
        )

        total_weight += weight

    if not total_weight:
        return 0.0

    return round(
        weighted_total / total_weight,
        2
    )


# ============================================================
# Project Metrics
# ============================================================

def _project_metrics(project, physical_progress=None, has_physical_data=None):

    activities = list(
        project.activities.all()
    )

    if physical_progress is None:
        project_progress_map = calculate_project_physical_progress_map(
            [project.id]
        )
        has_physical_data = project.id in project_progress_map
        physical_progress = project_progress_map.get(
            project.id,
            0.0
        )

    elif has_physical_data is None:
        has_physical_data = True

    # --------------------------------------------------------
    # Financial
    # --------------------------------------------------------

    total_budget = _number(
        project.total_budget_allocated
    )

    budget_utilized = _number(
        project.budget_utilized
    )

    # --------------------------------------------------------
    # Financial Progress Overview fields
    # --------------------------------------------------------

    allocation_total_cost = _number(
        project.allocation_total_cost
    )

    pd_release_total_cost = _number(
        project.pd_release_total_cost
    )

    spending_release_total_cost = _number(
        project.spending_release_total_cost
    )

    pifra_utilization_total_cost = _number(
        project.pifra_utilization_total_cost
    )

    # IMPORTANT:
    # Use the value already stored in Project.
    # Do NOT calculate this again.
    percentage_utilization_total = _number(
        project.percentage_utilization_total
    )

    if total_budget:

        financial_progress = round(
            min(
                100.0,
                (
                    budget_utilized /
                    total_budget
                ) * 100
            ),
            2
        )

    else:
        financial_progress = 0.0

    # --------------------------------------------------------
    # Delay
    # --------------------------------------------------------

    has_delay = any(
        bool(activity.delay_logs.all())
        for activity in activities
    )

    # --------------------------------------------------------
    # Status
    # --------------------------------------------------------

    if has_delay:
        status = "in_delay"

    elif physical_progress >= 100:
        status = "completed"

    elif physical_progress > 0:
        status = "in_progress"

    else:
        status = "pending"

    # --------------------------------------------------------
    # Overall progress
    # --------------------------------------------------------

    overall_progress = round(
        (
            physical_progress +
            financial_progress
        ) / 2,
        2
    )

    return {

        "id": project.id,

        "project_name": (
            project.project_name
            or f"Project #{project.id}"
        ),

        "project_reference_no":
            project.project_reference_no,

        # Hierarchy
        "province": project.province_id,

        "province_name": (
            project.province.province_name
            if project.province_id
            else None
        ),

        "division": project.division_id,

        "division_name": (
            project.division.division_name
            if project.division_id
            else None
        ),

        "district": project.district_id,

        "district_name": (
            project.district.district_name
            if project.district_id
            else None
        ),

        "tehsil": project.tehsil_id,

        "tehsil_name": (
            project.tehsil.tehsil_name
            if project.tehsil_id
            else None
        ),

        # Location
        "latitude": (
            project.geom.centroid.y
            if project.geom
            else None
        ),

        "longitude": (
            project.geom.centroid.x
            if project.geom
            else None
        ),

        # ----------------------------------------------------
        # Existing financial fields
        # ----------------------------------------------------

        "total_budget":
            round(total_budget, 2),

        "total_consume":
            round(budget_utilized, 2),

        "remaining_budget":
            round(
                max(
                    total_budget -
                    budget_utilized,
                    0.0
                ),
                2
            ),

        # ----------------------------------------------------
        # NEW: Financial Progress Overview
        # ----------------------------------------------------

        "allocation_total_cost":
            round(allocation_total_cost, 2),

        "pd_release_total_cost":
            round(pd_release_total_cost, 2),

        "spending_release_total_cost":
            round(spending_release_total_cost, 2),

        "pifra_utilization_total_cost":
            round(pifra_utilization_total_cost, 2),

        "percentage_utilization_total":
            round(percentage_utilization_total, 2),

        # Progress
        "physical_progress":
            physical_progress,

        "financial_progress":
            financial_progress,

        "overall_progress":
            overall_progress,

        "has_physical_data":
            bool(has_physical_data),

        # Status
        "status":
            status,

        "has_delay":
            has_delay,
    }

# ============================================================
# Summary
# ============================================================

def _summary_payload(
    project_rows,
    physical,
    financial,
    total_budget,
    total_consume
):

    return {

        "total_projects":
            len(project_rows),

        "physical_progress":
            round(physical, 2),

        "has_physical_data":
            any(row.get("has_physical_data") is True for row in project_rows),

        "financial_progress":
            round(financial, 2),

        "overall_progress":
            round(
                (
                    physical +
                    financial
                ) / 2,
                2
            ),

        "completed_projects":
            sum(
                row["status"] == "completed"
                for row in project_rows
            ),

        "in_progress_projects":
            sum(
                row["status"] == "in_progress"
                for row in project_rows
            ),

        "delayed_projects":
            sum(
                row["status"] == "in_delay"
                for row in project_rows
            ),

        "pending_projects":
            sum(
                row["status"] == "pending"
                for row in project_rows
            ),

        "total_budget":
            round(total_budget, 2),

        "total_consume":
            round(total_consume, 2),

        "remaining_budget":
            round(
                max(
                    total_budget -
                    total_consume,
                    0.0
                ),
                2
            ),
    }


def _project_scope_summary(project_rows):

    if not project_rows:
        return {
            "total_projects": 0,

            "physical_progress": 0.0,
            "has_physical_data": False,

            "financial_progress": 0.0,
            "overall_progress": 0.0,

            "total_budget": 0.0,
            "total_consume": 0.0,
            "remaining_budget": 0.0,

            # Financial Progress Overview
            "allocation_total_cost": 0.0,
            "pd_release_total_cost": 0.0,
            "spending_release_total_cost": 0.0,
            "pifra_utilization_total_cost": 0.0,
            "percentage_utilization_total": 0.0,
        }

    # ========================================================
    # Physical Progress
    # ========================================================

    physical_rows = [
        row
        for row in project_rows
        if row.get("has_physical_data") is True
    ]

    if physical_rows:

        physical = round(
            sum(
                row.get("physical_progress", 0.0)
                for row in physical_rows
            )
            / len(physical_rows),
            2
        )

    else:
        physical = 0.0

    # ========================================================
    # Existing Financial Progress
    # ========================================================

    total_budget = sum(
        row.get("total_budget", 0.0)
        for row in project_rows
    )

    total_consume = sum(
        row.get("total_consume", 0.0)
        for row in project_rows
    )

    if total_budget:

        financial = round(
            min(
                100.0,
                (
                    total_consume /
                    total_budget
                ) * 100
            ),
            2
        )

    else:
        financial = 0.0

    # ========================================================
    # Financial Progress Overview
    #
    # IMPORTANT:
    # Every project value is simply ADDED.
    #
    # No percentage formula is used here.
    # ========================================================

    allocation_total_cost = sum(
        row.get("allocation_total_cost", 0.0)
        for row in project_rows
    )

    pd_release_total_cost = sum(
        row.get("pd_release_total_cost", 0.0)
        for row in project_rows
    )

    spending_release_total_cost = sum(
        row.get("spending_release_total_cost", 0.0)
        for row in project_rows
    )

    pifra_utilization_total_cost = sum(
        row.get("pifra_utilization_total_cost", 0.0)
        for row in project_rows
    )

    # IMPORTANT:
    # Sum the already-stored Project percentage values.
    # DO NOT calculate PIFRA / Allocation here.
    percentage_utilization_total = sum(
        row.get("percentage_utilization_total", 0.0)
        for row in project_rows
    )

    # ========================================================
    # Return
    # ========================================================

    return {

        "total_projects":
            len(project_rows),

        "physical_progress":
            round(physical, 2),

        "has_physical_data":
            bool(physical_rows),

        "financial_progress":
            round(financial, 2),

        "overall_progress":
            round(
                (
                    physical +
                    financial
                ) / 2,
                2
            ),

        "total_budget":
            round(total_budget, 2),

        "total_consume":
            round(total_consume, 2),

        "remaining_budget":
            round(
                max(
                    total_budget -
                    total_consume,
                    0.0
                ),
                2
            ),

        # ====================================================
        # Financial Progress Overview
        # ====================================================

        "allocation_total_cost":
            round(
                allocation_total_cost,
                2
            ),

        "pd_release_total_cost":
            round(
                pd_release_total_cost,
                2
            ),

        "spending_release_total_cost":
            round(
                spending_release_total_cost,
                2
            ),

        "pifra_utilization_total_cost":
            round(
                pifra_utilization_total_cost,
                2
            ),

        "percentage_utilization_total":
            round(
                percentage_utilization_total,
                2
            ),
    }

# ============================================================
# Hierarchy
# ============================================================

def _average_metric_rows(rows):

    if not rows:

        return {
            "project_count": 0,

            "physical_progress": 0.0,
            "has_physical_data": False,

            "financial_progress": 0.0,
            "overall_progress": 0.0,

            "total_budget": 0.0,
            "total_consume": 0.0,
            "remaining_budget": 0.0,

            "allocation_total_cost": 0.0,
            "pd_release_total_cost": 0.0,
            "spending_release_total_cost": 0.0,
            "pifra_utilization_total_cost": 0.0,
            "percentage_utilization_total": 0.0,
        }

    physical_rows = [
        row
        for row in rows
        if row.get("has_physical_data") is True
    ]

    physical_progress = (
        round(
            sum(
                row.get(
                    "physical_progress",
                    0.0
                )
                for row in physical_rows
            )
            / len(physical_rows),
            2
        )
        if physical_rows
        else 0.0
    )

    return {

        "project_count":
            sum(
                row.get(
                    "project_count",
                    1
                )
                for row in rows
            ),

        "physical_progress":
            physical_progress,

        "has_physical_data":
            bool(physical_rows),

        "financial_progress":
            round(
                sum(
                    row.get(
                        "financial_progress",
                        0.0
                    )
                    for row in rows
                )
                / len(rows),
                2
            ),

        "overall_progress":
            round(
                sum(
                    row.get(
                        "overall_progress",
                        0.0
                    )
                    for row in rows
                )
                / len(rows),
                2
            ),

        # ----------------------------------------------------
        # Financial Progress Overview
        # ----------------------------------------------------

        "total_budget":
            sum(
                row.get(
                    "total_budget",
                    0.0
                )
                for row in rows
            ),

        "total_consume":
            sum(
                row.get(
                    "total_consume",
                    0.0
                )
                for row in rows
            ),

        "remaining_budget":
            sum(
                row.get(
                    "remaining_budget",
                    0.0
                )
                for row in rows
            ),

        "allocation_total_cost":
            sum(
                row.get(
                    "allocation_total_cost",
                    0.0
                )
                for row in rows
            ),

        "pd_release_total_cost":
            sum(
                row.get(
                    "pd_release_total_cost",
                    0.0
                )
                for row in rows
            ),

        "spending_release_total_cost":
            sum(
                row.get(
                    "spending_release_total_cost",
                    0.0
                )
                for row in rows
            ),

        "pifra_utilization_total_cost":
            sum(
                row.get(
                    "pifra_utilization_total_cost",
                    0.0
                )
                for row in rows
            ),

        "percentage_utilization_total":
            sum(
                row.get(
                    "percentage_utilization_total",
                    0.0
                )
                for row in rows
            ),
    }


def _all_hierarchy_rows(
    page,
    project_rows
):
    """Return the rows for the requested dashboard page.

    This intentionally follows the dashboard-page logic from the reference
    DashboardView.py supplied by the client:

    * All Divisions  = each row is one Division, calculated from projects in it.
    * All Districts  = each row is one District, calculated from projects in it.
    * All Tehsils    = each row is one Tehsil, calculated from projects in it.
    * All Projects   = each row is one Project.

    The page summary then averages the active rows currently visible on that
    page. Drill-down pages in the frontend use the same principle for the
    current visible child level.
    """

    if page == "provinces":
        objects = (
            Province.objects
            .all()
            .order_by("province_name")
        )
        key = "province"
        name_attr = "province_name"

    elif page == "divisions":
        objects = (
            Division.objects
            .select_related("province")
            .all()
            .order_by("division_name")
        )
        key = "division"
        name_attr = "division_name"

    elif page == "districts":
        objects = (
            District.objects
            .select_related("province", "division")
            .all()
            .order_by("district_name")
        )
        key = "district"
        name_attr = "district_name"

    elif page == "tehsils":
        objects = (
            Tehsil.objects
            .select_related("province", "division", "district")
            .all()
            .order_by("tehsil_name")
        )
        key = "tehsil"
        name_attr = "tehsil_name"

    else:
        return [
            {
                "id": row["id"],
                "name": row["project_name"],
                "project_count": 1,
                "physical_progress": row["physical_progress"],
                "has_physical_data": row.get("has_physical_data", False),
                "financial_progress": row["financial_progress"],
                "overall_progress": row["overall_progress"],
            }
            for row in project_rows
        ]

    grouped = defaultdict(list)
    for row in project_rows:
        value = row.get(key)
        if value is not None:
            grouped[value].append(row)

    rows = []
    for obj in objects:
        scoped_projects = grouped.get(obj.id, [])
        summary = _project_scope_summary(scoped_projects)

        row = {
            "id": obj.id,

            "name": getattr(obj, name_attr),

            "project_count":
                summary["total_projects"],

            "physical_progress":
                summary["physical_progress"],

            "has_physical_data":
                summary.get(
                    "has_physical_data",
                    False
                ),

            "financial_progress":
                summary["financial_progress"],

            "overall_progress":
                summary["overall_progress"],

            # ----------------------------------------------------
            # Financial Progress Overview
            # ----------------------------------------------------

            "allocation_total_cost":
                summary["allocation_total_cost"],

            "pd_release_total_cost":
                summary["pd_release_total_cost"],

            "spending_release_total_cost":
                summary["spending_release_total_cost"],

            "pifra_utilization_total_cost":
                summary["pifra_utilization_total_cost"],

            "percentage_utilization_total":
                summary["percentage_utilization_total"],

            # Existing summary financial fields
            "total_budget":
                summary["total_budget"],

            "total_consume":
                summary["total_consume"],

            "remaining_budget":
                summary["remaining_budget"],
        }

        if page == "provinces":
            row["province"] = obj.id
            row["province_id"] = obj.id
            row["province_name"] = obj.province_name

        elif page == "divisions":
            row["division"] = obj.id
            row["division_id"] = obj.id
            row["division_name"] = obj.division_name
            row["province"] = obj.province_id
            row["province_id"] = obj.province_id
            row["province_name"] = obj.province.province_name if obj.province_id else None

        elif page == "districts":
            row["district"] = obj.id
            row["district_id"] = obj.id
            row["district_name"] = obj.district_name
            row["division"] = obj.division_id
            row["division_id"] = obj.division_id
            row["division_name"] = obj.division.division_name if obj.division_id else None
            row["province"] = obj.province_id
            row["province_id"] = obj.province_id
            row["province_name"] = obj.province.province_name if obj.province_id else None

        elif page == "tehsils":
            row["tehsil"] = obj.id
            row["tehsil_id"] = obj.id
            row["tehsil_name"] = obj.tehsil_name
            row["district"] = obj.district_id
            row["district_id"] = obj.district_id
            row["district_name"] = obj.district.district_name if obj.district_id else None
            row["division"] = obj.division_id
            row["division_id"] = obj.division_id
            row["division_name"] = obj.division.division_name if obj.division_id else None
            row["province"] = obj.province_id
            row["province_id"] = obj.province_id
            row["province_name"] = obj.province.province_name if obj.province_id else None

        rows.append(row)

    return rows


# ============================================================
# Page Summary
# ============================================================

def _page_summary(
    page,
    hierarchy_rows,
    project_rows
):

    active = [
        row for row in hierarchy_rows
        if row.get("project_count", 0) > 0
    ]
    physical_active = [
        row for row in hierarchy_rows
        if row.get("has_physical_data") is True
    ]

    if not active and not physical_active:
        return _project_scope_summary([])

    physical = (
        sum(row["physical_progress"] for row in physical_active) / len(physical_active)
        if physical_active else 0.0
    )

    financial = (
        sum(row["financial_progress"] for row in active) / len(active)
        if active else 0.0
    )

    total_budget = sum(
        row["total_budget"]
        for row in project_rows
    )

    total_consume = sum(
        row["total_consume"]
        for row in project_rows
    )

    return _summary_payload(
        project_rows,
        physical,
        financial,
        total_budget,
        total_consume
    )


# ============================================================
# Top Projects
# ============================================================

def _top_projects(
    project_rows,
    limit=6,
    minimum_overall=80.0
):

    unique = {
        row["id"]: row
        for row in project_rows
    }

    filtered = [
        row for row in unique.values()
        if row.get("overall_progress", 0) >= minimum_overall
    ]

    return sorted(
        filtered,
        key=lambda row: (
            -row["physical_progress"],
            -row["overall_progress"],
            -row["financial_progress"],
            row["project_name"].lower()
        )
    )[:limit]


# ============================================================
# Top Hierarchy
# ============================================================

def _top_hierarchy(
    rows,
    limit=5
):

    return sorted(
        rows,
        key=lambda row: (
            -row["physical_progress"],
            row["name"].lower()
        )
    )[:limit]


# ============================================================
# Dashboard API
# ============================================================

class DashboardPageDataView(APIView):

    permission_classes = [
        IsAuthenticated
    ]

    LEGACY_PAGE_ALIASES = {
        "zones": "divisions",
        "circles": "districts",
    }

    VALID_PAGES = {
        "provinces",
        "divisions",
        "districts",
        "tehsils",
        "projects",
        "zones",
        "circles",
    }

    def get(
        self,
        request,
        page
    ):

        canonical_page = self.LEGACY_PAGE_ALIASES.get(
            page,
            page
        )

        # ----------------------------------------------------
        # Validate page
        # ----------------------------------------------------

        if page not in self.VALID_PAGES and canonical_page not in {
            "provinces",
            "divisions",
            "districts",
            "tehsils",
            "projects",
        }:

            return Response(
                {
                    "detail":
                        "Invalid dashboard page."
                },
                status=404
            )

        if canonical_page not in {
            "provinces",
            "divisions",
            "districts",
            "tehsils",
            "projects",
        }:
            canonical_page = page

        # ----------------------------------------------------
        # Cache
        # ----------------------------------------------------

        cache_key = (
            f"dashboard_page_data_contextual_physical_v5_{canonical_page}"
        )

        cached_data = cache.get(
            cache_key
        )

        if cached_data is not None:

            return Response(
                cached_data
            )

        # ----------------------------------------------------
        # Activities
        # ----------------------------------------------------

        activity_queryset = (
            ProjectActivity.objects
            .prefetch_related(
                "delay_logs"
            )
            .order_by("id")
        )

        # ----------------------------------------------------
        # Projects
        # ----------------------------------------------------

        projects = list(
            Project.objects
            .select_related(
                "province",
                "division",
                "district",
                "tehsil",
            )
            .prefetch_related(
                "stakeholder",
                Prefetch(
                    "activities",
                    queryset=activity_queryset
                ),
            )
            .order_by("id")
        )

        # ----------------------------------------------------
        # Calculate project metrics
        # ----------------------------------------------------

        physical_progress_map = calculate_project_physical_progress_map(
            [project.id for project in projects]
        )

        project_rows = [
            _project_metrics(
                project,
                physical_progress_map.get(project.id, 0.0),
                project.id in physical_progress_map,
            )
            for project in projects
        ]

        # ----------------------------------------------------
        # Hierarchy
        # ----------------------------------------------------

        hierarchy_rows = (
            _all_hierarchy_rows(
                canonical_page,
                project_rows
            )
        )

        # ----------------------------------------------------
        # Summary
        # ----------------------------------------------------

        summary = _page_summary(
            canonical_page,
            hierarchy_rows,
            project_rows
        )

        # ----------------------------------------------------
        # Top projects
        # ----------------------------------------------------

        best_projects = _top_projects(
            project_rows,
            limit=6,
            minimum_overall=0.0,
        )

        # ----------------------------------------------------
        # Top hierarchy
        # ----------------------------------------------------

        top_hierarchy = _top_hierarchy(
            hierarchy_rows,
            5
        )

        # ----------------------------------------------------
        # Serialize projects
        # ----------------------------------------------------

        serialized_projects = (
            ProjectDashboardSerializer(
                projects,
                many=True,
                context={
                    "request": request
                }
            ).data
        )

        metrics_by_id = {
            row["id"]: row
            for row in project_rows
        }

        projects_payload = []

        for project_data in serialized_projects:

            row = dict(
                project_data
            )

            metrics = metrics_by_id.get(
                row["id"],
                {}
            )

            row.update({

                "physical_progress":
                    metrics.get(
                        "physical_progress",
                        0
                    ),

                "has_physical_data":
                    metrics.get(
                        "has_physical_data",
                        False
                    ),

                "financial_progress":
                    metrics.get(
                        "financial_progress",
                        0
                    ),

                "overall_progress":
                    metrics.get(
                        "overall_progress",
                        0
                    ),

                "status":
                    metrics.get(
                        "status",
                        "pending"
                    ),

                "has_delay":
                    metrics.get(
                        "has_delay",
                        False
                    ),
            })

            projects_payload.append(row)

        # ----------------------------------------------------
        # Response
        # ----------------------------------------------------

        response_data = {

            "page":
                page,

            "summary":
                summary,

            "financial_chart": {
                "planned": 100.0,
                "actual":
                    summary[
                        "financial_progress"
                    ],
                "variance":
                    round(
                        max(
                            0.0,
                            100.0 -
                            summary[
                                "financial_progress"
                            ]
                        ),
                        2
                    ),
            },

            "physical_chart": {
                "planned": 100.0,
                "actual":
                    summary[
                        "physical_progress"
                    ],
                "variance":
                    round(
                        max(
                            0.0,
                            100.0 -
                            summary[
                                "physical_progress"
                            ]
                        ),
                        2
                    ),
            },

            "best_performing_projects":
                best_projects,

            "top_hierarchy":
                top_hierarchy,

            "map_projects":
                project_rows,

            "projects":
                projects_payload,

            # Keep all hierarchy data available
            # for frontend filters.
            "provinces":
                _all_hierarchy_rows(
                    "provinces",
                    project_rows
                ),

            "divisions":
                _all_hierarchy_rows(
                    "divisions",
                    project_rows
                ),

            "districts":
                _all_hierarchy_rows(
                    "districts",
                    project_rows
                ),

            "tehsils":
                _all_hierarchy_rows(
                    "tehsils",
                    project_rows
                ),

            "project_gantt_all":
                [],
        }

        # ----------------------------------------------------
        # Save cache
        # ----------------------------------------------------

        cache.set(
            cache_key,
            response_data,
            timeout=CACHE_TIMEOUT_SECONDS
        )

        return Response(
            response_data
        )