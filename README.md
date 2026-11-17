# moai

Online shop for MOAI Gallery, a small Iranian brand of beach towels, ponchos and natural-fibre textiles. Persian, right-to-left, with a full admin panel so the shop owner can run it without a developer.

Built from July to October 2026 as a freelance project for the client, and later used as the starting template for another shop site. Published in 2026 as a code sample. The live database, uploaded photos, payment credentials and the owner's contact details are not included.

## What it does

- Storefront: animated home page (GSAP ScrollTrigger), category tree, product pages with per-size prices and stock, size guide with a size estimator, cart, checkout, order tracking, members club with points and tiers.
- Login by one-time SMS code (no passwords for customers).
- Payments: Saman (SEP) card gateway, card-to-card transfer (the buyer sends the receipt on WhatsApp and staff confirm it), and two instalment gateways (SnappPay, Digipay). The server re-computes every price; a gateway callback is never trusted for the amount and is verified with the bank before an order is fulfilled.
- Admin: products and sizes, bulk price changes, categories, discount campaigns and coupons, banners, home page curation, orders, payment log, weekly visitor statistics, members.
- Operations: online SQLite backup with `VACUUM INTO` and a restore script, Telegram order alerts.

## Architecture

```
browser ── Next.js 16 app (App Router, server components and server actions)
              |-- src/app/(site)    storefront pages
              |-- src/app/admin     admin panel
              |-- src/app/api       auth (OTP), payment start and callbacks, uploads, visit tracking
              |-- src/lib           pricing, stock, coupons, club, gateways (sep, snapppay, digipay), SMS
              |
           Prisma 6 ── SQLite (single file, backed up online)
```

## Stack

Next.js 16, React 19, TypeScript, Tailwind CSS 4, GSAP, Prisma 6 with SQLite, sharp for image processing, plain Node scripts for end-to-end checks. Fonts are Vazirmatn, Markazi Text and Gulzar (SIL Open Font License).

## My role

I built this for the client as a freelance project: requirements with the shop owner, architecture, implementation (including the payment gateway integrations), deployment and handover. Much of the code was written with AI coding assistants working under my direction.

## Run it locally

Requirements: Node 22 or newer.

```bash
npm install
cp .env.example .env      # set SESSION_SECRET; keep OTP_DEV_ECHO=1 and SEP_SANDBOX=1 for local use
npx prisma db push        # creates prisma/dev.db
npm run seed              # sample categories, products, a demo admin and two demo customers
npm run dev:raw           # http://localhost:3000
```

Log in at `/login` with the seeded admin number `09121230000`; with `OTP_DEV_ECHO=1` the code is shown on the page. (`npm run dev` wraps the dev server in a PowerShell guard script, so it is Windows only.)

## Tests

The checks in `tools/` are Node scripts that drive a running server (`npx next build && npx next start`, then for example `npm run test:payment`, `npm run test:shop`, `npm run test:size`). They cover payment amount checks, replayed callbacks, coupons, stock and per-size pricing. There is no unit test framework.

## What is not finished

- `npm run test:all` also calls `tools/colortest.mjs` and `tools/digipaytest.mjs`, which are not in the repository, so that script fails at the end. Run the individual `test:*` scripts instead.
- The marketing photos used by the live site are not included because their source and licence are not recorded. The `.jpg` files in `public/images/` with the same names are plain colour placeholders so the pages still render; logos and payment-provider marks are kept. The product catalogue itself is not included.
- No automated CI.

## Licence

No licence is granted. The code was written for a client; it is published as a work sample only.
