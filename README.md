# 🌸 GentleGlow - Mental Health & Support Discord Bot

GentleGlow is a comprehensive mental health companion Discord bot designed to create a safe, supportive space for community check-ins, routine tracking, mindfulness, and private support routing.

It provides:
- **Public & Private Check-Ins**: Users react to the daily mood board or check in privately using ephemeral menus.
- **Mindfulness Coping Tools**: Visual animated box breathing (`/breathe`), grounding prompts, and calm-down exercises.
- **Healthy Routine Builder**: Create morning, evening, work, or recovery routine checklists (`/routine`).
- **Private Journaling & Mood Charting**: Submit private reflections (`/journal`) and view unicode mood progress history (`/mood-history`).
- **Buddy Matching System**: Consent-based matching pool for mutual check-ins (`/buddy`).
- **Interactive Plants & Pets**: Nurture a virtual plant (`/plant`) and adopt, name, and raise a companion pet (`/pet`) showing ASCII drawings and pictures.
- **Daily Channel Affirmations**: Delivers positive affirmations once daily to a designated server channel.
- **Crisis Safeguards**: Automated high-risk message monitoring that alerts moderators and sends resource guides to users in need quietly.

> ⚠️ **IMPORTANT SAFETY & CLINICAL DISCLAIMER**
> **GentleGlow is a self-care support bot designed for mindfulness exercises and habit tracking. It is NOT a licensed therapist, clinical provider, or emergency service, and does NOT replace professional medical or mental health care.** If you or someone you know is in crisis or needs urgent professional help, please contact emergency services (like 911 or your local equivalent) or run the `/crisis` command immediately for national hotline resources.

---

## 🛠️ Prerequisites
- **Node.js** (v16.9.0 or higher)
- **NPM** (comes with Node.js)
- A Discord server where you have Administrator permissions.

---

## 🚀 Setup Instructions

### 1. Discord Developer Portal Setup
1. Go to the [Discord Developer Portal](https://discord.com/developers/applications).
2. Click **New Application** and name it `GentleGlow`.
3. In the left sidebar, click **Bot**, then click **Add Bot** (if prompted).
4. Scroll to the **Privileged Gateway Intents** section:
   - Turn **ON** the **Message Content Intent** toggle (required for keyword safety scanning).
   - Turn **ON** the **Server Members Intent** toggle (recommended for matching and user lookups).
   - Click **Save Changes**.
5. Scroll up and click **Reset Token**, then copy the generated bot token. Keep this token private!

### 2. Configure Environment Variables
1. Rename/copy `.env.example` to `.env` in the bot's root directory:
   ```bash
   cp .env.example .env
   ```
2. Open `.env` in a text editor and fill in:
   - `DISCORD_TOKEN`: Your copied Bot Token.
   - `CLIENT_ID`: Your **Application ID** (from the General Information tab).
   - `GUILD_ID` (Recommended for testing): Your test server ID (enables instant command updates).

### 3. Invite the Bot
1. In the Developer Portal, go to **OAuth2 ➔ URL Generator**.
2. Select scopes: `bot` and `applications.commands`.
3. Select Bot Permissions: `View Channel`, `Send Messages`, `Manage Messages`, `Read Message History`.
4. Copy the generated link at the bottom, paste it into your browser, and authorize it for your server.

---

## ⚙️ Running the Bot

1. Open your terminal in the `gentleglow_bot` folder and install dependencies:
   ```powershell
   npm install
   ```
2. Register the slash commands (runs `register-commands.js`):
   ```powershell
   npm run register
   ```
3. Start the bot:
   ```powershell
   npm start
   ```

---

## 📝 Admin Setup Commands

Before users can use support or check-in features, server administrators should configure target channels:

1. **Set the private Moderator alerts channel**:
   ```discord
   /set-admin-channel channel:#your-moderator-logs
   ```
   *Support requests and flagged crisis alerts will be routed here.*
2. **Set the public check-in board channel**:
   ```discord
   /set-checkin-channel channel:#daily-checkins
   ```
3. **Set the daily channel affirmation channel (Optional)**:
   ```discord
   /set-affirmation-channel channel:#morning-motivation
   ```
4. **Set the daily self-care tip channel (Optional)**:
   ```discord
   /set-selfcare-channel channel:#daily-selfcare-tips
   ```
5. **Post the check-in board**:
   ```discord
   /checkin-setup
   ```

---

## 🔒 Privacy & Safety Features

- **No Public Labeling**: Flags or alerts are sent strictly to moderators privately. EPhemeral check-in feedback is only visible to the user.
- **Double Confirmation**: Clicking "Need Support" triggers a private DM asking for confirmation before staff are alerted.

- **No Streak Shame**: Plant growth or affirmation schedules have no streak-breaking messages or guilt warnings. You can start again whenever you are ready.
