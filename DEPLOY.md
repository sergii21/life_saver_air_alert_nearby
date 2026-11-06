# Deploy guide: App Store + Google Play

Follow the steps in order. The app has **no server**. Each phone reads the Telegram channels itself, so you only need to publish to the stores and host one privacy-policy page.

Builds run in the cloud on **EAS (Expo Application Services)**. You don't need Xcode or Android Studio, and a Mac is not required.

---

## 0. Accounts you need

| Account | Cost | Link |
|---|---|---|
| Expo account | free | https://expo.dev/signup |
| Google Play Console | $25 once | https://play.google.com/console/signup |
| Apple Developer Program | $99 / year | https://developer.apple.com/programs/enroll |

Install Node.js 20+ on your computer, then:

```bash
npm install
npx eas-cli@latest login
```

---

## 1. Configure the app (5 min)

1. **Telegram channels.** Open `src/config.ts` and set `CHANNELS` to the usernames of your 1–2 public channels (for `https://t.me/my_alerts`, enter `my_alerts`).
   Check that `https://t.me/s/my_alerts` opens in a desktop browser and shows the posts. If it doesn't, the channel can't be read.
2. **App IDs.** In `app.json`, replace `com.yourname.alertnearby` in **both** `ios.bundleIdentifier` and `android.package` with your own ID, for example `com.ivanpetrenko.alertnearby`. You can't change it after the first store upload.
3. **Privacy policy URL.** In `src/config.ts`, set `PRIVACY_POLICY_URL` to the address from step 2.
4. **Districts.** Check the zone centres and keywords in `src/zones/vinnytsia.ts` against real posts from your channels (see `README.md`, section "Tuning zones").
5. Link the project to Expo (this creates the project and writes its ID into `app.json`):

```bash
npx eas-cli@latest init
```

---

## 2. Host the privacy policy (GitHub Pages, free, 2 min)

Both stores require a public privacy-policy URL. The file is already in the repo at `docs/privacy-policy.html`. Put your contact email in it.

1. Push the repo to GitHub.
2. Open the repo → **Settings → Pages** → Source: *Deploy from a branch* → Branch: `main`, folder `/docs` → **Save**.
3. After about a minute the policy is live at `https://<your-github-username>.github.io/<repo-name>/privacy-policy.html`.

---

## 3. Test on a real phone first

**Android.** This produces an APK you can install directly:

```bash
npx eas-cli@latest build --platform android --profile preview
```

Open the link EAS prints on the phone, install the APK, and allow location and notifications. Then tap **"Перевірити сигнал тривоги (тест)"**. You should see the red screen, feel the vibration, and get a notification.

**iPhone.** Use TestFlight (step 5). It's the simplest way and doesn't require registering devices.

---

## 4. Google Play

```bash
npx eas-cli@latest build --platform android --profile production
```

This produces an `.aab` file. Download it from the EAS build page.

1. In Play Console, choose **Create app**. Name: *Тривога Поруч*. Type: App. Price: Free.
2. **Testing → Internal testing → Create release**, then upload the `.aab`. The first upload must be done by hand; Google's API only accepts later ones.
3. Fill in **App content**:
   - Privacy policy: the URL from step 2.
   - **Data safety**: *No data collected or shared*. Location is processed only on the device and never transmitted.
   - Ads: No. Target audience: 18+. Content rating: fill in the questionnaire (no violent content).
   - Location permission: foreground only. No background-location declaration is needed because the app blocks that permission.
4. **Store listing**: short and full description, the 512×512 icon (`assets/icon.png` resized), a 1024×500 feature graphic, and at least 2 phone screenshots (`docs/screenshots/` contains examples).
5. Release: **Internal testing → Closed testing → Production**.
   ⚠️ New *personal* developer accounts must run a **closed test with at least 12 testers for 14 days** before Google allows a production release. Start this early.

**Optional: one-command uploads afterwards.** In Google Cloud, create a service account with Play Console access and download its JSON key to `./google-play-service-account.json` (it is git-ignored). Then:

```bash
npm run build:android && npm run submit:android
```

---

## 5. Apple App Store

```bash
npx eas-cli@latest build --platform ios --profile production
```

The first time, EAS asks for your Apple ID and creates the certificates and provisioning profiles for you. Say "yes" to everything.

```bash
npx eas-cli@latest submit --platform ios --latest
```

This creates the app in App Store Connect (if needed) and uploads the build. After about 10 minutes the build appears in **TestFlight**. Install the TestFlight app on your iPhone and test.

To publish, go to **App Store Connect → your app**:

1. **App Privacy**: choose *Data Not Collected*. Location stays on the device.
2. **App Information**: Category *Utilities* or *Navigation*, plus the privacy policy URL.
3. **Version page**: screenshots (6.9" iPhone is required; take them from the simulator or a phone), description, keywords, support URL (the GitHub repo URL is fine), and the build from TestFlight.
4. **App Review notes**. Paste this, because reviewers are not in Vinnytsia:
   > The app reads public Telegram channels (t.me/s/…) with local alerts for Vinnytsia, Ukraine, and warns the user when their current district is mentioned. Location is processed on-device only. To see the alert outside Ukraine, tap "Перевірити сигнал тривоги (тест)" at the bottom of the main screen. The app is not an official warning system; this is stated in the app.
5. **Submit for Review**. Review usually takes 1–3 days.

After the first release, ship each update with:

```bash
npm run build:ios && npm run submit:ios
```

---

## 6. Releasing updates

1. Change the code or config (for example, new channels in `src/config.ts`).
2. Bump `"version"` in `app.json` (for example `1.0.1`). EAS increments the build numbers automatically.
3. Run `npm run build:android && npm run submit:android` and `npm run build:ios && npm run submit:ios`.
4. In each store console, promote the new build and submit it.

Tip: you can set the channels without editing code by adding an EAS environment variable `EXPO_PUBLIC_TG_CHANNELS=chan1,chan2` (expo.dev → project → Environment variables → production), then rebuild.

---

## Checklist

- [ ] `CHANNELS` set in `src/config.ts`, and `https://t.me/s/<channel>` opens
- [ ] Bundle ID / package name replaced in `app.json`
- [ ] Privacy policy hosted, with its URL in `src/config.ts` and both stores
- [ ] Preview APK tested on a phone (real alert + test alert)
- [ ] Play: internal → closed (12 testers / 14 days) → production
- [ ] iOS: TestFlight tested → review notes pasted → submitted
