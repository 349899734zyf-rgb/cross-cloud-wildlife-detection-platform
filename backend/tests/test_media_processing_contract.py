"""Local contract tests for Member B Lambda outputs.

These tests avoid AWS calls and heavy model loading. They protect the fields
that A's infrastructure and C's frontend need from Member B.
"""

from __future__ import annotations

import importlib.util
import io
import sys
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import MagicMock

from PIL import Image


ROOT = Path(__file__).resolve().parents[2]


class FakeBoto3:
    def client(self, service_name: str):
        return MagicMock(name=f"{service_name}_client")

    def resource(self, service_name: str):
        return MagicMock(name=f"{service_name}_resource")


def load_lambda(path: Path):
    sys.modules["boto3"] = FakeBoto3()
    spec = importlib.util.spec_from_file_location(path.stem, path)
    module = importlib.util.module_from_spec(spec)
    assert spec.loader is not None
    spec.loader.exec_module(module)
    return module


def sample_jpeg_bytes() -> bytes:
    image = Image.new("RGB", (640, 360), "green")
    buffer = io.BytesIO()
    image.save(buffer, format="JPEG")
    return buffer.getvalue()


def test_thumbnail_generator_writes_contract_record():
    module = load_lambda(ROOT / "backend/lambdas/thumbnail_generator/lambda_function.py")

    module.s3_client.get_object.return_value = {"Body": io.BytesIO(sample_jpeg_bytes())}
    fake_table = MagicMock()
    module.dynamodb.Table.return_value = fake_table

    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "upload-bucket"},
                    "object": {"key": "uploads/demo-user/demo-file-001/demo.jpg", "size": 1234},
                }
            }
        ]
    }

    response = module.lambda_handler(event, SimpleNamespace())

    assert response["statusCode"] == 200
    item = fake_table.put_item.call_args.kwargs["Item"]
    assert item["file_id"] == "demo-file-001"
    assert item["file_url"] == "https://upload-bucket.s3.amazonaws.com/uploads/demo-user/demo-file-001/demo.jpg"
    assert item["thumbnail_url"].endswith("thumbnails/demo-user/demo-file-001.jpg")
    assert item["file_type"] == "image"
    assert item["tags"] == {}
    assert item["status"] == "processing"
    assert item["user_id"] == "demo-user"


def test_ml_tagger_skips_non_image_events_without_loading_models():
    module = load_lambda(ROOT / "backend/lambdas/ml_tagger/lambda_function.py")
    module.load_models = MagicMock(name="load_models")

    event = {
        "Records": [
            {
                "s3": {
                    "bucket": {"name": "upload-bucket"},
                    "object": {"key": "uploads/demo-user/demo-file-001/demo.mp4", "size": 1234},
                }
            }
        ]
    }

    response = module.lambda_handler(event, SimpleNamespace())

    assert response["statusCode"] == 200
    module.load_models.assert_not_called()
    module.s3_client.get_object.assert_not_called()
