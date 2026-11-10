import math
import re

_QTY_AT_END = re.compile(r"\(\s*(\d+(?:,\d{3})*(?:\.\d+)?)\s*\)\s*$")


def extract_quantity_from_name(name):
    """'Fixed Cameras (53)' -> 53. Returns None if the name has no trailing '(number)'."""
    if not name:
        return None
    match = _QTY_AT_END.search(str(name))
    if not match:
        return None
    value = float(match.group(1).replace(",", ""))
    if value <= 0:
        return None
    return int(value) if value.is_integer() else value


class QuantityError(ValueError):
    def __init__(self, field, message):
        super().__init__(message)
        self.field = field


def _to_number(data, field):
    raw = data.get(field)
    if raw in (None, ""):
        return None
    label = field.replace("_", " ").capitalize()
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise QuantityError(field, f"{label} must be a number.")
    if math.isnan(value) or math.isinf(value) or value < 0:
        raise QuantityError(field, f"{label} must be zero or more.")
    return value


def _to_progress(raw):
    try:
        value = float(raw)
    except (TypeError, ValueError):
        raise QuantityError("progress", "Progress must be a number between 0 and 100.")
    if not 0 <= value <= 100:
        raise QuantityError("progress", "Progress must be a number between 0 and 100.")
    return value


def apply_quantity_and_progress(task, data):
    """Read total/completed units from the request. When both exist, progress = completed / total."""
    total = task.total_quantity
    completed = task.completed_quantity
    if "total_quantity" in data:
        total = _to_number(data, "total_quantity")
    if "completed_quantity" in data:
        completed = _to_number(data, "completed_quantity")

    if completed is not None and total is None:
        raise QuantityError("total_quantity", "Enter the total units before the completed units.")
    if total is not None and completed is not None and completed > total:
        raise QuantityError("completed_quantity", "Completed units cannot be more than the total units.")

    task.total_quantity = total
    task.completed_quantity = completed

    if total and completed is not None:
        task.progress = round(completed / total * 100, 2)
    elif data.get("progress") not in (None, ""):
        task.progress = _to_progress(data.get("progress"))


def quantity_payload(task):
    total, done = task.total_quantity, task.completed_quantity
    if total is not None and done is None:
        done = round((task.progress or 0) / 100 * total, 2)
    remaining = None if total is None else max(total - (done or 0), 0)
    return {"total_quantity": total, "completed_quantity": done, "remaining_quantity": remaining}