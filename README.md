# Cin7 Core MCP

A Claude Desktop extension that lets you ask Claude about stock levels and purchase orders in your Cin7 Core account.

It is read-only. The server sends only `GET` requests to the Cin7 Core API, so it reads your data and leaves it unchanged.

## What you can ask

| Tool | Answers |
|:--|:--|
| `get_stock_levels` | How many of a product are in stock, where, and how many are on order |
| `list_purchases` | What purchase orders exist, from which supplier, and when they are due |
| `get_purchase` | What is on one purchase order and what has arrived |

Example prompts:

- "How many of SKU ABC-123 do we have, and where?"
- "Which purchase orders are in status ORDERED?"
- "Show me purchase order PO-00123."

## Install in Claude Desktop

You need:

- [Claude Desktop](https://claude.ai/download) on macOS or Windows
- A Cin7 Core login with the "Settings: Cin7 Core API Setup" permission

### 1. Get your Cin7 Core credentials

The extension asks for two values when you install it: an **Account ID** and an **API Application Key**. You create both inside Cin7 Core.

1. Log in to Cin7 Core and open **Integrations**, then **API**. You can also go straight to <https://inventory.dearsystems.com/ExternalAPI>.
2. On the API Integration page, click the **+** icon at the top right.
3. Enter a name such as "Claude" and click **Create**.
4. Open the **Setup** tab. It shows the **Account ID** and the **Key**. Keep this page open so you can copy both in step 3.

Good to know:

- Your Cin7 Core user needs the **Settings: Cin7 Core API Setup** permission to create keys. If the API page is missing, ask your Cin7 Core administrator for that permission.
- Create a separate API application for Claude. Cin7 Core's limit of 60 requests per minute applies to each application, so Claude gets its own allowance.
- Cin7 Core's standard plan includes two external integrations. If your account already uses two, you may need to add a licence under **My Subscription** first.
- Treat the Account ID and Key like a login and password. Paste them only into the extension's install screen.

These steps follow Cin7's help articles [Connecting to the Cin7 Core API](https://help.core.cin7.com/hc/en-us/articles/9982480315407-Connecting-to-the-Cin7-Core-API) and [Zapier Integration](https://help.core.cin7.com/hc/en-us/articles/9034605212175-Zapier-Integration).

### 2. Download the extension

[Download cin7-core.mcpb](https://github.com/ebragas/cin7-mcp/releases/latest/download/cin7-core.mcpb). This link always gives you the newest version.

### 3. Install it

1. Update Claude Desktop to the latest version and restart it.
2. Open **Settings**, then **Extensions**, then **Advanced settings**.
3. Click **Install Extension** and choose the `.mcpb` file you downloaded.
4. Claude Desktop shows a notice that the extension is unsigned. Continue.
5. Paste the **Account ID** and the **Key** from Cin7 Core, then finish the install.

Claude Desktop stores both keys in your operating system's secure storage (Keychain on macOS, Credential Manager on Windows).

### 4. Try it

Start a new chat and ask:

> What stock do we have?

Claude asks for permission the first time it uses a tool. Approve it, and the answer comes from your Cin7 Core account.

## Install for a whole team (Claude Team or Enterprise)

On a Team or Enterprise plan, an Owner or Primary Owner can upload the extension once so members install it from inside Claude Desktop. These steps follow Anthropic's guide, [Enabling and using the desktop extension allowlist](https://support.claude.com/en/articles/12592343-enabling-and-using-the-desktop-extension-allowlist).

### Upload the extension

1. [Download cin7-core.mcpb](https://github.com/ebragas/cin7-mcp/releases/latest/download/cin7-core.mcpb).
2. Open Claude Desktop and click your initials or name in the lower left corner.
3. Open **Organization settings**, then **Connectors**, and switch to the **Desktop** tab.
4. Click **Add custom extension** and choose the `.mcpb` file. It appears under **Custom team extensions**.
5. Click **...** next to it, then **Add to team**. This adds it to your allowlist and enables it for your team.

Members then install it from the extension list in Claude Desktop and paste the Cin7 Core Account ID and Key when asked. See [Get your Cin7 Core credentials](#1-get-your-cin7-core-credentials).

### Before you turn on the allowlist

The allowlist is off by default, and the **Allowlist** toggle sits on the same **Desktop** tab. Read Anthropic's guide before switching it on, because it changes what everyone in the organization can use:

- Desktop extensions that members already installed are removed from their Claude Desktop.
- Members can install only the extensions on the allowlist, and only from the in-app list.
- Members need Claude Desktop 0.13.91 or later.

### Update the team's version

1. Download the newest `cin7-core.mcpb` from the same link.
2. On the **Desktop** tab, open the **...** menu next to the extension and choose **Upload new version**.
3. Choose the new file.

Claude Desktop accepts the upload when the new file has a higher version number and the same name, which every release of this extension does.

## Troubleshooting

| What you see | What to do |
|:--|:--|
| "Cin7 rejected the credentials" | Open the extension's settings in Claude Desktop and paste the Account ID and Key again. Check for stray spaces. |
| "Cin7's rate limit was reached" | Wait a minute and ask again. Cin7 Core allows 60 requests per minute. |
| The tools are missing from the chat | Check that the extension is enabled under Settings, Extensions, then restart Claude Desktop. |
| Nothing happens when you choose the file | Update Claude Desktop, then try double-clicking the `.mcpb` file. |
| A product is missing from stock results | Cin7 Core may leave out products that have no stock record. |

## Update

Download the file again from the link in step 2 and install it the same way. Privately shared extensions update when you install the newer file.

## Status

This is an early version.

- Tested: the automated test suite, install and key delivery in Claude Desktop on macOS using a test build, and the response to incorrect keys against the live Cin7 Core API.
- Still to be tested: results from a live Cin7 Core account with valid keys, and installation on Windows.

## Build from source

Requires Node.js 20 or later.

```sh
npm install
npm test
npm run pack
```

`npm run pack` builds the server into a single file and writes `cin7-core.mcpb` to the project root.

To run the server during development, add it to `claude_desktop_config.json` with `CIN7_ACCOUNT_ID` and `CIN7_APPLICATION_KEY` set in its `env`, pointing `node` at `bundle/server/index.js`.

## Releasing

Every push to `main` runs the typecheck and tests, builds the bundle, and saves it as a workflow artifact. A GitHub release is published when the version has no release yet.

To cut a release, set the new version in `package.json`, `bundle/manifest.json` and `src/index.ts`, then push to `main`. The build fails when the three disagree.
