# GeistM Adnet for Epistery

`@geistm/adnet-epistery` — the Adnet campaign builder as an epistery console
session kind (`adnet`). What Adnet is, and why, is on its own About page:
<https://adnet.geistm.com/about>. This README covers the code.

It is the port of the epistery-host agent
[blackfire-agent](https://github.com/GeistM-Engineering/blackfire-agent): the same
campaigns, links, headlines, deploy, settle and report, with the same component
structure — carried from a domain-hosted agent into an encrypted session.

## The advertiser is the session's identity

On a host, blackfire's advertiser was the domain and its wallet. Here it is the
session's **owner identity** — a contract. It is each campaign contract's
advertiser: campaigns are **staked from the identity's treasury**, and withdrawals
return there. A contract cannot sign; its signers can. So every act that speaks or
pays for the advertiser is signed by a member, in that member's browser:

| Act | Signed how | Who may |
| --- | --- | --- |
| Deploy, enable/disable, settle | A fresh `Epistery Auth <ms>` signature on the factory call | A signer of the identity, or an admin of this session |
| Stake, add budget | `identity.sendETH(campaign, amount)` — the identity pays, the device pays gas | A signer of the identity |
| Withdraw | `identity.executeTransaction(campaign, 0, withdrawBudget())` | A signer of the identity |

The factory checks on chain that the signer acts for the advertiser (`actsFor` in
adnet-factory). Deploy does not fund: the factory deploys the contract unfunded and
names the stake, and the campaign shows **Unfunded** until a signer stakes it.

## No one in the middle

The server holds no key, no wallet and no money, and writes nothing. It lists the
session's sealed records and composes Files. Everything else happens on the
member's device: records are sealed under the session key K and written
rivet-signed to the relay, the factory is called directly, and payments are the
member's own transactions. A bot in an adnet session is only ever a member someone
chose to add — nothing here assigns one.

## What a session holds

Every record is `{id, epoch, iv, ciphertext}`. There is no plaintext branch.

| File | Is |
| --- | --- |
| `campaign-<id>.json` | a campaign — draft, or deployed with its contract and the payments made |
| `link-<id>.json` | a destination link and its shortcode |
| `headline-<id>.json` | a headline |
| `creative-<entryId>.json` | the public URL an image was published at |
| `entry-<id>.json` | an image — the composed `files` plugin's own record |

A campaign keeps each payment's transaction hash; the contract is the truth, read
through the factory's report.

## Creatives

Images live in the session's Files (**Art**), encrypted. An ad must render for
strangers and the factory takes a creative only as a URL, so **deploying
publishes**: the deploying member's device opens each chosen image with K and
uploads the plaintext once to the relay under the owner's contract — write-once,
immutable. The URL is remembered, so a second campaign using the same image names
the same URL. The encrypted original stays where it was.

## What it composes

Files is `compose('files')` — the files plugin verbatim at `/entries…`, asked for by
kind, so it stays in `@epistery/plugins` while this package lives here. Its client
is embedded as the **Art** page, the way the data room embeds its Docs.

## Layout

```
adnet/
  index.mjs        manifest, the read-only router, mcpWriteTransform
  epistery.json    MCP tools
  client/
    mount.mjs      draws Main
    records.mjs    seal / open / write the session's records (this device)
    factory.mjs    the Adnet factory, called from the browser
    creatives.mjs  publish an image at deploy
    signer.mjs     this device's signatures: factory auth, treasury payments
    util.mjs, adnet.css
    components/    Main, PageMenu, PageFooter, Status, Campaigns, CampaignProps,
                   CampaignReport, ImagePicker, HeadlinePicker, LinkPicker,
                   AttributesEditor, Headlines, Links, NewLink, LinkProps,
                   FilesPane, Settings, and the Button / InputText / InputSelect
                   widgets (trimmed from @metric-im/common-mixin)
```

Components extend the console's componentry (`/lib/componentry.mjs`) and own their
css. They are served from this plugin's root, not pooled into the console's
`/components` namespace. Navigation is in memory (the console owns the URL hash);
the page menu sits in the console's context panel.

Settings (admins) are session params — the Adnet factory URL and the Art folder the
image picker shows — written by the admin's device (`ctx.ui.saveParams`). Members
and roles are the session's own, managed in the console's session settings.

## MCP tools

`list_campaigns`, `list_links`, `list_headlines`, and `create_campaign`,
`create_link`, `create_headline` for drafts — sealed under the agent's own key by
`mcpWriteTransform`. Deploying, settling and paying are not tools: each needs a
signer's own signature.

## Develop and install

The server imports only `express` (a peer), so the package links cleanly for
editing in place:

```
cd console && npm i ../../geistm/adnet-epistery
```

For deployment, from github:

```
npm i github:GeistM-Engineering/adnet-epistery
```

Either way, name it in the console's config:

```ini
[plugins]
packages = @epistery/plugins, @epistery/pinapp, @geistm/adnet-epistery
```

Requires the console's `callFromContract` (console/client/epistery.mjs) and an
adnet-factory with contract-advertiser support (`actsFor`).

## Status

v0. Verified: loads linked through the console's registry and mounts under the
console's express; the router refuses plaintext and, on the browser path, any
write; the whole client flow in jsdom with real sealing — create, pick, deploy
(creative published, factory called with the signer's auth), stake, withdraw,
status — with only ciphertext at rest. The factory's `actsFor` was checked live
against a mainnet identity.

Not yet exercised: a real session in a browser, and a live deploy through a factory
running `actsFor`.
