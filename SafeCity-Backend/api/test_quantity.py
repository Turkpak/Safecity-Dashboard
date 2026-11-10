from types import SimpleNamespace

from django.test import SimpleTestCase

from api.quantity import (
    QuantityError, apply_quantity_and_progress, extract_quantity_from_name, quantity_payload,
)


def task(**kw):
    base = dict(progress=0, total_quantity=None, completed_quantity=None)
    base.update(kw)
    return SimpleNamespace(**base)


class ExtractQuantityTests(SimpleTestCase):
    def test_reads_trailing_number_in_brackets(self):
        self.assertEqual(extract_quantity_from_name("Fixed Cameras (53)"), 53)
        self.assertEqual(extract_quantity_from_name("PTZ Cameras (17) "), 17)
        self.assertEqual(extract_quantity_from_name("Cable (1,200)"), 1200)

    def test_ignores_names_without_a_count(self):
        for name in ("Mobilization", "Phase (A)", "Poles (0)", None):
            self.assertIsNone(extract_quantity_from_name(name))


class ApplyQuantityTests(SimpleTestCase):
    def test_progress_is_derived_from_units(self):
        t = task()
        apply_quantity_and_progress(t, {"total_quantity": 53, "completed_quantity": 20})
        self.assertEqual(t.progress, 37.74)
        self.assertEqual(quantity_payload(t)["remaining_quantity"], 33)

    def test_completed_cannot_exceed_total(self):
        with self.assertRaises(QuantityError):
            apply_quantity_and_progress(task(total_quantity=10), {"completed_quantity": 11})

    def test_bad_values_are_rejected(self):
        for bad in (-1, "abc"):
            with self.assertRaises(QuantityError):
                apply_quantity_and_progress(task(), {"total_quantity": bad})

    def test_completed_needs_a_total(self):
        with self.assertRaises(QuantityError):
            apply_quantity_and_progress(task(), {"completed_quantity": 5})

    def test_plain_progress_still_works_without_units(self):
        t = task()
        apply_quantity_and_progress(t, {"progress": "40"})
        self.assertEqual(t.progress, 40)
        with self.assertRaises(QuantityError):
            apply_quantity_and_progress(t, {"progress": 150})

    def test_completed_is_derived_from_progress_when_missing(self):
        t = task(total_quantity=50, progress=40)
        p = quantity_payload(t)
        self.assertEqual(p["completed_quantity"], 20)
        self.assertEqual(p["remaining_quantity"], 30)