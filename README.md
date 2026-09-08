# Crypto Backend

Starter backend structure for a crypto API project.

## Quick Start

1. Install dependencies:
   - `npm install`
2. Configure `.env`.
3. Run in development:
   - `npm run dev`
4. Run in production:
   - `npm start`

## Project Structure

- `src/config`: environment and external integrations config
- `src/controllers`: request handlers
- `src/services`: business logic
- `src/models`: data models
- `src/routes`: API routes
- `src/middlewares`: auth/error/rate limit middleware
- `src/utils`: shared helpers and response utilities
- `src/jobs`: background and scheduled jobs
- `database/migrations`: DB migrations
- `database/seeders`: seed scripts
