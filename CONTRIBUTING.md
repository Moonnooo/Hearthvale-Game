# Contributing to Hearthvale

Use a fork or feature branch and open a pull request against `main`. Include a
short explanation and screenshots for visual changes. Keep changes focused.
Work against a local server and database; contributors do not need VPS access.

## Game and editor

Both applications share `client/project.godot`. `scripts/bootstrap.gd` chooses
the game or World Studio. Server code in `backend/server/` checks all gameplay
and publishing permissions. Do not put privileged server operations in client
code or rely on hiding editor controls as authorization.

Run `npm test` and check your changes in Godot. Rebuild GPU textures after model
changes using the command in the README. Use Git LFS for source binary assets.
Generated texture caches and builds stay outside Git.

## Map contributions

1. Start your local server and sign into World Studio using a local account.
2. Edit and save your local draft. Check it in the 3D preview.
3. Export geometry without account data:

   ```sh
   npm run world:export -- backend/data/world.sqlite YOUR_LOCAL_USERNAME world/proposal.json
   npm run world:check -- world/proposal.json
   ```

4. Submit the world JSON and preview screenshots in a pull request. Describe
   the region, entrances, resources, NPC roles and intended level range.
5. After review, the maintainer chooses which approved world document becomes
   the canonical map. Proposal files are not automatically published.

To load a submitted world locally, stop the backend and run:

```sh
npm run world:apply -- world/proposal.json backend/data/world.sqlite
```

Restart the backend. Existing personal editor drafts are kept; load the current
world deliberately rather than assuming an old draft contains the proposal.

Keep building footprints level, blend foundations into surrounding terrain,
support shorelines, connect paths to doors and bridges, and keep trees clear of
roads and buildings. Regions remain fixed squares. Sub-area polygons should
share exact borders without overlap or gaps. Validate both navigation and visual
quality; a valid document can still have a poor layout.

## Review and production

`CODEOWNERS` requests review from @Moonnooo. Repository administrators must enable
a GitHub ruleset for `main`: require pull requests, a code-owner approval and the
`backend-and-worlds` check; block force pushes and branch deletion. CODEOWNERS and
workflow files alone do not enforce these restrictions. Restrict bypass rights
to the owner. These settings are not changed by a source-code commit.

There is deliberately no production deployment workflow in this repository.
Keep production credentials outside it. Deployment remains a separate maintainer
action after approval, with backups and a reviewed world selection.

Never submit `.env` files, SSH keys, saved login sessions, database files or
account exports. New assets need provenance and permission for distribution.
