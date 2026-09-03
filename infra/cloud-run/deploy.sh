#!/usr/bin/env bash
set -euo pipefail
PROJECT_ID="${PROJECT_ID:?Set PROJECT_ID}"
REGION="${REGION:-asia-south1}"
REPO="${REPO:-rizvi-foms}"
SERVICE="${SERVICE:-rizvi-foms-api}"
IMAGE="${REGION}-docker.pkg.dev/${PROJECT_ID}/${REPO}/${SERVICE}:$(date +%Y%m%d-%H%M%S)"
gcloud config set project "$PROJECT_ID"
gcloud artifacts repositories create "$REPO" --repository-format=docker --location="$REGION" 2>/dev/null || true
gcloud builds submit ./backend --tag "$IMAGE"
gcloud run deploy "$SERVICE" --image "$IMAGE" --region "$REGION" --min 3 --max 1000 --cpu 2 --memory 2Gi --concurrency 80 --timeout 300 --set-env-vars "NODE_ENV=production,PORT=8080,GOOGLE_CLOUD_PROJECT=$PROJECT_ID,PUBSUB_DOCUMENT_TOPIC=rizvi-document-ingest,GCS_BUCKET=${GCS_BUCKET:?Set GCS_BUCKET}" --allow-unauthenticated
