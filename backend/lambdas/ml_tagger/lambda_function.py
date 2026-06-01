"""
ML Tagger Lambda Function

Triggered by S3 upload event. Downloads the uploaded image,
runs MegaDetector for animal detection, then SpeciesNet for classification.
Updates the tags field in DynamoDB.
"""

import json
import os
import urllib.parse
from collections import Counter

# torch.hub writes to ~/.cache by default, which is read-only in Lambda
os.environ.setdefault("TORCH_HOME", "/tmp/torch_hub")

import boto3
import torch
import numpy as np
from PIL import Image
import io

s3_client = boto3.client("s3")
dynamodb = boto3.resource("dynamodb")

MODEL_BUCKET = os.environ.get("MODEL_BUCKET", "ecolens-models-288515363084")
UPLOAD_BUCKET = os.environ.get("UPLOAD_BUCKET", "ecolens-uploads-288515363084")
FILES_TABLE = os.environ.get("FILES_TABLE", "ecolens-files")

DETECTOR_MODEL_KEY = "mdv5a.pt"
CLASSIFIER_MODEL_KEY = "model.pt"
DETECTOR_LOCAL_PATH = "/tmp/mdv5a.pt"
CLASSIFIER_LOCAL_PATH = "/tmp/model.pt"

DETECTION_THRESHOLD = 0.05
CROP_SIZE = 600
CLASSIFIER_INPUT_SIZE = 480

# Species labels supported by the model
SPECIES_LABELS = [
    "Alectura_lathami", "Antechinus_agilis", "Bos_taurus",
    "Burhinus_grallarius", "Canis_familiaris", "Chalcophaps_longirostris",
    "Colluricincla_harmonica", "Corcorax_melanorhamphos",
    "Dacelo_novaeguineae", "Dama_dama", "Eopsaltria_australis",
    "Felis_catus", "Geopelia_humeralis", "Gymnorhina_tibicen",
    "Homo_sapiens", "Isoodon_macrourus", "Lepus_europaeus",
    "Macropus_giganteus", "Menura_novaehollandiae", "Mus_musculus",
    "Oryctolagus_cuniculus", "Perameles_nasuta", "Pitta_versicolor",
    "Rattus", "Rattus_fuscipes", "Rattus_rattus",
    "Strepera_graculina", "Sus_scrofa", "Tachyglossus_aculeatus",
    "Thylogale_stigmatica", "Trichosurus_caninus",
    "Trichosurus_cunninghami", "Trichosurus_vulpecula",
    "Varanus_varius", "Vombatus_ursinus", "Vulpes_vulpes",
    "Wallabia_bicolor", "Canis_dingo", "Capra_hircus",
    "Casuarius_casuarius", "Heteromyias_cinereifrons",
    "Hypsiprymnodon_moschatus", "Megapodius_reinwardt",
    "Notamacropus_rufogriseus", "Orthonyx_spaldingii",
    "Uromys_caudimaculatus"
]

# Cache models across warm invocations
detector_model = None
classifier_model = None


def download_model_from_s3(bucket, key, local_path):
    """
    Download a model file from S3 to /tmp if not already cached.
    """
    if not os.path.exists(local_path):
        print(f"Downloading model {key} from S3...")
        s3_client.download_file(bucket, key, local_path)
        print(f"Model downloaded to {local_path}")
    else:
        print(f"Model already cached at {local_path}")


def load_models():
    """
    Load MegaDetector and SpeciesNet models. Uses global cache
    to avoid reloading on warm Lambda invocations.
    """
    global detector_model, classifier_model

    download_model_from_s3(MODEL_BUCKET, DETECTOR_MODEL_KEY, DETECTOR_LOCAL_PATH)
    download_model_from_s3(MODEL_BUCKET, CLASSIFIER_MODEL_KEY, CLASSIFIER_LOCAL_PATH)

    if detector_model is None:
        print("Loading MegaDetector...")
        detector_model = torch.hub.load(
            "ultralytics/yolov5", "custom",
            path=DETECTOR_LOCAL_PATH, force_reload=False
        )
        detector_model.conf = DETECTION_THRESHOLD
        print("MegaDetector loaded")

    if classifier_model is None:
        print("Loading SpeciesNet classifier...")
        classifier_model = torch.load(
            CLASSIFIER_LOCAL_PATH, map_location=torch.device("cpu")
        )
        classifier_model.eval()
        print("SpeciesNet loaded")

    return detector_model, classifier_model


def detect_animals(image, detector):
    """
    Run MegaDetector on an image. Returns list of bounding boxes
    that exceed the confidence threshold.

    Args:
        image: PIL Image
        detector: loaded MegaDetector model

    Returns:
        list of dicts with keys: bbox (x1, y1, x2, y2), confidence
    """
    results = detector(image)
    detections = []

    for *box, conf, cls in results.xyxy[0].cpu().numpy():
        if conf >= DETECTION_THRESHOLD:
            detections.append({
                "bbox": [int(b) for b in box],
                "confidence": float(conf)
            })

    print(f"Detected {len(detections)} animals")
    return detections


def crop_and_classify(image, detections, classifier):
    """
    Crop each detected region and classify species.

    Args:
        image: PIL Image
        detections: list of detection dicts from detect_animals
        classifier: loaded SpeciesNet model

    Returns:
        dict mapping species name -> count
    """
    species_counter = Counter()

    for det in detections:
        x1, y1, x2, y2 = det["bbox"]

        # Expand crop to CROP_SIZE centered on detection
        cx, cy = (x1 + x2) // 2, (y1 + y2) // 2
        half = CROP_SIZE // 2
        crop_x1 = max(0, cx - half)
        crop_y1 = max(0, cy - half)
        crop_x2 = min(image.width, cx + half)
        crop_y2 = min(image.height, cy + half)

        cropped = image.crop((crop_x1, crop_y1, crop_x2, crop_y2))
        cropped = cropped.resize(
            (CLASSIFIER_INPUT_SIZE, CLASSIFIER_INPUT_SIZE)
        )

        # Prepare input tensor: (B, H, W, C) normalized to [0, 1]
        img_array = np.array(cropped).astype(np.float32) / 255.0
        img_tensor = torch.from_numpy(img_array).unsqueeze(0)

        # Run classifier
        with torch.no_grad():
            output = classifier(img_tensor)
            pred_idx = torch.argmax(output, dim=1).item()

        if pred_idx < len(SPECIES_LABELS):
            species = SPECIES_LABELS[pred_idx]
            species_counter[species] += 1
            print(f"  Classified: {species} (confidence: {det['confidence']:.3f})")

    return dict(species_counter)


def lambda_handler(event, context):
    """
    Main Lambda handler. Processes S3 event notifications.
    """
    detector, classifier = load_models()

    for record in event.get("Records", []):
        bucket = record["s3"]["bucket"]["name"]
        key = urllib.parse.unquote_plus(record["s3"]["object"]["key"])

        print(f"Processing: s3://{bucket}/{key}")

        # Skip non-image files (video frames handled separately)
        ext = os.path.splitext(key)[1].lower()
        if ext not in [".jpg", ".jpeg", ".png", ".bmp", ".webp"]:
            print(f"Skipping non-image file: {ext}")
            continue

        try:
            # Download image from S3
            response = s3_client.get_object(Bucket=bucket, Key=key)
            image_bytes = response["Body"].read()
            image = Image.open(io.BytesIO(image_bytes)).convert("RGB")

            # Stage 1: Detect animals
            detections = detect_animals(image, detector)

            if not detections:
                tags = {}
                print("No animals detected")
            else:
                # Stage 2: Classify species
                tags = crop_and_classify(image, detections, classifier)

            # Update DynamoDB record with tags
            file_url = f"https://{bucket}.s3.amazonaws.com/{key}"
            table = dynamodb.Table(FILES_TABLE)
            table.update_item(
                Key={"file_url": file_url},
                UpdateExpression="SET tags = :t",
                ExpressionAttributeValues={":t": tags}
            )

            print(f"Tags updated: {tags}")

        except Exception as e:
            print(f"Error processing {key}: {str(e)}")
            raise e

    return {"statusCode": 200, "body": json.dumps("ML tagging complete")}
