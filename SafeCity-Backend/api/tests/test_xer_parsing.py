import os
import tempfile

from api.utils import parse_xer_file

# sample minimal XER with a single activity
SAMPLE_XER = r"""ERMHDR	23.12	2026-02-23	Project	ADMIN	ST	dbxDatabaseNoName	Project Management	PKR
%T	TASK
%F	TASK_ID	TASK_NAME	START_DATE	FINISH_DATE	PERCENT_COMPLETE
%R	1	My Task	2026-03-01	2026-03-05	50
"""


def test_parse_xer_manual():
    # write sample content to a temporary file and parse
    fd, path = tempfile.mkstemp(suffix=".xer")
    os.close(fd)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write(SAMPLE_XER)
        activities = parse_xer_file(path)
        assert isinstance(activities, list)
        assert len(activities) == 1
        act = activities[0]
        assert act["id"] == "1"
        assert "My Task" in act["label"]
        assert act["start"] == "2026-03-01"
        assert act["end"] == "2026-03-05"
        assert act["progress"] == 0.5
    finally:
        os.remove(path)


def test_parse_xer_no_tasks():
    # completely empty structure should not crash
    fd, path = tempfile.mkstemp(suffix=".xer")
    os.close(fd)
    try:
        with open(path, "w", encoding="utf-8") as f:
            f.write("ERMHDR\n%T\tCURRTYPE\n")
        activities = parse_xer_file(path)
        assert isinstance(activities, list)
        assert activities == []
    finally:
        os.remove(path)
