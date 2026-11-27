#!/bin/sh
set -eu

: "${S3_ENDPOINT:=http://storage:9000}"
: "${S3_BUCKET:=changeradar}"
: "${APP_URL:=http://localhost:3000}"

AWS="aws --endpoint-url ${S3_ENDPOINT}"

echo "Waiting for object storage at ${S3_ENDPOINT}..."
attempt=1
while ! ${AWS} s3api list-buckets >/dev/null 2>&1; do
  if [ "${attempt}" -ge 60 ]; then
    echo "Object storage did not become ready" >&2
    exit 1
  fi
  attempt=$((attempt + 1))
  sleep 2
done

if ! ${AWS} s3api head-bucket --bucket "${S3_BUCKET}" >/dev/null 2>&1; then
  echo "Creating bucket ${S3_BUCKET}"
  ${AWS} s3api create-bucket --bucket "${S3_BUCKET}" >/dev/null
else
  echo "Bucket ${S3_BUCKET} already exists"
fi

echo "Blocking public access on ${S3_BUCKET}"
${AWS} s3api put-public-access-block \
  --bucket "${S3_BUCKET}" \
  --public-access-block-configuration \
  "BlockPublicAcls=true,IgnorePublicAcls=true,BlockPublicPolicy=true,RestrictPublicBuckets=true" \
  >/dev/null

echo "Applying CORS for ${APP_URL}"
sed "s|__APP_URL__|${APP_URL}|g" /scripts/cors.json >/tmp/cors.json
${AWS} s3api put-bucket-cors \
  --bucket "${S3_BUCKET}" \
  --cors-configuration file:///tmp/cors.json

echo "Applying uploads/ 1-day lifecycle rule"
${AWS} s3api put-bucket-lifecycle-configuration \
  --bucket "${S3_BUCKET}" \
  --lifecycle-configuration file:///scripts/lifecycle.json

echo "Bucket ${S3_BUCKET} ready"
${AWS} s3api get-bucket-cors --bucket "${S3_BUCKET}"
${AWS} s3api get-bucket-lifecycle-configuration --bucket "${S3_BUCKET}"
