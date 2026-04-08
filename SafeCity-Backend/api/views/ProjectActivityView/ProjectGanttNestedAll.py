from rest_framework.views import APIView
from rest_framework.response import Response
from api.models import Project, ProjectActivity, ActivityDelayLog, ProgressImage
from datetime import datetime

def get_delay_info(activity):
    delay = ActivityDelayLog.objects.filter(activity=activity).order_by('-created_at').first()
    if delay:
        action_by_info = None
        if delay.action_by:
            action_by_info = {
                "id": delay.action_by.id,
                "stakeholder_type": delay.action_by.stakeholder_type,
                "stakeholder_title": delay.action_by.stakeholder_title,
            }

        return {
            "originator": delay.originator,
            "category": delay.category,             
            "action_by": action_by_info,           
            "delay_days": delay.delay_days,
            "delay_start_date": delay.delay_start_date.isoformat() if delay.delay_start_date else None,
            "delay_end_date": delay.delay_end_date.isoformat() if delay.delay_end_date else None,
            "issue": delay.issue,
            "recommended_action": delay.recommended_action
        }
    return None

def get_activity_images(activity):
    images = ProgressImage.objects.filter(activity=activity)
    image_list = []
    if images.exists():
        image_list = [
            {
                "id": img.id,
                "url": img.image.url if img.image else None,
                "caption": img.caption,
                "image_date": img.image_date.isoformat() if img.image_date else None,
                "uploaded_at": img.uploaded_at.isoformat() if img.uploaded_at else None,
            }
            for img in images
        ]
    return {
        "has_images": bool(image_list),
        "images": image_list
    }

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
class ProjectGanttAllView(APIView):

    def get(self, request):

        projects = Project.objects.all()

        all_schedules = []
        global_delay_flag = False

        for project in projects:

            activities = ProjectActivity.objects.filter(
                project=project
            ).select_related('parent').order_by('id')

            # -----------------------------
            # group children
            # -----------------------------
            children_map = {}
            for act in activities:
                parent_id = act.parent_id or 0
                children_map.setdefault(parent_id, []).append(act)

            # -----------------------------
            # recursive builder
            # -----------------------------
            def build_tree(parent_id=0, prefix=""):
                nodes = []
                children = children_map.get(parent_id, [])

                for index, act in enumerate(children, start=1):
                    new_id = f"{prefix}{index}" if prefix else str(index)

                    delay_info = get_delay_info(act)
                    has_delay_flag = bool(delay_info)

                    subtasks = build_tree(act.id, new_id)

                    # progress
                    if subtasks:
                        total_weight = 0
                        weighted_sum = 0

                        for t in subtasks:
                            duration = t.get("duration") or 1
                            child_progress = t["progress"]
                            if child_progress <= 1:
                                child_progress *= 100

                            weighted_sum += child_progress * duration
                            total_weight += duration

                        avg_progress = weighted_sum / total_weight if total_weight > 0 else 0
                    else:
                        avg_progress = act.progress or 0

                    if avg_progress <= 1:
                        avg_progress *= 100

                    # duration
                    if subtasks:
                        start_dates = [t["start_date"] for t in subtasks if t["start_date"]]
                        end_dates = [t["end_date"] for t in subtasks if t["end_date"]]

                        if start_dates and end_dates:
                            start = min(start_dates)
                            end = max(end_dates)

                            start_dt = datetime.fromisoformat(start)
                            end_dt = datetime.fromisoformat(end)

                            duration = (end_dt - start_dt).days + 1
                        else:
                            duration = 0
                    else:
                        duration = act.duration or 0

                    activity_images = get_activity_images(act)

                    # -----------------------------
                    # ✅ DATE FIX 
                    # -----------------------------
                    if subtasks:
                        start_dates = [t["start_date"] for t in subtasks if t["start_date"]]
                        end_dates = [t["end_date"] for t in subtasks if t["end_date"]]

                        start_date = min(start_dates) if start_dates else None
                        end_date = max(end_dates) if end_dates else None
                    else:
                        start_date = act.start_date.isoformat() if act.start_date else None
                        end_date = act.end_date.isoformat() if act.end_date else None

                    node = {
                        "_id": new_id,
                        "id": act.id,
                        "activity_id": act.activity_id,
                        "name": act.activity_name,
                        "duration": duration,
                        "duration_display": f"{int(duration)} day" if duration == 1 else f"{int(duration)} days",
                        "start_date": start_date,
                        "end_date": end_date,
                        "progress": round(avg_progress, 2),
                        "progress_status": (
                            "Not Started" if avg_progress <= 0
                            else "Completed" if avg_progress >= 100
                            else "In Progress"
                        ),
                        "actual_start": act.actual_start.isoformat() if act.actual_start else None,
                        "actual_end": act.actual_end.isoformat() if act.actual_end else None,
                        "progress_date": act.progress_date.isoformat() if act.progress_date else None,
                        "has_images": activity_images["has_images"],
                        "images": activity_images["images"],
                        "has_delay": has_delay_flag,
                        "delay_info": delay_info,
                        "subtasks": subtasks
                    }

                    nodes.append(node)

                return nodes

            root_tasks = build_tree()
            delay_flag = has_delay(root_tasks)

            if delay_flag:
                global_delay_flag = True

            # project summary
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
                "tasks": root_tasks
            }

            all_schedules.append(schedule)

        return Response({
            "success": True,
            "has_delay": global_delay_flag,
            "schedules": all_schedules
        })