# Lemz Jamz shared music library — Cloudflare Worker

This package uses Cloudflare’s current **Worker with Static Assets** deployment route. Everyone can stream and download uploaded tracks. Only a person who knows the uploader password can add tracks.

## Deploy from your GitHub repository

The repository must contain `index.html`, `_headers`, `worker.js`, `wrangler.jsonc`, and the `functions` folder at its top level.

1. In Cloudflare, go to **Workers & Pages** → **Create application** → **Import a repository** (the wording may say **Worker** in the new dashboard).
2. Choose the GitHub repository containing this package.
3. Keep the deploy command as:
   ```bash
   npx wrangler deploy
   ```
   Do not use `wrangler pages deploy` in this new Worker workflow.
4. Deploy. The `wrangler.jsonc` file tells Cloudflare to publish the site files as static assets and sends `/api/*` requests to the music service.

## Storage and upload password

After the first deployment, open the deployed Worker → **Settings** → **Bindings**.

1. Under **R2 bucket bindings**, add:
   - Variable name: `MUSIC`
   - Bucket: `lemz-jamz-music`

   Create the `lemz-jamz-music` R2 bucket first in **R2 Object Storage** if it does not exist.

2. Under **Variables and Secrets**, add an **encrypted** secret:
   - Variable name: `UPLOAD_TOKEN`
   - Value: a long private password that only you know.

3. Save both settings and **redeploy** the Worker.

> The configuration already declares the `MUSIC` binding. If Cloudflare says it is already connected after deployment, leave it as-is; only add it in the dashboard if it is missing.

## Uploading a track

1. Open the live site and choose or create an album.
2. Add audio files, select the album, then choose **Upload to Album**.
3. When asked for the uploader password, enter the exact `UPLOAD_TOKEN` value.
4. Once confirmed, files are shared: every visitor can play them or use the ⇩ button to download.

## Notes

- Accepted uploads are audio files up to 100 MB each.
- The upload password is never included in the site files.
- Tracks from the old browser-only site need to be added again once to become shared.
