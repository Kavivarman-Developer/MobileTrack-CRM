# Google Auth Render Diagnostic Report

## Summary

The deployed Google auth route is not missing from git or `origin/main`.

`origin/main` contains:

```js
router.post("/google", googleLogin);
```

The tested production URL was:

```text
GET https://mobiletrack-crm.onrender.com/api/auth/google
```

But the backend only registers:

```text
POST /api/auth/google
```

So a browser/opened URL or any `GET` request to `/api/auth/google` is expected to return:

```json
{"message":"Route not found: /api/auth/google"}
```

## 1. Git Tracking

Command:

```powershell
git log --oneline --all -- backend/routes/authRoutes.js
```

Output:

```text
1be9564 update latest version app
5a75acc Initial commit - MobileTrack CRM
```

Command:

```powershell
git log --oneline --all -- backend/controllers/authController.js
```

Output:

```text
0ecd09a google auth created
1be9564 update latest version app
5a75acc Initial commit - MobileTrack CRM
```

Conclusion:

Both files are tracked in git history.

Command:

```powershell
git show HEAD --stat -- backend/routes/authRoutes.js backend/controllers/authController.js
```

Output:

```text
<no output>
```

Conclusion:

The current `HEAD` commit did not modify either file. This does not mean the files are untracked; the earlier `git log` commands prove they are tracked.

## 2. Git Ignore Check

Command:

```powershell
git check-ignore -v backend/routes/authRoutes.js
git check-ignore -v backend/controllers/authController.js
```

Output:

```text
<no output for either file>
```

Conclusion:

Neither file is excluded by `.gitignore`.

Root `.gitignore` contents:

```text
node_modules/
*.log
.env
.expo/
dist/
build/
```

No `backend/.gitignore` exists.

Conclusion:

There is no ignore rule excluding `backend/routes` or `backend/controllers`.

## 3. Local vs Origin/Main

Command:

```powershell
git diff origin/main main -- backend/routes/authRoutes.js backend/controllers/authController.js
```

Output:

```text
<no output>
```

Conclusion:

Local `main` and `origin/main` match for both auth files.

Command:

```powershell
git ls-tree -r origin/main --name-only | findstr authRoutes
```

Output:

```text
backend/routes/authRoutes.js
```

Command:

```powershell
git ls-tree -r origin/main --name-only | findstr authController
```

Output:

```text
backend/controllers/authController.js
```

`origin/main:backend/routes/authRoutes.js` contains:

```js
router.post("/register", register);
router.post("/login", login);
router.post("/google", googleLogin);
```

Conclusion:

GitHub remote branch `origin/main` contains the Google auth route.

## 4. Server Entrypoint / Start Command

`backend/package.json`:

```json
{
  "main": "server.js",
  "scripts": {
    "dev": "nodemon server.js",
    "start": "node server.js"
  }
}
```

Conclusion:

The backend start command points to `server.js`.

`backend/server.js` contains:

```js
const app = express();
app.use("/api/auth", require("./routes/authRoutes"));
server.listen(port, host, () => console.log(`API running on http://${host}:${port}`));
```

Search result:

```text
backend\server.js:10:const app = express();
backend\server.js:21:app.use("/api/auth", require("./routes/authRoutes"));
backend\server.js:44:server.listen(...)
```

Conclusion:

No duplicate Express server entrypoint was found in the tracked backend source.

## 5. Procfile / Render Config

Checked repo root for:

```text
Procfile
render.yaml
render.yml
```

Output:

```text
<none found>
```

Conclusion:

There is no repo-level Procfile or Render YAML overriding the backend start command.

Render should be using the service dashboard settings. Based on `backend/package.json`, the correct Render configuration should be:

```text
Root Directory: backend
Start Command: npm start
```

or:

```text
Root Directory: backend
Start Command: node server.js
```

## 6. Duplicate Folder / Stale Copy Check

Command:

```powershell
Get-ChildItem -Directory -Recurse -Path . -Filter backend
```

Output:

```text
C:\Users\kaviv\OneDrive\Desktop\Mobile Application\backend
```

Command:

```powershell
git ls-tree -r origin/main --name-only | findstr /i "routes/authRoutes.js controllers/authController.js"
```

Output:

```text
backend/controllers/authController.js
backend/routes/authRoutes.js
```

Conclusion:

There is no `backend/backend` duplicate folder and no second copy of `authRoutes.js` or `authController.js` in `origin/main`.

## 7. Runtime Confirmation Added

Added a temporary log line to:

```text
backend/routes/authRoutes.js
```

Current local diff:

```diff
 router.post("/register", register);
 router.post("/login", login);
 router.post("/google", googleLogin);
 
+console.log(
+  "authRoutes loaded, routes:",
+  router.stack.map((layer) => `${Object.keys(layer.route?.methods || {}).join(",").toUpperCase()} ${layer.route?.path}`)
+);
+
 module.exports = router;
```

After this is committed and pushed, Render logs should show:

```text
authRoutes loaded, routes: [ 'POST /register', 'POST /login', 'POST /google' ]
```

That proves the deployed service loaded the route file that contains Google auth.

## Root Cause

The direct production check used the wrong HTTP method.

This URL was checked with `GET`:

```text
https://mobiletrack-crm.onrender.com/api/auth/google
```

But the backend route is registered only as:

```text
POST /api/auth/google
```

Express does not match `GET /api/auth/google` to a `POST /api/auth/google` route, so it falls through to the `notFound` middleware and returns:

```json
{"message":"Route not found: /api/auth/google"}
```

## Exact Fix

No backend route fix is required for the 404 shown by the `GET` test.

Use `POST` when testing Google login:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "https://mobiletrack-crm.onrender.com/api/auth/google" `
  -ContentType "application/json" `
  -Body '{"idToken":"YOUR_GOOGLE_ID_TOKEN"}'
```

Expected results:

- If the route exists but token is fake or missing: `400`, `401`, or Google token verification error.
- If the route does not exist: `404 Route not found`.
- If the token is valid and Google env vars are configured: login/register response with tokens.

## What To Run Next

Check local git status:

```powershell
git status
```

Commit and push the temporary runtime log:

```powershell
git add backend/routes/authRoutes.js google-auth-render-diagnostic-report.md
git commit -m "Add Google auth Render diagnostic log"
git push origin main
```

Then check Render logs for:

```text
authRoutes loaded, routes: [ 'POST /register', 'POST /login', 'POST /google' ]
```

Finally, re-check the route with `POST`, not `GET`:

```powershell
Invoke-RestMethod `
  -Method POST `
  -Uri "https://mobiletrack-crm.onrender.com/api/auth/google" `
  -ContentType "application/json" `
  -Body '{"idToken":"YOUR_GOOGLE_ID_TOKEN"}'
```

After Render confirmation, remove the temporary `console.log` from `backend/routes/authRoutes.js`.
