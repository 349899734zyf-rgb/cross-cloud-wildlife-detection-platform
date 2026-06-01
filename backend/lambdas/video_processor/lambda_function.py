"""
Video Processor Lambda Function

Triggered by S3 upload of video files. Extracts frames at regular intervals
and saves them as individual images for ML processing.
"""

import json
import os
import urllib.parse
import subprocess
import glob

import boto3

s3_client = boto3.client("s3")

UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "ecolens-uploads-288515363084")
FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")
FRAME_INTERVAL = int(os.environ.get("FRAME_INTERVAL", "2"))  # seconds

VIDEO_EXTENSIONS = {".mp4", ".avi", ".mov", ".mkv", ".wmv"}


def lambda_handler(event, context):
    """
    Process video files by extracting frames at regular intervals.
    Each frame is saved to S3, which triggers the ML tagger via S3 event.
    """
    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        ext = os.path.splitext(key)[1].lower()
        if ext not in VIDEO_EXTENSIONS:
            print(f"Skipping non-video file: {key}")
            continue

        print(f"Processing video: s3://{bucket}/{key}")

        local_video = f"/tmp/{os.path.basename(key)}"
        s3_client.download_file(bucket, key, local_video)

        output_pattern = "/tmp/frame_%04d.jpg"

        try:
            subprocess.run([
                "ffmpeg", "-i", local_video,
                "-vf", f"fps=1/{FRAME_INTERVAL}",
                "-q:v", "2",
                output_pattern,
            ], check=True, capture_output=True, timeout=240)

            frame_files = sorted(glob.glob("/tmp/frame_*.jpg"))
            print(f"Extracted {len(frame_files)} frames via ffmpeg")

        except (subprocess.CalledProcessError, FileNotFoundError):
            print("ffmpeg not available, using OpenCV fallback")
            frame_files = extract_frames_opencv(local_video)

        base_name = os.path.splitext(os.path.basename(key))[0]
        user_prefix = os.path.dirname(key)

        for i, frame_path in enumerate(frame_files):
            frame_key = f"{user_prefix}/{base_name}_frame_{i:04d}.jpg"
            s3_client.upload_file(
                frame_path, UPLOAD_BUCKET, frame_key,
                ExtraArgs={"ContentType": "image/jpeg"}
            )
            print(f"Uploaded frame: {frame_key}")
            os.remove(frame_path)

        os.remove(local_video)
        print(f"Video processing complete: {len(frame_files)} frames extracted")

    return {"statusCode": 200, "body": json.dumps("Video processing complete")}


def extract_frames_opencv(video_path):
    """
    Fallback frame extraction using OpenCV.
    """
    import cv2

    cap = cv2.VideoCapture(video_path)
    fps = cap.get(cv2.CAP_PROP_FPS)
    frame_interval_frames = max(1, int(fps * FRAME_INTERVAL))
    frame_files = []
    frame_count = 0
    saved_count = 0

    while cap.isOpened():
        ret, frame = cap.read()
        if not ret:
            break

        if frame_count % frame_interval_frames == 0:
            frame_path = f"/tmp/frame_{saved_count:04d}.jpg"
            cv2.imwrite(frame_path, frame)
            frame_files.append(frame_path)
            saved_count += 1

        frame_count += 1

    cap.release()
    print(f"OpenCV extracted {saved_count} frames")
    return frame_files
