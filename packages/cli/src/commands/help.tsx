import React, { useEffect } from "react";

const Help: React.FC = () => {
  useEffect(() => {
    console.log(`
\x1b[38;2;255;191;0m ⬡ ＯＮＦＬＹＴ \x1b[0m\x1b[1m Deploy CLI v0.1.0-beta\x1b[0m

  \x1b[1mUSAGE\x1b[0m
    $ onflyt <command> [options]

  \x1b[1mCOMMANDS\x1b[0m
    \x1b[36mlogin\x1b[0m              Authenticate with GitHub OAuth
    \x1b[36mlogout\x1b[0m             Sign out
    \x1b[36mwhoami\x1b[0m             Show current user info

    \x1b[33mPROJECT\x1b[0m
    \x1b[36minit\x1b[0m               Initialize new project (creates onflyt.json)
    \x1b[36mdeploy\x1b[0m             Deploy project (ZIP upload)
    \x1b[36mprojects\x1b[0m           List projects by team
    \x1b[36mdelete\x1b[0m             Delete a project

    \x1b[33mDEPLOYMENTS\x1b[0m
    \x1b[36mlogs\x1b[0m               View deployment logs
    \x1b[36mdeployments\x1b[0m        List project deployments
    \x1b[36mrollback\x1b[0m           Rollback to previous deployment

    \x1b[33mTEAM & BILLING\x1b[0m
    \x1b[36mteams\x1b[0m               List your teams
    \x1b[36mcredits\x1b[0m             Check credits balance

  \x1b[1mGLOBAL OPTIONS\x1b[0m
    \x1b[36m-h, --help\x1b[0m          Show this help
    \x1b[36m-v, --version\x1b[0m       Show CLI version
    \x1b[36m-t, --team <id>\x1b[0m     Target specific team
    \x1b[36m--no-open\x1b[0m           Don't auto-open browser on login

  \x1b[1mINIT OPTIONS\x1b[0m
    \x1b[36m--name <name>\x1b[0m        Project name
    \x1b[36m--template <id>\x1b[0m      Template (blank, nextjs, react-vite, etc.)
    \x1b[36m--framework <fw>\x1b[0m     Framework (nextjs, react, node, etc.)
    \x1b[36m--package-manager <pm>\x1b[0m Package manager (npm, bun, yarn, pnpm)
    \x1b[36m--git\x1b[0m                Connect Git repository
    \x1b[36m--no-git\x1b[0m             Skip Git connection
    \x1b[36m-y, --yes\x1b[0m            Skip all prompts (use defaults)

  \x1b[1mLOGS OPTIONS\x1b[0m
    \x1b[36m-l, --live\x1b[0m           Stream live logs (SSE)

  \x1b[1mQUICK START\x1b[0m
    $ onflyt login                    Authenticate
    $ onflyt init                    Create onflyt.json
    $ onflyt deploy                  Deploy project

  \x1b[1mKEYBOARD SHORTCUTS\x1b[0m
    \x1b[36m↑↓\x1b[0m  Navigate selection
    \x1b[36mEnter\x1b[0m  Select / Confirm
    \x1b[36mEsc\x1b[0m   Go back / Cancel
    \x1b[36mQ\x1b[0m     Quit
    \x1b[36mCtrl+C\x1b[0m Quit

  \x1b[1mEXAMPLES\x1b[0m
    $ onflyt deploy --team tm_xxx    Deploy to specific team
    $ onflyt logs dep_xxx --live    Stream live logs
    $ onflyt init --name myapp --yes  Quick init with defaults

  \x1b[1mDOCS\x1b[0m
    https://docs.onflyt.com/cli
`);
  }, []);

  return null;
};

export default Help;
