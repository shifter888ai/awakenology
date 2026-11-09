# Contact page — Cloudflare setup

This feature keeps submissions within the existing Cloudflare Worker and Cloudflare Email Service. Uploaded files are attached directly to the notification email; they are not stored in R2 or made publicly accessible.

## Required Cloudflare configuration

1. In Cloudflare, onboard `awakenology.org` under **Email Service → Email Sending**. Use the sender address `website@awakenology.org`. Cloudflare will provide the SPF/DKIM and bounce-subdomain DNS records. Review them before applying; this setup is for outbound sending and should not replace the existing mailbox MX records.
2. Verify `contact@awakenology.org` as a destination address. The fixed Worker binding only permits delivery to that address, and the sender is hardcoded as `website@awakenology.org`. This verified-recipient restriction keeps sending eligible on Workers Free and avoids enabling arbitrary recipients.
3. Create a Cloudflare Turnstile widget for the public site hostnames:
   - `awakenology.space`
   - `www.awakenology.space`
   - `awakenology.org`
   - `www.awakenology.org`
   - `strengthofconsciousness.org`
4. Set the Turnstile site key in `Contact/index.html` in place of `__TURNSTILE_SITE_KEY__` (both occurrences).
5. Add the Turnstile secret as a Worker secret named `CONTACT_TURNSTILE_SECRET`.
6. Deploy the Worker after the PR is approved and merged.

## Submission behavior

- Messages are emailed to `contact@awakenology.org`.
- File submissions are emailed as attachments to the same address.
- Maximum uploaded file size is 15 MB. This relies on the verified destination address, which has Cloudflare Email Service's 25 MiB total-message limit; the general unverified-recipient limit is 5 MiB.
- Accepted file extensions: PDF, Office documents, text/Markdown, CSV, common images, and ZIP.
- Files are not retained by the website.
- Visitor email is used as `Reply-To`; it is never used as the sender address.
- Both forms require a successful Cloudflare Turnstile verification.
