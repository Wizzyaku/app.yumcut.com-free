# Email Writing Instructions

These rules are mandatory for all email templates in `email/en` and `email/ru`.

## Voice and Sender

- Write emails as a personal note from `Igor`.
- Do not write from `team`, `support team`, or any generic company voice.
- Keep the tone human, direct, and natural, like a real short message written right now.

## Style Consistency

- Study the current email templates first.
- Follow the existing style and structure already used in this repo.
- Do not invent a new tone, new format, or new writing style unless explicitly requested.

## Quality Bar

- Be clear and concise.
- Prefer short sentences and simple words.
- Keep each email focused on one action.
- Avoid marketing fluff, robotic text, and generic AI-style phrasing.

## Practical Rules

- Keep placeholder usage consistent (`{{name}}`, `{{bonus_tokens}}`, etc.).
- Keep English and Russian versions aligned in intent.
- Keep wording natural for each language, not literal machine translation.

## Technical Delivery Guardrails

- Do not change `Reply-To` addressing format without updating tests in `tests/server/planned-emails.test.ts`.
- `Reply-To` must always be a valid email address in `email@example.com` format.
- Keep the local part (before `@`) at 64 characters or less (RFC limit).
- If aliasing is used in `Reply-To`, prefer short prefixes to avoid breaching local-part length.
- Treat any provider error containing `Invalid \`reply_to\` field` as a release-blocking regression.
