from rest_framework.views import APIView
from rest_framework.response import Response
from django.shortcuts import get_object_or_404
from api.models import Project, ProjectActivity, ActivityDelayLog


# ---------- helper to get delay info ----------
def get_delay_info(activity):
    delay = ActivityDelayLog.objects.filter(activity=activity).order_by('-created_at').first()
    if delay:
        return {
            "originator": delay.originator,
            "action_by": delay.action_by,
            "delay_days": delay.delay_days,
            "delay_start_date": delay.delay_start_date.isoformat() if delay.delay_start_date else None,
            "delay_end_date": delay.delay_end_date.isoformat() if delay.delay_end_date else None,
            "issue": delay.issue,
            "recommended_action": delay.recommended_action
        }
    return None


def check_task_delay(task):
    actual_end = task.get("actual_end")
    end_date = task.get("end_date")
    actual_start = task.get("actual_start")
    start_date = task.get("start_date")

    if actual_end and end_date:
        return actual_end > end_date

    if actual_start and start_date:
        return actual_start > start_date

    return False


def has_delay(tasks):
    for task in tasks:
        if check_task_delay(task):
            return True
        if task.get("subtasks") and has_delay(task["subtasks"]):
            return True
    return False


class ProjectGanttNestedView(APIView):

    def get(self, request, project_id):
        project = get_object_or_404(Project, id=project_id)

        activities = ProjectActivity.objects.filter(
            project=project
        ).select_related('parent').order_by('id')

        # -----------------------------
        # STEP 1: group children
        # -----------------------------
        children_map = {}
        for act in activities:
            parent_id = act.parent_id or 0
            children_map.setdefault(parent_id, []).append(act)

        # -----------------------------
        # STEP 2: recursive builder
        # -----------------------------
        def build_tree(parent_id=0, prefix=""):
            nodes = []
            children = children_map.get(parent_id, [])

            for index, act in enumerate(children, start=1):
                new_id = f"{prefix}{index}" if prefix else str(index)

                delay_info = get_delay_info(act)
                has_delay_flag = bool(delay_info)

                # 🔁 recursion first
                subtasks = build_tree(act.id, new_id)

                # -----------------------------
                # ✅ PROGRESS (weighted)
                # -----------------------------
                if subtasks:
                    total_weight = 0
                    weighted_sum = 0

                    for t in subtasks:
                        duration = t.get("duration") or 1

                        # normalize child progress to 0–100
                        child_progress = t["progress"]
                        if child_progress <= 1:
                            child_progress *= 100

                        weighted_sum += child_progress * duration
                        total_weight += duration

                    avg_progress = weighted_sum / total_weight if total_weight > 0 else 0
                else:
                    avg_progress = act.progress or 0

                # normalize self progress also
                if avg_progress <= 1:
                    avg_progress *= 100

                # -----------------------------
                # ✅ DURATION (fixed logic)
                # -----------------------------
                if act.duration:
                    duration = act.duration
                elif subtasks:
                    duration = sum(child.get("duration", 0) for child in subtasks)
                else:
                    duration = 0

                # -----------------------------
                # NODE
                # -----------------------------
                node = {
                    "_id": new_id,
                    "id": act.id,
                    "activity_id": act.activity_id,
                    "name": act.activity_name,
                    "duration": duration,
                    "start_date": act.start_date.isoformat() if act.start_date else None,
                    "end_date": act.end_date.isoformat() if act.end_date else None,
                    "progress": round(avg_progress, 2),
                    "actual_start": act.actual_start.isoformat() if act.actual_start else None,
                    "actual_end": act.actual_end.isoformat() if act.actual_end else None,
                    "progress_date": act.progress_date.isoformat() if act.progress_date else None,
                    "has_delay": has_delay_flag,
                    "delay_info": delay_info,
                    "subtasks": subtasks
                }

                nodes.append(node)

            return nodes

        # -----------------------------
        # STEP 3: build tree
        # -----------------------------
        root_tasks = build_tree()

        delay_flag = has_delay(root_tasks)

        # -----------------------------
        # STEP 4: project summary
        # -----------------------------
        all_start = [a.start_date for a in activities if a.start_date]
        all_end = [a.end_date for a in activities if a.end_date]

        start_date = min(all_start).isoformat() if all_start else None
        end_date = max(all_end).isoformat() if all_end else None

        duration = (
            (max(all_end) - min(all_start)).days
            if all_start and all_end else 0
        )

        schedule = {
            "_id": str(project.id),
            "project": project.project_reference_no or "",
            "project_name": project.project_name,
            "start_date": start_date,
            "end_date": end_date,
            "duration": duration,
            "schedulePercentageComplete": 0,
            "performancePercentageComplete": 0,
            "tasks": root_tasks
        }

        return Response({
            "success": True,
            "has_delay": delay_flag,
            "schedules": [schedule]
        })