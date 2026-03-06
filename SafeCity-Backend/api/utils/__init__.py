"""
`api.utils` package.

This repo already has a legacy module at `api/utils.py`. In some environments
`api.utils` is being imported as a package (traceback shows `api/utils/__init__.py`),
so we re-export the legacy symbols from here to keep imports + migrations stable.
"""

from __future__ import annotations

import importlib.util
from importlib.machinery import SourceFileLoader
from pathlib import Path

_LEGACY_UTILS_PATH = Path(__file__).resolve().parent.parent / "utils.py"

_loader = SourceFileLoader("api._legacy_utils", str(_LEGACY_UTILS_PATH))
_spec = importlib.util.spec_from_loader(_loader.name, _loader)
if _spec is None or _spec.loader is None:  # pragma: no cover
    raise ImportError(f"Unable to load legacy utils from {_LEGACY_UTILS_PATH}")

_legacy_utils = importlib.util.module_from_spec(_spec)
_spec.loader.exec_module(_legacy_utils)  # type: ignore[assignment]

# Re-export commonly used utilities (add more as needed).
project_doc_file_path = _legacy_utils.project_doc_file_path
project_image_file_path = _legacy_utils.project_image_file_path
get_tokens_for_user = _legacy_utils.get_tokens_for_user
StandardResultsSetPagination = _legacy_utils.StandardResultsSetPagination
ApiResponse = _legacy_utils.ApiResponse
get_error_message = _legacy_utils.get_error_message
get_error_message_list = _legacy_utils.get_error_message_list
get_error_message_list_serializer = _legacy_utils.get_error_message_list_serializer
generate_random_string = _legacy_utils.generate_random_string
get_xer_gantt_data = _legacy_utils.get_xer_gantt_data

__all__ = [
    "project_doc_file_path",
    "project_image_file_path",
    "get_tokens_for_user",
    "StandardResultsSetPagination",
    "ApiResponse",
    "get_error_message",
    "get_error_message_list",
    "get_error_message_list_serializer",
    "generate_random_string",
    "get_xer_gantt_data",
]

