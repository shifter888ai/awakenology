# Contact page — Cloudflare Free-plan setup

This feature uses the existing Cloudflare Worker and Email Routing. It does not require Workers Paid, a third-party email provider, R2, or public file storage.

## Email requirements

1. Keep `contact@awakenology.org` verified under **Compute → Email Service → Email Routing → Destination Addresses**. Verified destination addresses can receive Worker-sent email free of charge on Workers Free.
2. The sender must belong to a domain configured for Cloudflare Email Routing. Confirm that Email Routing is already enabled for `awakenology.org` before testing the form. Do not enable Email Sending domain onboarding or change DNS/MX records as part of this setup.
3. The Worker binding in `wrangler.jsonc` restricts delivery to `contact@awakenology.org`; the Worker uses `website@awakenology.org` as the sender and the visitor's address only as Reply-To.
4. If `awakenology.org` is not already an Email Routing domain, stop and review the existing AOL/mail routing configuration before making any DNS changes. Do not replace or alter existing MX records without explicit approval.

## Turnstile requirements

1. Create a Cloudflare Turnstile widget for these public hostnames:
   - `awakenology.space`
   - `www.awakenology.space`
   - `awakenology.org`
   - `www.awakenology.org`
   - `strengthofconsciousness.org`
2. Replace both `__TURNSTILE_SITE_KEY__` placeholders in `Contact/index.html` with the widget's site key.
3. Add the widget's secret as a Worker secret named `CONTACT_TURNSTILE_SECRET`.

## Submission behavior

- Messages are sent to the verified `contact@awakenology.org` destination.
- File submissions are sent as email attachments to the same address.
- Maximum uploaded file size is 15 MB.
- Accepted file extensions: PDF, Office documents, text/Markdown, CSV, common images, and ZIP.
- Files are not retained by the website and are not placed in R2.
- Visitor email is used only as `Reply-To`; it is never used as the sender address.
- Both forms require successful Cloudflare Turnstile verification.

## Activation

Do not upgrade the Workers plan. Do not deploy until the domain's existing Email Routing configuration and the Turnstile settings have been confirmed. Then test a message and a small file attachment on the live site.
