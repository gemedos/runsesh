# Sending your steps from an Android phone

runsesh is a web app, and a web app cannot read Health Connect (Android's health data store).
To send your steps automatically, you install a small open-source app that reads Health Connect
and sends your **daily step total** to runsesh.

> **A third-party app is involved.** runsesh does not make this app and cannot control it.
> It is **Life Dashboard Companion** by an independent developer, open source under the MIT
> licence. It reads Health Connect under its own privacy terms. runsesh only receives the daily
> step totals it sends, and ignores everything else.

The whole set-up takes about 10 minutes. Do it **on your Android phone**, with runsesh open in
the phone's browser (Chrome), so you can copy and paste between the two.

## Before you start: Health Connect
- **Android 14 and newer:** Health Connect is built into Android (Settings → search "Health
  Connect"; on Samsung it is under *Security and privacy*). The phone itself only starts counting
  steps into Health Connect **after some app has been granted the Steps permission**, so steps
  count from the moment you connect, not before.
- **Android 13 and older:** install the **Health Connect** app from the Play Store, and you also
  need another app that **writes** steps into it (for example Fitbit, Samsung Health or Google
  Fit). Check in Health Connect → *App permissions* that your step-counting app is allowed to
  write Steps.

## 1. Install the app (pinned version)
We tested version **1.23.0**. Install only from the project's official GitHub release page:
**https://github.com/owen282000/life-dashboard-companion-app/releases/tag/1.23.0**

1. On that page, download **app-release.apk**.
2. Open the downloaded file. Android asks once to allow installs from your browser: allow it,
   then tap **Install**.
3. On the phone the app is called **Life Dashboard**. Open it and answer its setup questions:
   pick **Health Connect**, and **Decide later** for the data types.

Optional check (on a computer): the file's SHA-256 should be
`63e6f7e80055ff80e8fcaf683588e874b74caf525f194c6de28892eea9771825`
(Windows: `certutil -hashfile app-release.apk SHA256`). The release also has a sigstore
signature (`app-release.apk.sigstore.json`).

Do not install newer versions until runsesh says they have been checked: a new version could
change what it sends.

## 2. Create your personal token in runsesh
In runsesh: **Profile → Health connect → Connect my Android phone → Create Android token**.
Tap **Copy**, then **Done**.

- The token works like a password for sending your steps. It is **shown only once**: runsesh
  keeps only a scrambled (hashed) copy. Do not share it, post screenshots of it, or paste it
  anywhere except the app.
- It can only send **your own** daily steps. It cannot read anything or log in.
- You can have at most 2 tokens (for example one Android phone and one iPhone).

## 3. Set up the app
In Life Dashboard, on the **Health** tab:
1. **Data Types:** switch on **only Steps**. Switch everything else off.
2. Tap **Grant** and allow **only Steps** in Health Connect, including **reading in the
   background** (without it, only *Sync Now* works).
3. **Data Resolution:** set Steps to **1 hour**. This keeps every sync small enough for runsesh.
4. **Webhook:** add the address shown in runsesh (*Copy address*):
   `https://qxjeaoxujpyafksxzqak.supabase.co/functions/v1/ingest-steps`
   Remove any other webhook address you added while testing.
5. **Webhook Headers:** add a header with name `Authorization` and, as value, paste what you
   copied in step 2 (it starts with `Bearer `).
6. **Advanced:** keep **Daily totals in payload** ON. Keep **Record metadata in payload** OFF.
   Never switch on **Allow plain HTTP webhooks**.
7. **Sync Schedule:** every 15 to 60 minutes.
8. Tap **Test ping** (it should succeed), then **Save Changes**, then **Sync Now**.

**Battery:** Android may stop background apps to save battery. Go to Android Settings → Apps →
Life Dashboard → Battery and choose **Unrestricted** (or switch off battery optimisation). Some
brands (Xiaomi, Samsung, Huawei, …) have extra settings: see
[dontkillmyapp.com](https://dontkillmyapp.com).

**Do not use Backfill.** runsesh only keeps today and the last 3 days, and a backfill sends far
more than it accepts.

## 4. Check it works
In runsesh, Profile → Health connect:
- your Android token shows **Last received …** with the time of the last sync;
- **Your last 7 days** shows today with the source **Health Connect**;
- today's number should match the Health Connect app (Health Connect → Data → Steps).

## If no steps arrive
- **"No new data" / "0 records" in the app:** nothing new was written to Health Connect since
  the last sync. Walk a little, open your step-counting app (for example Fitbit) so it syncs into
  Health Connect, then tap **Sync Now** again.
- Open the app's **Logs** tab and look at the status for the runsesh address:
  - **401**: the header is wrong. Check the name is `Authorization` and the value starts with
    `Bearer ` followed by the token. If in doubt, revoke the token and create a new one.
  - **413**: the sync was too large. Set Data Resolution for Steps to 1 hour and switch off every
    type except Steps.
  - **429**: more than 20 syncs in one hour. Wait an hour; choose a longer Sync Schedule.
  - **400**: the data was not accepted. Tell the runsesh admin (never send the token).
- Syncs only happen while the phone is on and Android lets the app run in the background, so
  **gaps are possible**. You can always enter steps by hand in runsesh.

## Revoking a token
Lost the phone, shared the token by mistake, or stopped using the app? In runsesh: Profile →
Health connect → your Android token → **Revoke**. It stops working immediately. Create a new
token if you want to connect again. Deleting your runsesh account also deletes all tokens.

To stop the app reading your health data, remove its permissions in Health Connect → App
permissions → Life Dashboard, or uninstall it.
