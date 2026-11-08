# Asteria · STAR

A complete free star-dedication application built with **Next.js 16, React 19, TypeScript, PostgreSQL, and server-generated PDF certificates**. Local Cormorant Garamond and DM Sans fonts keep the celestial design consistent without a font-service dependency.

## Visitor experience

- Name a star, choose an occasion, write a personal dedication, and set a meaningful date.
- Share a private gift link or gift code. Recipients unwrap an animated envelope to reveal their dedication.
- Download an actual PDF certificate with embedded fonts, personal details, and automatic continuation pages for long messages; browser printing is also available.
- Explore a sample at `/gift/demo`. Responsive layouts and reduced-motion support cover desktop and mobile.

Dedications are free. No checkout or automatic email delivery is configured. Names, star maps, coordinates, constellation assignments, and distances are symbolic artistic keepsakes, not official astronomical naming rights or verified catalog records.

## Owner studio

Open `/admin` to sign in. The owner studio provides:

- An overview of published, draft, and archived dedications, recent gifts, and creation trends.
- Search, status filters, pagination, creation, editing, publishing, archiving, and deletion.
- PDF generation and a protected CSV registry export with spreadsheet-formula protection.
- Website content editing: branding, announcement, homepage/story copy, section headings, occasion cards, how-it-works steps, FAQs, contact details, SEO text, and certificate labels.
- Controls to pause public creation or show a maintenance message, plus configuration and storage health information.

Draft and archived dedications are unavailable through public gift and certificate endpoints. Optional email addresses are visible only through protected owner routes. Gift links/codes provide access to published dedications; send them only to intended recipients.

The current access model is **one owner account**, configured on the server. There is no default password, public admin registration, multi-user role management, or password-reset email service.

## Local setup

Node.js 24 and npm 11 were validated. Run commands from the repository root.

```sh
npm ci
cp .env.example .env.local
npm run admin:password
npm run dev
```

The password command reads a new password with hidden input and prints its scrypt hash. Store that hash as `ADMIN_PASSWORD_HASH` in `.env.local`, set your `ADMIN_EMAIL`, generate a random `AUTH_SECRET` of at least 32 bytes, and set `APP_URL` to your exact local origin including the port. Keep these values private. Next.js reads `.env.local`; it is ignored by Git.

The app defaults to port 3000. Set `PORT` to use another port and update `APP_URL` to match. See [.env.example](.env.example) for variable names. Credentials must never use the `NEXT_PUBLIC_` prefix.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm start` requires a completed build. Production must use HTTPS and a matching `APP_URL`; owner mutations enforce exact same-origin requests. Sessions are signed, expire after eight hours, and use HttpOnly/SameSite cookies. Rotating the password hash or signing secret invalidates existing sessions. Add host/edge rate limiting for a public deployment; an in-process limiter does not coordinate across serverless instances.

## Storage

### PostgreSQL — recommended for production

Set `DATABASE_URL` to a PostgreSQL connection string. The app initializes `asteria_stars` and `asteria_documents` on first use, so the initial role needs permission to create those tables/indexes. Remote connections verify TLS certificates. PostgreSQL enforces unique gift codes and uses row locks for concurrent changes.

The PostgreSQL adapter works with serverless or multiple application instances. Vercel explicitly requires `DATABASE_URL`: the app refuses to silently persist customer gifts on its temporary filesystem. Configure provider backups and verify recovery before launch.

### Local JSON — development or one persistent server

Without `DATABASE_URL`, gifts are stored in `data/stars.json` and website settings in `data/settings.json`. `STAR_DATA_DIR` can select another directory. Writes are serialized within one process and saved by atomic rename. Existing version-1 gift files are read without destructive migration; legacy gifts retain their IDs and default to published.

Use this adapter only with **one Node process** and a writable persistent directory. Keep the data outside disposable release directories, restrict access, and back it up independently. The ignored `data/` directory is not uploaded by Git.

### Import existing local gifts into PostgreSQL

Back up the source data, configure `DATABASE_URL` securely in a trusted shell, and set `STAR_DATA_DIR` to the source directory. Then run:

```sh
npm run db:migrate
```

The importer copies gifts and website documents and reports imported/skipped counts. It preserves existing destination IDs/codes and document keys rather than overwriting them, making reruns safe. Keep the source backup until the imported gifts/settings are verified. This CLI does not automatically load `.env.local`; export its required variables securely or use Node's environment-file support in a trusted session.

## Tests

`npm test` runs backend, authentication, content, security, storage, and PDF tests. Local tests use temporary directories. The PostgreSQL integration test requires an explicit `TEST_DATABASE_URL` pointing to a dedicated test database; it is skipped otherwise. It creates only temporary fixture rows/documents and cleans them up.

The PostgreSQL path was exercised against a real PostgreSQL 18 instance: concurrent inserts, row-lock updates, public/private data boundaries, lifecycle changes, settings, and idempotent import all passed.

For browser tests, start the app separately and run:

```sh
npm run test:e2e
```

The configuration uses `/usr/bin/chromium` by default. Set `CHROMIUM_PATH` for another installation and `E2E_BASE_URL` for another app origin. Browser tests create and modify dedications/content in the running application's store; use a separate `STAR_DATA_DIR` or test database and test owner configuration. Never run the mutation suite against customer data.

## Hosting

**Recommended: Vercel with managed PostgreSQL** for the simplest Next.js deployment workflow. Hostinger is suitable on a plan with verified Next.js/Node.js server support or on a VPS; a static-only plan cannot run this application.

See [deployment instructions and the Vercel/Hostinger comparison](docs/DEPLOYMENT.md) for environment variables, migration, backups, and release checks. Hosting accounts, domains, database credentials, and production owner credentials must be configured before a live deployment; this repository does not provision or purchase them automatically.
