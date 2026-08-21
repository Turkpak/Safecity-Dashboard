from __future__ import annotations

from collections import defaultdict
from datetime import date

from django.db.models import Min, Max
from django.utils.dateparse import parse_date
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView

from api.models import ActivityDelayLog, District, Division, Project, ProjectActivity, Tehsil
from api.progress_calculations import calculate_project_physical_progress_map
from api.utils import normalize_progress_to_percent


def _avg(values):
    values = [float(v) for v in values if v is not None]
    return round(sum(values) / len(values), 2) if values else None


def _clamp(value, low=0.0, high=100.0):
    return max(low, min(high, float(value)))


def _project_name(project):
    return project.project_name or f"Project #{project.id}"


def _reporting_date(request):
    raw = request.query_params.get("reporting_date")
    return parse_date(raw) if raw else date.today()


def _hierarchy_maps(projects, physical_map):
    projects_by_tehsil = defaultdict(list)
    valid_count_by_tehsil = defaultdict(int)
    for project in projects:
        if project.id in physical_map and project.tehsil_id:
            projects_by_tehsil[project.tehsil_id].append(physical_map[project.id])
            valid_count_by_tehsil[project.tehsil_id] += 1

    tehsil_progress = {
        tehsil_id: _avg(values)
        for tehsil_id, values in projects_by_tehsil.items()
        if values
    }

    tehsils = list(Tehsil.objects.values("id", "district_id", "division_id", "tehsil_name"))
    districts_by_division = defaultdict(list)
    tehsils_by_district = defaultdict(list)
    for tehsil in tehsils:
        progress = tehsil_progress.get(tehsil["id"])
        if progress is not None:
            tehsils_by_district[tehsil["district_id"]].append(progress)

    district_progress = {
        district_id: _avg(values)
        for district_id, values in tehsils_by_district.items()
        if values
    }

    districts = list(District.objects.values("id", "division_id", "district_name"))
    for district in districts:
        progress = district_progress.get(district["id"])
        if progress is not None:
            districts_by_division[district["division_id"]].append(progress)

    division_progress = {
        division_id: _avg(values)
        for division_id, values in districts_by_division.items()
        if values
    }

    overall = _avg(list(division_progress.values()))
    return tehsil_progress, district_progress, division_progress, overall


def _scope_projects(all_projects, scope_type, scope_id):
    if scope_type == "project" and scope_id:
        return [p for p in all_projects if p.id == scope_id]
    if scope_type == "tehsil" and scope_id:
        return [p for p in all_projects if p.tehsil_id == scope_id]
    if scope_type == "district" and scope_id:
        return [p for p in all_projects if p.district_id == scope_id]
    if scope_type == "division" and scope_id:
        return [p for p in all_projects if p.division_id == scope_id]
    return list(all_projects)


def _scope_name(scope, scope_type, scope_id):
    if scope_type == "project" and scope_id:
        obj = Project.objects.filter(id=scope_id).only("project_name").first()
        return _project_name(obj) if obj else f"Project {scope_id}"
    if scope_type == "tehsil" and scope_id:
        obj = Tehsil.objects.filter(id=scope_id).only("tehsil_name").first()
        return obj.tehsil_name if obj else f"Tehsil {scope_id}"
    if scope_type == "district" and scope_id:
        obj = District.objects.filter(id=scope_id).only("district_name").first()
        return obj.district_name if obj else f"District {scope_id}"
    if scope_type == "division" and scope_id:
        obj = Division.objects.filter(id=scope_id).only("division_name").first()
        return obj.division_name if obj else f"Division {scope_id}"
    return {
        "projects": "All Punjab Projects",
        "tehsils": "All Punjab Tehsils",
        "districts": "All Punjab Districts",
        "divisions": "Punjab Portfolio — Division View",
    }.get(scope, "Punjab Portfolio")


def _child_progress(scope, scope_type, scope_id, projects, physical_map, hierarchy):
    tehsil_progress, district_progress, division_progress, _ = hierarchy

    if scope_type == "project":
        return []

    if scope_type == "tehsil" and scope_id:
        rows = [
            {
                "id": p.id,
                "name": _project_name(p),
                "physical_progress": physical_map[p.id],
                "valid_projects": 1,
                "total_projects": 1,
            }
            for p in projects
            if p.id in physical_map
        ]
        return sorted(rows, key=lambda x: (-x["physical_progress"], x["name"]))

    if scope_type == "district" and scope_id:
        objects = Tehsil.objects.filter(district_id=scope_id).order_by("tehsil_name")
        progress_map = tehsil_progress
        fk = "tehsil_id"
    elif scope_type == "division" and scope_id:
        objects = District.objects.filter(division_id=scope_id).order_by("district_name")
        progress_map = district_progress
        fk = "district_id"
    elif scope == "districts":
        objects = District.objects.all().order_by("district_name")
        progress_map = district_progress
        fk = "district_id"
    elif scope == "tehsils":
        objects = Tehsil.objects.all().order_by("tehsil_name")
        progress_map = tehsil_progress
        fk = "tehsil_id"
    elif scope == "projects":
        rows = [
            {
                "id": p.id,
                "name": _project_name(p),
                "physical_progress": physical_map[p.id],
                "valid_projects": 1,
                "total_projects": 1,
            }
            for p in projects
            if p.id in physical_map
        ]
        return sorted(rows, key=lambda x: (-x["physical_progress"], x["name"]))
    else:
        objects = Division.objects.all().order_by("division_name")
        progress_map = division_progress
        fk = "division_id"

    rows = []
    for obj in objects:
        progress = progress_map.get(obj.id)
        if progress is None:
            continue
        related = [p for p in projects if getattr(p, fk, None) == obj.id]
        valid = sum(1 for p in related if p.id in physical_map)
        if valid == 0:
            continue
        name = getattr(obj, "division_name", None) or getattr(obj, "district_name", None) or getattr(obj, "tehsil_name", None)
        rows.append({
            "id": obj.id,
            "name": name,
            "physical_progress": progress,
            "valid_projects": valid,
            "total_projects": len(related),
        })
    return sorted(rows, key=lambda x: (-x["physical_progress"], x["name"]))


def _project_distribution(projects, physical_map):
    buckets = [
        ("0%", lambda p: p == 0),
        (">0–25%", lambda p: 0 < p <= 25),
        (">25–50%", lambda p: 25 < p <= 50),
        (">50–75%", lambda p: 50 < p <= 75),
        (">75–<100%", lambda p: 75 < p < 100),
        ("100%", lambda p: p >= 100),
    ]
    values = [physical_map[p.id] for p in projects if p.id in physical_map]
    return [{"bucket": label, "count": sum(1 for value in values if test(value))} for label, test in buckets]


def _project_rankings(projects, physical_map, limit=5):
    rows = [
        {"project_id": p.id, "project_name": _project_name(p), "physical_progress": physical_map[p.id]}
        for p in projects
        if p.id in physical_map
    ]
    top = sorted(rows, key=lambda x: (-x["physical_progress"], x["project_name"]))[:limit]
    bottom = sorted(rows, key=lambda x: (x["physical_progress"], x["project_name"]))[:limit]
    return top, bottom


def _activity_analytics(projects, physical_map, reporting_date):
    project_ids = [p.id for p in projects]
    activities = list(
        ProjectActivity.objects.filter(project_id__in=project_ids)
        .exclude(task_type="wbs")
        .select_related("project")
        .only(
            "id", "project_id", "activity_id", "activity_name", "progress", "progress_status",
            "start_date", "end_date", "actual_start", "actual_end", "progress_date", "duration"
        )
    )

    completed = in_progress = not_started = 0
    past_finish_incomplete = 0
    not_started_after_planned_start = 0
    activities_with_progress_date = 0
    latest_progress_date = None

    by_project = defaultdict(list)
    for activity in activities:
        progress = normalize_progress_to_percent(activity.progress)
        if progress >= 100:
            completed += 1
        elif progress > 0:
            in_progress += 1
        else:
            not_started += 1
        if activity.end_date and activity.end_date < reporting_date and progress < 100:
            past_finish_incomplete += 1
        if activity.start_date and activity.start_date < reporting_date and progress <= 0:
            not_started_after_planned_start += 1
        if activity.progress_date:
            activities_with_progress_date += 1
            if latest_progress_date is None or activity.progress_date > latest_progress_date:
                latest_progress_date = activity.progress_date
        by_project[activity.project_id].append(activity)

    execution_matrix = []
    projects_with_schedule = 0
    for project in projects:
        rows = by_project.get(project.id, [])
        dated = [a for a in rows if a.start_date and a.end_date]
        if not dated or project.id not in physical_map:
            continue
        start = min(a.start_date for a in dated)
        finish = max(a.end_date for a in dated)
        planned_days = max((finish - start).days + 1, 1)
        elapsed_days = (reporting_date - start).days + 1
        elapsed_pct = _clamp((elapsed_days / planned_days) * 100)
        projects_with_schedule += 1
        physical = physical_map[project.id]
        execution_matrix.append({
            "project_id": project.id,
            "project_name": _project_name(project),
            "physical_progress": physical,
            "planned_time_elapsed_pct": round(elapsed_pct, 2),
            "variance_points": round(physical - elapsed_pct, 2),
        })

    delays = list(
        ActivityDelayLog.objects.filter(project_id__in=project_ids)
        .select_related("activity", "project")
        .order_by("-delay_days", "activity__activity_name")
    )
    affected_activity_ids = {d.activity_id for d in delays}
    affected_project_ids = {d.project_id for d in delays}
    category_days = defaultdict(int)
    originator_count = defaultdict(int)
    for delay in delays:
        if delay.category:
            category_days[delay.category.strip()] += max(0, delay.delay_days or 0)
        if delay.originator:
            originator_count[delay.originator.strip()] += 1

    top_delayed = [
        {
            "activity_id": d.activity_id,
            "activity_name": d.activity.activity_name or d.activity.activity_id or f"Activity {d.activity_id}",
            "project_name": _project_name(d.project),
            "delay_days": max(0, d.delay_days or 0),
        }
        for d in delays[:5]
    ]
    by_category = [
        {"category": name, "delay_days": days}
        for name, days in sorted(category_days.items(), key=lambda item: (-item[1], item[0]))
    ]
    by_originator = [
        {"originator": name, "count": count}
        for name, count in sorted(originator_count.items(), key=lambda item: (-item[1], item[0]))
    ]

    return {
        "activity_status": {
            "total": len(activities),
            "completed": completed,
            "in_progress": in_progress,
            "not_started": not_started,
        },
        "schedule": {
            "projects_with_schedule": projects_with_schedule,
            "projects_without_schedule": max(len(projects) - projects_with_schedule, 0),
            "past_finish_incomplete": past_finish_incomplete,
            "not_started_after_planned_start": not_started_after_planned_start,
        },
        "execution_matrix": sorted(execution_matrix, key=lambda x: x["variance_points"]),
        "data_currency": {
            "latest_progress_date": latest_progress_date.isoformat() if latest_progress_date else None,
            "activities_with_progress_date": activities_with_progress_date,
            "activities_without_progress_date": max(len(activities) - activities_with_progress_date, 0),
        },
        "delay_analysis": {
            "has_data": bool(delays),
            "affected_activities": len(affected_activity_ids),
            "affected_projects": len(affected_project_ids),
            "total_delay_days": sum(max(0, d.delay_days or 0) for d in delays),
            "by_category": by_category,
            "by_originator": by_originator,
            "top_delayed_activities": top_delayed,
        },
    }


def _project_wbs(project_id):
    activities = list(
        ProjectActivity.objects.filter(project_id=project_id)
        .only("id", "parent_id", "activity_name", "activity_id", "task_type", "progress", "duration")
    )
    if not activities:
        return [], [], []

    by_parent = defaultdict(list)
    by_id = {a.id: a for a in activities}
    for activity in activities:
        by_parent[activity.parent_id].append(activity)

    top_wbs = [a for a in activities if a.task_type == "wbs" and (a.parent_id is None or by_id.get(a.parent_id) is None)]
    if not top_wbs:
        top_wbs = [a for a in activities if a.task_type == "wbs"][:8]

    def descendants(node_id):
        out = []
        stack = list(by_parent.get(node_id, []))
        while stack:
            node = stack.pop()
            if node.task_type == "wbs":
                stack.extend(by_parent.get(node.id, []))
            else:
                out.append(node)
        return out

    project_leaf = [a for a in activities if a.task_type != "wbs"]
    project_weight = sum(max(float(a.duration or 1), 1.0) for a in project_leaf) or 1.0
    progress_rows = []
    contribution_rows = []
    incomplete = []

    for wbs in top_wbs:
        leaves = descendants(wbs.id)
        if not leaves:
            continue
        weight = sum(max(float(a.duration or 1), 1.0) for a in leaves)
        weighted = sum(normalize_progress_to_percent(a.progress) * max(float(a.duration or 1), 1.0) for a in leaves)
        progress = round(weighted / weight, 2) if weight else 0.0
        progress_rows.append({
            "id": wbs.id,
            "name": wbs.activity_name or wbs.activity_id or f"WBS {wbs.id}",
            "physical_progress": progress,
            "remaining_progress": round(max(0.0, 100.0 - progress), 2),
            "activity_count": len(leaves),
        })
        contribution_rows.append({
            "id": wbs.id,
            "name": wbs.activity_name or wbs.activity_id or f"WBS {wbs.id}",
            "contribution_points": round(weighted / project_weight, 2),
        })

    for activity in project_leaf:
        progress = normalize_progress_to_percent(activity.progress)
        if progress < 100:
            incomplete.append({
                "activity_id": activity.activity_id or str(activity.id),
                "activity_name": activity.activity_name or activity.activity_id or f"Activity {activity.id}",
                "physical_progress": round(progress, 2),
                "remaining_progress": round(100.0 - progress, 2),
            })

    return (
        sorted(progress_rows, key=lambda x: (-x["physical_progress"], x["name"])),
        sorted(progress_rows, key=lambda x: (-x["remaining_progress"], x["name"])),
        sorted(incomplete, key=lambda x: (-x["remaining_progress"], x["activity_name"]))[:5],
    )


class PhysicalProgressReportView(APIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        scope = request.query_params.get("scope", "divisions").lower()
        if scope not in {"divisions", "districts", "tehsils", "projects"}:
            scope = "divisions"
        scope_type = request.query_params.get("type")
        if scope_type not in {None, "division", "district", "tehsil", "project"}:
            scope_type = None
        try:
            scope_id = int(request.query_params.get("id")) if request.query_params.get("id") else None
        except (TypeError, ValueError):
            scope_id = None

        reporting_date = _reporting_date(request)
        all_projects = list(
            Project.objects.select_related("division", "district", "tehsil").order_by("id")
        )
        all_physical = calculate_project_physical_progress_map([p.id for p in all_projects])
        hierarchy = _hierarchy_maps(all_projects, all_physical)
        tehsil_progress, district_progress, division_progress, overall_progress = hierarchy

        projects = _scope_projects(all_projects, scope_type, scope_id)
        valid_projects = [p for p in projects if p.id in all_physical]

        if scope_type == "project" and scope_id:
            scope_progress = all_physical.get(scope_id)
        elif scope_type == "tehsil" and scope_id:
            scope_progress = tehsil_progress.get(scope_id)
        elif scope_type == "district" and scope_id:
            scope_progress = district_progress.get(scope_id)
        elif scope_type == "division" and scope_id:
            scope_progress = division_progress.get(scope_id)
        else:
            scope_progress = overall_progress

        scope_progress = round(scope_progress or 0.0, 2)
        child_progress = _child_progress(scope, scope_type, scope_id, projects, all_physical, hierarchy)
        distribution = _project_distribution(projects, all_physical)
        top_projects, bottom_projects = _project_rankings(projects, all_physical)
        activity = _activity_analytics(projects, all_physical, reporting_date)

        delayed_project_ids = set(
            ActivityDelayLog.objects.filter(project_id__in=[p.id for p in projects])
            .values_list("project_id", flat=True)
            .distinct()
        )
        completed_projects = sum(1 for p in valid_projects if all_physical[p.id] >= 100)
        in_progress_projects = sum(1 for p in valid_projects if 0 < all_physical[p.id] < 100)
        pending_projects = sum(1 for p in valid_projects if all_physical[p.id] <= 0)

        wbs_progress = []
        wbs_remaining = []
        top_incomplete_activities = []
        if scope_type == "project" and scope_id:
            wbs_progress, wbs_remaining, top_incomplete_activities = _project_wbs(scope_id)

        low_count = sum(item["count"] for item in distribution if item["bucket"] in {"0%", ">0–25%"})
        high_count = sum(item["count"] for item in distribution if item["bucket"] in {">75–<100%", "100%"})
        insights = [
            f"{len(valid_projects)} of {len(projects)} projects in the selected scope contain valid non-WBS Primavera activity data.",
            f"The authoritative physical progress for this scope is {scope_progress:.2f}%.",
        ]
        if child_progress:
            insights.append(f"{child_progress[0]['name']} records the highest child-scope physical progress at {child_progress[0]['physical_progress']:.2f}%.")
        if len(projects) > 1:
            insights.append(f"{low_count} valid projects are at or below 25% physical progress; {high_count} are above 75% or complete.")
        if activity["schedule"]["past_finish_incomplete"]:
            insights.append(f"{activity['schedule']['past_finish_incomplete']} activities are past planned finish and remain incomplete as of the reporting date.")

        payload = {
            "report": {
                "scope": scope,
                "scope_type": scope_type,
                "scope_id": scope_id,
                "scope_name": _scope_name(scope, scope_type, scope_id),
                "reporting_date": reporting_date.isoformat(),
            },
            "physical": {
                "progress": scope_progress,
                "remaining": round(max(0.0, 100.0 - scope_progress), 2),
                "valid_projects": len(valid_projects),
                "total_projects": len(projects),
            },
            "project_status": {
                "completed": completed_projects,
                "in_progress": in_progress_projects,
                "pending": pending_projects,
                "with_delay_logs": len(delayed_project_ids),
            },
            "child_progress": child_progress,
            "progress_distribution": distribution,
            "top_projects": top_projects,
            "bottom_projects": bottom_projects,
            "activity_status": activity["activity_status"],
            "schedule": activity["schedule"],
            "execution_matrix": activity["execution_matrix"],
            "data_currency": activity["data_currency"],
            "delay_analysis": activity["delay_analysis"],
            "wbs_progress": wbs_progress,
            "wbs_remaining": wbs_remaining,
            "top_incomplete_activities": top_incomplete_activities,
            "insights": insights[:5],
        }
        return Response(payload)
