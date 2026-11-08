# Hosting Asteria

## Recommended: Vercel with managed PostgreSQL

Vercel is the simplest fit for this Next.js application: Git-based deployment, preview deployments, HTTPS, and the Next.js runtime are managed together. Use a managed PostgreSQL service (for example Neon or Supabase) and its connection string. The application must not store customer gifts on a Vercel function's filesystem. Asteria refuses filesystem storage when `VERCEL` is set and `DATABASE_URL` is missing.

Choose a commercial plan appropriate to the site's actual use and the provider's current terms. Database, storage, traffic, and hosting charges are separate considerations. No current prices or quotas have been assumed here.

| Choice | Good fit | Operational responsibility |
| --- | --- | --- |
| Vercel + managed PostgreSQL | Straightforward Next.js deployments, previews, and an expanding public site | Configure database, owner credentials, domain, and backups; monitor service limits |
| Hostinger managed Node.js hosting | An account with a plan that explicitly supports the required Node.js version and Next.js server | Confirm supported runtime, startup command, writable persistent paths, environment variables, and database connectivity with the plan |
| Hostinger VPS | Full server control, predictable persistent storage, or additional services | Maintain OS/security updates, TLS/reverse proxy, process manager, database backups, monitoring, and recovery |

Ordinary static hosting is insufficient: API routes, authentication, certificates, and the admin require a Node.js server. A MySQL database is not a replacement for this app's PostgreSQL adapter. A Hostinger plan is suitable only after its Node.js/Next.js support is confirmed; owning a Hostinger account alone does not establish that support.

## Required production configuration

Use the hosting provider's secure environment-variable settings. Never commit secrets, paste them into chat, or expose them through `NEXT_PUBLIC_` variables.

| Variable | Purpose |
| --- | --- |
| `DATABASE_URL` | PostgreSQL connection string; required on Vercel and recommended for production |
| `ADMIN_EMAIL` | Owner's sign-in email |
| `ADMIN_PASSWORD_HASH` | Scrypt password hash generated with `npm run admin:password`; never a plain-text password |
| `AUTH_SECRET` | Cryptographically random session-signing secret, at least 32 characters |
| `APP_URL` | Canonical HTTPS origin, for example `https://stars.example.com`; update it when the domain changes |
| `STAR_DATA_DIR` | Optional local-storage directory on a persistent server; unused for records stored in PostgreSQL |

Generate the password hash locally with the provided password command. Generate `AUTH_SECRET` with a password manager or `openssl rand -hex 32`. Store both directly in the host's secret settings. The app has no default admin password. Changing the password hash or signing secret invalidates existing admin sessions.

Use a separate database and owner configuration for preview deployments. Keep `APP_URL` aligned with each deployment's actual origin; otherwise same-origin protections will reject admin writes. Do not reuse production credentials in untrusted preview builds.

## Vercel deployment

1. Import `demalija/STAR` into Vercel and select the branch to deploy. Choose Next.js and Node.js 24 if available for the selected account/runtime.
2. Provision managed PostgreSQL in a region close to the application. Use the provider's pooled connection string if required by its serverless guidance. Configure `DATABASE_URL` with TLS; do not disable certificate verification.
3. Set the owner and canonical-origin variables listed above before enabling public traffic. If the final domain is not ready, first use the assigned deployment origin and then update `APP_URL` after connecting the custom domain.
4. Use `npm ci` for install and `npm run build` for build. Vercel manages the Next.js server; do not configure `npm start` as a separate background process there.
5. The app initializes its `asteria_stars` and `asteria_documents` tables on first database use. The initial database role needs schema-creation privileges. Review least-privilege access and migrations with your database provider before restricting the runtime role.
6. If existing local gifts must be retained, set `DATABASE_URL` securely in a trusted shell and point `STAR_DATA_DIR` at the existing local data directory. Run `npm run db:migrate` before switching traffic. The importer copies dedications and website settings; existing IDs/keys are skipped rather than overwritten, so rerunning it is safe. Check its imported/skipped counts, and retain a verified source backup. Deploying code does not upload the ignored `data/` directory. Environment files are not automatically loaded by this CLI; export the required variables securely or use Node's `--env-file` support in a trusted local session.
7. Enable database backups/point-in-time recovery appropriate to the business and test restoring a backup. Add provider/edge rate limiting for login and public creation; the in-process login limiter alone does not coordinate across serverless instances.

## Hostinger deployment

For managed Node.js hosting, confirm current support in hPanel or official support documentation before choosing the plan. Configure the project as a server-rendered Next.js application with the same environment variables and managed PostgreSQL connection. Use `npm ci`, `npm run build`, and the platform-supported startup method. Avoid guessing a plan's supported Node.js versions or build limits.

For a VPS, use Node.js 24, an unprivileged app user, an HTTPS reverse proxy, and a process manager/system service that restarts `npm start`. Set the process's working directory to the checkout. Run one Node process if using the local JSON adapter; PostgreSQL is preferred for concurrent app instances. Put local data on a durable volume outside disposable release directories, restrict its permissions, and back it up separately. The same applies to site-content settings.

## Release checks

Before going live, verify:

- Production build, TypeScript, backend tests, and browser tests pass.
- `/admin` requires sign-in; invalid sessions and cross-origin writes are denied.
- A draft dedication stays private, publishing exposes the gift, and archiving removes public access.
- The public wizard creates a gift, gift codes work, and the recipient can unwrap and download a valid PDF.
- Website-content edits appear on the public homepage.
- Login/logout, desktop/mobile layouts, domain HTTPS, and database persistence after restart work.
- Database backups and restore access are configured. Admin credentials and email are absent from public responses and client bundles.

The site currently creates free symbolic dedications. There is no checkout, automatic email delivery, or official astronomical naming/ownership registration.

## Official references

- [Vercel: Next.js](https://vercel.com/docs/frameworks/full-stack/nextjs)
- [Vercel: storage options](https://vercel.com/docs/storage)
- [Vercel: environment variables](https://vercel.com/docs/environment-variables)
- [Vercel: runtime support](https://vercel.com/docs/functions/runtimes/node-js)
- [Hostinger support](https://www.hostinger.com/support/)
- [Hostinger VPS](https://www.hostinger.com/vps-hosting)
- [Next.js: self-hosting](https://nextjs.org/docs/app/guides/self-hosting)

Live Vercel and Hostinger documentation could not be retrieved from this environment because its outbound policy denied those hosts. These links are reference starting points; current plans, quotas, runtime availability, and pricing must be checked before purchase. The recommendation above follows this application's architecture, not an inspection of a hosting account.
