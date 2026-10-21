import json

from django.contrib.gis.geos import MultiPolygon
from django.core.files.uploadedfile import SimpleUploadedFile
from django.test import SimpleTestCase
from rest_framework.exceptions import ValidationError

from api.serializers import ProjectSerializer


def polygon_geometry(offset=0):
    return {
        "type": "Polygon",
        "coordinates": [[
            [offset, offset],
            [offset + 1, offset],
            [offset + 1, offset + 1],
            [offset, offset + 1],
            [offset, offset],
        ]],
    }


class ProjectBoundaryParsingTests(SimpleTestCase):
    def parse(self, geojson):
        boundary_file = SimpleUploadedFile(
            "boundary.geojson",
            json.dumps(geojson).encode("utf-8"),
            content_type="application/geo+json",
        )
        return ProjectSerializer()._parse_boundary_file(boundary_file)

    def test_feature_collection_combines_all_polygon_features(self):
        result = self.parse({
            "type": "FeatureCollection",
            "features": [
                {"type": "Feature", "properties": {}, "geometry": polygon_geometry()},
                {"type": "Feature", "properties": {}, "geometry": polygon_geometry(2)},
            ],
        })

        self.assertIsInstance(result, MultiPolygon)
        self.assertEqual(len(result), 2)
        self.assertEqual(result.srid, 4326)

    def test_raw_polygon_geometry_is_accepted(self):
        result = self.parse(polygon_geometry())

        self.assertIsInstance(result, MultiPolygon)
        self.assertEqual(len(result), 1)
        self.assertEqual(result.srid, 4326)

    def test_feature_geojson_is_accepted(self):
        result = self.parse({
            "type": "Feature",
            "properties": {},
            "geometry": polygon_geometry(),
        })

        self.assertIsInstance(result, MultiPolygon)
        self.assertEqual(len(result), 1)

    def test_non_polygon_geojson_returns_a_boundary_file_error(self):
        with self.assertRaises(ValidationError) as context:
            self.parse({
                "type": "Point",
                "coordinates": [0, 0],
            })

        self.assertIn("boundary_file", context.exception.detail)
