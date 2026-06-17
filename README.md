# Super Duper Fiesta — Fintech starter scaffold

This repository contains a minimal starter scaffold for a US-focused fintech online banking MVP:
- Next.js frontend (not included yet)
- NestJS backend with Prisma schema and an example LedgerService implementing atomic double-entry transfers
- Docker Compose for a local Postgres DB and Adminer

Quick start (local):
1. Copy .env.example -> .env and set DATABASE_URL=postgresql://postgres:postgres@localhost:5432/fintech_dev
2. docker compose up -d
3. cd backend
4. npm install
5. npx prisma generate
6. npx prisma migrate dev --name init
7. npm run start:dev

Notes:
- Use a managed Postgres in production (RDS/Aurora/Cloud SQL).
- Use a secrets manager (Vault, AWS Secrets Manager) in production; do NOT store secrets in the repo.
- Do not store card PAN/CVV — use tokenized processors (Stripe, Marqeta).

Next steps I can take for you:
- Push a basic Next.js frontend and Expo mobile skeleton.
- Add auth endpoints (JWT + refresh tokens) and next-auth integration.
- Integrate a sandbox banking partner (Unit/Stripe/Synapse) in the backend.
- Add CI (GitHub Actions) and basic IaC (Terraform) stubs.

Reply which next steps you want me to continue with and I will push them in subsequent commits.
