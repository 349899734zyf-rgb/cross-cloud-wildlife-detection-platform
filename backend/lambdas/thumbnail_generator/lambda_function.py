"""
Thumbnail Generator Lambda Function

Triggered by S3 upload event. Downloads the uploaded image/video,
generates a 128x128 thumbnail, and uploads it to the thumbnails bucket.
Also creates an initial record in DynamoDB.
"""

import json
import os
import hashlib
import urllib.parse
from datetime import datetime, timezone

import boto3
from PIL import Image
import io

s3_client = boto3.client("s3")
lambda_client = boto3.client("lambda")
dynamodb = boto3.resource("dynamodb")

THUMBNAIL_BUCKET = os.environ.get("THUMBNAIL_BUCKET", "ecolens-thumbnails-288515363084")
FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")
ML_TAGGER_FUNCTION = os.environ.get("ML_TAGGER_FUNCTION", "ecolens-ml-tagger")
VIDEO_PROCESSOR_FUNCTION = os.environ.get("VIDEO_PROCESSOR_FUNCTION", "ecolens-video-processor")
THUMBNAIL_SIZE = (128, 128)


def lambda_handler(event, context):
    """
    Main Lambda handler. Processes S3 event notifications.
    """
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])
        size = record["s3"]["object"].get("size", 0)

        print(f"Processing file: s3://{bucket}/{key}")

        # Skip non-image/video files
        ext = os.path.splitext(key)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".gif", ".bmp", ".webp",
                       ".mp4", ".avi", ".mov", ".mkv"]:
            print(f"Skipping unsupported file type: {ext}")
            continue

        file_type = "video" if ext in [".mp4", ".avi", ".mov", ".mkv"] else "image"

        try:
            # Download original file from S3
            response = s3_client.get_object(Bucket=bucket, Key=key)
            file_bytes = response["Body"].read()

            # Calculate checksum
            checksum = hashlib.sha256(file_bytes).hexdigest()

            # Generate thumbnail
            if file_type == "image":
                thumbnail_bytes = generate_image_thumbnail(file_bytes)
            else:
                thumbnail_bytes = generate_video_thumbnail(file_bytes, ext)

            # Upload thumbnail to S3
            thumbnail_key = f"thumb_{key}"
            s3_client.put_object(
                Bucket=THUMBNAIL_BUCKET,
                Key=thumbnail_key,
                Body=thumbnail_bytes,
                ContentType="image/jpeg"
            )

            thumbnail_url = f"https://{THUMBNAIL_BUCKET}.s3.amazonaws.com/{thumbnail_key}"
            file_url = f"https://{bucket}.s3.amazonaws.com/{key}"

            # Extract user_id from key (format: <user_id>/<filename>)
            parts = key.split("/")
            user_id = parts[0] if len(parts) > 1 else "unknown"
            file_name = parts[-1]

            # Write initial record to DynamoDB
            table = dynamodb.Table(FILES_TABLE)
            table.put_item(Item={
                "file_url": file_url,
                "thumbnail_url": thumbnail_url,
                "file_type": file_type,
                "file_checksum": checksum,
                "tags": {},  # ML tagger will fill this
                "user_id": user_id,
                "upload_time": datetime.now(timezone.utc).isoformat(),
                "file_name": file_name,
                "file_size": size
            })

            print(f"Thumbnail created: {thumbnail_url}")
            print(f"DynamoDB record created for: {file_url}")

            # Asynchronously invoke ML tagger for images, video processor for videos
            s3_record_payload = json.dumps({
                "Records": [{"s3": {"bucket": {"name": bucket}, "object": {"key": key}}}]
            })
            if file_type == "image":
                lambda_client.invoke(
                    FunctionName=ML_TAGGER_FUNCTION,
                    InvocationType="Event",
                    Payload=s3_record_payload
                )
                print(f"ML tagger invoked for: {key}")
            else:
                lambda_client.invoke(
                    FunctionName=VIDEO_PROCESSOR_FUNCTION,
                    InvocationType="Event",
                    Payload=s3_record_payload
                )
                print(f"Video processor invoked for: {key}")

        except Exception as e:
            print(f"Error processing {key}: {str(e)}")
            raise e

    return {"statusCode": 200, "body": json.dumps("Thumbnails generated")}


def generate_image_thumbnail(file_bytes):
    """
    Generate a JPEG thumbnail from image bytes.
    """
    image = Image.open(io.BytesIO(file_bytes))
    image = image.convert("RGB")
    image.thumbnail(THUMBNAIL_SIZE)

    buffer = io.BytesIO()
    image.save(buffer, format="JPEG", quality=85)
    buffer.seek(0)
    return buffer.read()


def generate_video_thumbnail(file_bytes, ext):
    """
    Extract the first frame from a video and generate a thumbnail.
    Uses a temporary file since cv2 needs a file path.
    """
    import cv2
    import tempfile

    # Write video to temp file
    suffix = ext if ext.startswith(".") else f".{ext}"
    with tempfile.NamedTemporaryFile(suffix=suffix, delete=False) as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name

    try:
        cap = cv2.VideoCapture(tmp_path)
        success, frame = cap.read()
        cap.release()

        if not success:
            raise ValueError("Failed to extract frame from video")

        # Convert BGR to RGB
        frame_rgb = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        image = Image.fromarray(frame_rgb)
        image.thumbnail(THUMBNAIL_SIZE)

        buffer = io.BytesIO()
        image.save(buffer, format="JPEG", quality=85)
        buffer.seek(0)
        return buffer.read()
    finally:
        os.unlink(tmp_path)
