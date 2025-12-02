# Running Local Community Solid Server with ACP

## Setup

The project is configured to run a local Community Solid Server (CSS) with ACP (Access Control Policy) enabled.

## Configuration

- **Config file**: `.cssconfig.json` - Has ACP enabled via `css:config/ldp/authorization/acp.json`
- **Seed config**: `seed-config.json` - Contains your account credentials (create from `seed-config.json.example`)
- **Data directory**: `data/` - Where the server stores pod data

### Setting up your account

1. Copy the example seed config:
   ```bash
   cp seed-config.json.example seed-config.json
   ```

2. Edit `seed-config.json` and replace with your real email, password, and pod name:
   ```json
   [
     {
       "email": "your-email@example.com",
       "password": "your-password",
       "pods": [
         { "name": "your-pod-name" }
       ]
     }
   ]
   ```

**Note**: `seed-config.json` is in `.gitignore` to prevent committing your password.

## Running the Server

### Option 1: Run CSS only
```bash
npm run start:css
```

This will start CSS on port **3000** with:
- ACP authorization enabled
- Seeded accounts (alice and bob)
- Data stored in `data/` directory

### Option 2: Run CSS + Next.js together
```bash
npm run start:dev
```

This runs both:
- CSS on port **3000**
- Next.js dev server on port **3001**

## Test Accounts

After seeding, you can log in with any of these accounts:

1. **Ruky** (your account):
   - Email: `rukyjacob@gmail.com`
   - Password: `Test123$`
   - Pod URL: `http://localhost:3000/ruky/`
   - WebID: `http://localhost:3000/ruky/profile/card#me`

2. **Alice**:
   - Email: `alice@example.com`
   - Password: `alice123`
   - Pod URL: `http://localhost:3000/alice/`
   - WebID: `http://localhost:3000/alice/profile/card#me`

3. **Bob**:
   - Email: `bob@example.com`
   - Password: `bob123`
   - Pod URL: `http://localhost:3000/bob/`
   - WebID: `http://localhost:3000/bob/profile/card#me`

4. **Charlie**:
   - Email: `charlie@example.com`
   - Password: `charlie123`
   - Pod URL: `http://localhost:3000/charlie/`
   - WebID: `http://localhost:3000/charlie/profile/card#me`

## Testing ACP Sharing

The seed config includes 4 test accounts (ruky, alice, bob, charlie) for testing sharing.

**Steps to test:**
1. Start the server: `npm run start:css`
2. In your Next.js app (port 3001), log in as **ruky** (`rukyjacob@gmail.com` / `Test123$`)
3. Navigate to ruky's pod storage
4. Create a folder or file
5. Click "Share" on the resource
6. Add a WebID to share with (e.g., `http://localhost:3000/alice/profile/card#me`)
7. Select access level (Editor/Viewer) and click "Done"

**Quick WebIDs for sharing:**
- Alice: `http://localhost:3000/alice/profile/card#me`
- Bob: `http://localhost:3000/bob/profile/card#me`
- Charlie: `http://localhost:3000/charlie/profile/card#me`

## Notes

- The server uses ACP (not WAC), so ACRs should be at `.acr` location
- Make sure to use `http://localhost:3000` as the OIDC issuer in your app
- The server will create pods automatically when accounts are seeded

