# Using runsesh on iPhone and iPad

runsesh is a web app. On iPhone and iPad you install it from the browser; there is nothing to
download from the App Store.

## Install
1. Open **https://gemedos.github.io/runsesh/** in **Safari**. (On iOS 16.4 or later, Chrome, Edge
   and Firefox can also add it to the Home Screen.)
2. Tap the **Share** button: the square with an arrow pointing up (at the bottom of the screen on
   iPhone, at the top on iPad).
3. Scroll down and tap **Add to Home Screen**, then tap **Add**.
4. Open runsesh from the new **orange RS icon** on your Home Screen. It opens full screen, like an app.

The app also shows this as a short hint the first time you open it in Safari
(Profile → runsesh on iPhone has the full steps).

## Log in inside the installed app
The installed app keeps **its own login**, separate from Safari. If you created your account or
logged in in Safari, log in once more inside the installed app.

**Emails always open in Safari**, not in the installed app:
- *Confirm your email*: tap the link, then go back to the installed app and log in.
- *Reset your password*: finish setting the new password **in Safari**, then log in inside the
  installed app with the new password.

## Your steps
A web app cannot read Apple Health. You have two options:
- **By hand:** Profile → Health connect → Manual entry.
- **Automatically with an Apple Shortcut** (recommended), set up once:

### 1. Get your Shortcut key
In runsesh: **Profile → runsesh on iPhone → Create Shortcut key**, then **Copy key**.
The key is shown **only once** and works like a password for sending your steps: don't share it
or post screenshots of it. If it leaks or you lose it, tap **Replace key** or **Revoke key**.

### 2. Build the Shortcut
In the **Shortcuts** app, tap **+** and name it "runsesh steps". Add these actions in order:
1. **Find Health Samples**: type *Steps*, *Start Date is Today*. Add the filter *Source is* your
   iPhone (or only your Apple Watch). Without this filter, steps from the phone and the watch are
   counted twice.
2. **Calculate Statistics**: *Sum* of the Health Samples, then **Round Number** to *Ones Place*.
3. **Format Date**: *Current Date*, custom format `yyyy-MM-dd`.
4. **Get Contents of URL**: tap *Copy address* in runsesh and paste it as the URL. Method *POST*.
   Header `Authorization` = `Bearer ` followed by your key (one space after Bearer).
   Request Body *JSON*: `day` (Text) = *Formatted Date*, `steps` (Number) = *Rounded Number*.
5. Tap ▶︎ once and allow access to Health. Your steps appear in Health connect in runsesh.

### 3. Run it every day
**Automation** tab → **+** → *Time of Day* (for example 21:00, Daily) → *Run Immediately* →
*Run Shortcut* "runsesh steps". You can also run it by hand any time.

Limits: up to 30 sends per hour; only today and the last 3 days can be sent.

## Updates
There is no App Store update. When a new version is published you will see
**"An update is available"**: tap **Reload**. If nothing changes, close runsesh completely
(swipe it away in the app switcher) and open it again.

## Uninstall
Touch and hold the runsesh icon, tap **Remove App** (or **Delete Bookmark**), then confirm.
To delete your account and data, see the privacy policy in the app.
