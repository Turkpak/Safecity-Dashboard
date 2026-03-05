"""
XER File Parser using PyP6XER
Extracts task/activity information from MS Project .xer files
"""
from typing import List, Dict, Any


def parse_xer_file(file_path: str) -> List[Dict[str, Any]]:
    """
    Parse XER file and extract activities for Gantt chart.
    
    Args:
        file_path: Path to .xer file
    
    Returns:
        List of activities with id, name, start_date, finish_date, percent_complete
    """
    try:
        from pyp6xer import Xer
    except ImportError:
        raise ImportError("PyP6XER not installed. Run: pip install PyP6XER")
    
    activities = []
    
    try:
        # Parse XER file
        xer = Xer(file_path)
        
        # Extract activities from the XER object
        if hasattr(xer, 'activities'):
            for activity in xer.activities:
                try:
                    # Get dates safely
                    start_date = None
                    finish_date = None
                    
                    if hasattr(activity, 'start_date') and activity.start_date:
                        start_date = activity.start_date.isoformat()
                    
                    if hasattr(activity, 'finish_date') and activity.finish_date:
                        finish_date = activity.finish_date.isoformat()
                    
                    # Get completion percentage
                    progress = 0
                    if hasattr(activity, 'phys_complete_pct') and activity.phys_complete_pct:
                        progress = (activity.phys_complete_pct or 0) / 100.0
                    
                    activity_dict = {
                        'id': str(activity.activity_id),
                        'label': activity.activity_name or f"Activity {activity.activity_id}",
                        'start': start_date,
                        'end': finish_date,
                        'progress': min(1.0, max(0, progress)),
                    }
                    activities.append(activity_dict)
                except Exception as e:
                    # Skip problematic activities
                    print(f"Error parsing activity: {e}")
                    continue
        
        # Sort by start date
        activities.sort(key=lambda x: x['start'] or "")
        
        return activities
    
    except Exception as e:
        raise ValueError(f"Failed to parse XER file: {str(e)}")


def get_xer_gantt_data(project_id: int) -> Dict[str, Any]:
    """
    Get Gantt data from project's XER file.
    
    Args:
        project_id: Project ID
    
    Returns:
        Dict with tasks list for Gantt chart
    """
    from ..models import Project
    
    try:
        project = Project.objects.get(id=project_id)
        
        if not project.xer_file:
            return {'tasks': [], 'message': 'No XER file attached to project'}
        
        # Parse XER file
        tasks = parse_xer_file(project.xer_file.path)
        
        return {
            'tasks': tasks,
            'project_name': project.project_name,
            'message': f'Loaded {len(tasks)} activities from XER file'
        }
    
    except Project.DoesNotExist:
        raise ValueError(f"Project {project_id} not found")
    except Exception as e:
        raise ValueError(f"Error loading XER data: {str(e)}")
