# Fin-tech Finance Provider ? PO Financing Platform (MVP)

A purchase-order financing platform where suppliers upload purchase orders and request financing, while administrators manually review and approve or reject applications. Underwriting remains human-led; the platform does not score risk or make lending decisions.

## Stack

| Layer | Technology |
|---|---|
| Frontend | Next.js 14 + JavaScript + Tailwind CSS |
| API | Python FastAPI |
| Database | PostgreSQL (local Docker or Amazon RDS for AWS hosting) |
| Authentication | Amazon Cognito User Pools |
| Documents | Private Amazon S3 bucket with short-lived presigned URLs |
| Hosting | Docker Compose locally; deployable to AWS App Runner/ECS with RDS |

## Product flow

1. A supplier signs in with Cognito and uploads a PO PDF directly to private S3 using a short-lived presigned URL.
2. The supplier enters PO details; the API stores them in PostgreSQL.
3. The supplier requests financing based on the total PO value.
4. An admin reviews the request and views the PO using a temporary S3 URL.
5. An admin manually approves, rejects, or disburses capital in 2 milestone tranches:
   - **Tranche 1 (60% of total value)**: Disbursed upon Order Received.
   - **Tranche 2 (Remaining 40% of total value)**: Disbursed once the order is placed.

Roles remain in PostgreSQL and are never accepted from Cognito claims or the browser. Public sign-up creates supplier accounts only. An administrator must be provisioned internally and assigned the ADMIN role in PostgreSQL.

## AWS setup

Create an Amazon Cognito User Pool with email sign-in, email verification, and a public app client **without a client secret**. Enable `USER_PASSWORD_AUTH` and `REFRESH_TOKEN_AUTH` for the app client. Configure the user pool password policy to at least 8 characters. Optional/required MFA challenges are not handled by the current login UI.

Create a private S3 bucket in the same AWS region. Turn on Block Public Access and configure CORS to allow `PUT` from your frontend origin with the `Content-Type` header and expose `ETag`. Example bucket CORS:

```json
[{"AllowedOrigins":["http://localhost:3000","https://your-frontend.example.com"],"AllowedMethods":["PUT","GET"],"AllowedHeaders":["Content-Type"],"ExposeHeaders":["ETag"],"MaxAgeSeconds":3000}]
```

Give the backend AWS role `s3:PutObject` and `s3:GetObject` on the bucket object ARN. Use an IAM role in AWS hosting and an AWS profile locally; do not put AWS access keys in frontend variables.

Copy `backend/.env.example` to `backend/.env` and `frontend/.env.local.example` to `frontend/.env.local`. Set the Cognito pool/client IDs in the backend and frontend, and the bucket name in the backend. For Docker Compose, also put the two `NEXT_PUBLIC_*` Cognito values and `NEXT_PUBLIC_API_BASE_URL` in a root `.env` next to `docker-compose.yml`, because Next.js embeds them at build time.

## Run locally

Prerequisites: Docker Compose, an AWS account with Cognito and S3 configured as above, and AWS CLI credentials available to the backend container. For local Compose, pass your AWS profile or configure credentials in the normal boto3 credential chain.

```bash
docker compose up --build
```

Frontend: http://localhost:3000  
API docs: http://localhost:8080/docs

For local non-Docker development, install `backend/requirements.txt`, run PostgreSQL and apply `backend/schema.sql`, then start FastAPI with `uvicorn app.main:app --reload --port 8080`. In `frontend`, run `npm install` and `npm run dev`.

## Existing Firebase/GCP data migration

The code no longer uses Firebase or Google Cloud Storage. Cognito cannot reuse Firebase user IDs or passwords, so existing users must create/confirm Cognito accounts with their existing verified email. Their first successful registration/sign-in links the Cognito subject to the existing PostgreSQL row by email, preserving role and financing history. Existing admin email addresses retain their ADMIN role.

Before deploying against an existing database:

1. Back up PostgreSQL and the GCS bucket.
2. Copy the GCS objects to the new S3 bucket while preserving object keys (for example, download the bucket and upload it with `aws s3 sync`).
3. Apply `backend/migrations/001_firebase_gcp_to_aws.sql` to the existing database. It removes Firebase UID references and renames the PO storage-key column while preserving keys and application data.
4. Configure Cognito and S3 environment settings, then deploy the app.

Do not use `backend/schema.sql` to initialize an existing production database; that file is for a fresh database.

## AWS deployment outline

Deploy the frontend and FastAPI backend as separate App Runner services or ECS services. Put PostgreSQL on Amazon RDS, keep the S3 bucket private, attach an IAM role to the backend service, and restrict API CORS to the deployed frontend origin. Provide the Cognito pool/client IDs and `AWS_REGION` to both services as appropriate; provide `S3_BUCKET_NAME` and database credentials only to the backend. Apply the fresh schema or migration before the first release. The included Dockerfiles build the services; the AWS account, domain, database, Cognito pool, and bucket must be created and configured in your AWS environment.

## Security and product boundaries

- PDF contents travel directly between the browser and private S3; the API only issues time-limited upload/view URLs.
- Cognito ID tokens are verified by the API against the pool's published signing keys, issuer, and app client ID.
- Business roles are loaded from PostgreSQL, so a supplier cannot elevate themselves by changing browser data or token claims.
- Suppliers can access only their own PO documents; admins can review all applications.
- Capital is disbursed in 2 tranches: 60% of total value upon Order Received, and remaining 40% after order is placed.
- Admin decisions are manual. Automated risk scoring and underwriting are intentionally out of scope.
