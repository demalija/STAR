# Asteria

A magical, responsive star-dedication experience built with **Next.js 16, React 19, and TypeScript**. Cormorant Garamond and DM Sans are bundled locally, so rendering does not require a font service.

Visitors choose a star, write a personal dedication, and create a shareable gift. Recipients unwrap an animated gift to reveal their dedication certificate, then copy its link or print a keepsake. Gifts can be found by link or gift code. `/gift/demo` provides a sample without creating a record.

## Develop

Node.js 24 and npm 11 were validated in the cloud environment.

```sh
npm ci
npm run dev
```

The app uses port 3000 by default. Set `PORT` to use another port. Run commands from the project root.

```sh
npm run typecheck
npm test
npm run build
npm start
```

`npm test` runs backend tests for persistence, concurrent writes, validation, public data privacy, and gift lookup. `npm start` serves a previously built production application.

## Browser tests

Start the application separately, then run:

```sh
npx playwright test
```

The Playwright configuration uses the installed Chromium at `/usr/bin/chromium`. Override `CHROMIUM_PATH` for another installation and `E2E_BASE_URL` for another running app address. Tests cover API validation, the naming flow, gift unwrapping and sharing, and missing-gift recovery. Browser tests create dedication records in the running app's configured store; use a separate data directory when testing.

## Backend and storage

- `POST /api/stars` validates and creates a dedication; `GET /api/stars/[id]` retrieves one by UUID or gift code.
- Records persist locally in `data/stars.json`, outside version control. Set `STAR_DATA_DIR` to select another directory.
- Writes are serialized within one Node.js process and saved by atomic rename. This is intended for a single application process on a writable, persistent filesystem.
- Email, when supplied, is excluded from public API responses. Gift links and codes provide access to the dedication; treat them as shareable access links.

Production deployment needs a persistent volume. For multiple instances or serverless deployment, replace the JSON store with a managed database. Back up the data directory separately from the source repository.

No external API keys, payment processor, or email delivery service are configured. Creating a dedication does not charge money or send an email. Star names and certificates are symbolic keepsakes: coordinates, constellation assignments, and distances are illustrative, not verified astronomical catalog records or official naming rights.
