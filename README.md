# PG Tenant Management Platform

A web application for discovering paying guest (PG) accommodation and managing day-to-day PG operations.

**Project date:** October 2026  
**Project type:** Individual development project

## Overview

The PG Tenant Management Platform brings public PG listings and property-management workflows into one application. Visitors can browse published properties. Authenticated PG managers can work with property details, rooms, tenant records, rent bills, payments, and reports.

The current implementation focuses on public PG discovery and PG-manager operations. A full tenant self-service portal and platform-level Super Admin/Admin dashboards are planned extensions and should not be considered implemented unless they have been separately built and tested.

## Main Features

### Public website
- Public homepage
- Browse published PG listings
- View PG details and available property photographs

### PG manager
- Manage property information and publication status
- Manage rooms and room details
- Maintain tenant records
- Support tenant onboarding, transfers, and move-out workflows
- Generate rent bills and record payments
- Review payment statuses, including pending or overdue items where supported by the current data
- View reports and analytics related to revenue, occupancy, tenants, and payments

### Planned or partial functionality
- Full tenant self-service portal
- Platform Super Admin dashboard
- Platform Admin dashboard with permission-limited access
- Support/complaint management and notifications
- Online payment gateway integration

## Technology Stack

| Technology | Purpose |
|---|---|
| React | Frontend user interface |
| Vite | Development server and build tooling |
| Tailwind CSS | UI styling |
| React Router | Client-side navigation |
| Supabase Auth | Authentication and sessions |
| Supabase PostgreSQL | Relational data storage |
| PostgreSQL Row-Level Security (RLS) | Database access policies |
| Supabase Storage | Property image storage |

The application uses Supabase services directly through frontend service modules. A separate Express or FastAPI server is not part of the architecture described here.

## Requirements

Install the following before running the application:
- Node.js LTS and npm
- A Supabase project
- Git (optional, for cloning and version control)

## Setup and Run Locally

### 1. Clone the repository

```bash
git clone https://github.com/PranavR07-dot/pg-tenant-management-platform.git
cd pg-tenant-management-platform
```

If the repository contains the application inside a `frontend` directory, enter it:

```bash
cd frontend
```

If `package.json` is already in the current directory, do not run `cd frontend` again.

### 2. Install dependencies

```bash
npm install
```

### 3. Configure environment variables

Create a `.env.local` file in the same directory as the frontend `package.json`:

```env
VITE_SUPABASE_URL=https://YOUR_PROJECT_ID.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_PUBLISHABLE_OR_ANON_KEY
```

Replace the placeholders with the URL and publishable/anon key from your Supabase project. Use the exact variable names expected by `src/lib/supabase.js`.

**Security:** Never put a Supabase service-role key, database password, or other secret in a frontend `VITE_` variable or commit it to GitHub. Keep `.env.local` out of version control.

### 4. Configure the Supabase database

The repository includes SQL migration scripts under `supabase/migrations/`. Review the scripts and apply the required migrations to your Supabase project in the intended order using the Supabase SQL Editor or your approved migration workflow.

Confirm that required tables, views, policies, and functions exist; RLS policies match the intended access model; and storage buckets and policies for property images are configured. The presence of a migration file in GitHub does not mean it has already been applied to Supabase.

### 5. Start the development server

```bash
npm run dev
```

Open the local URL printed in the terminal, usually `http://localhost:5173`.

### 6. Check the production build

```bash
npm run build
```

If the project defines a lint script, run:

```bash
npm run lint
```

## Important Routes

Routes may redirect based on authentication and access rules.

| Route | Purpose |
|---|---|
| `/` | Public homepage |
| `/pgs` | Public PG listings |
| `/pgs/:id` | PG detail page |
| `/manager/login` | Manager login |
| `/manager/dashboard` | Manager dashboard |

Use the actual route definitions in `src/App.jsx` as the source of truth if any route differs.

## Repository Structure

```text
src/
  components/   Reusable UI components
  context/      Authentication/session context
  lib/          Supabase client configuration
  pages/
    auth/       Authentication pages
    dashboard/  Manager dashboard
    payments/   Rent billing and payment workflows
    public/     Public PG website
    reports/    Reports and analytics
    rooms/      Property and room management
    tenants/    Tenant management
  routes/       Protected-route logic
  services/     Data access and application services

supabase/
  migrations/   Database schema and policy migrations
```

The exact files may evolve as development continues.

## Security Notes

- Do not commit `.env.local` or credentials.
- Use only the Supabase publishable/anon key in the browser.
- Never expose a service-role key in frontend code.
- Review and test RLS policies for every table and public view.
- Verify that public queries return only intended published-property information.
- Do not use real tenant personal data in public demonstrations or screenshots.

## Testing Checklist

Run the application locally and verify these flows before treating them as complete:
- Registration, login, logout, and protected routes
- Public listing and property-detail pages
- Property and room create/update operations
- Tenant onboarding, update, transfer, and move-out flows
- Bill generation and payment recording
- Reports and analytics
- Access control and unauthorized requests
- Image upload and public image display

Record actual outcomes and screenshots in the testing report. Do not describe a feature as tested unless you have verified it in the running application and database.

## Known Scope Limitations

- Super Admin and platform Admin modules are planned architecture unless separately implemented.
- Tenant self-service functionality may be partial.
- Online payment processing, automated notifications, and support workflows are future enhancements unless verified in the code.
- Runtime behavior depends on correct Supabase configuration and database migrations.

## Project Deliverables

The project submission may include:
- Source code and SQL migrations
- Project report and development flowcharts
- Recorded video demonstration
- Project execution plan
- Feature documentation
- Testing report
- Setup instructions

## Author

**Pranav Mahadev Raikar**  
B.Tech — Computer Science and Design

## License

No license has been specified. Contact the project author before reusing or redistributing this code.
