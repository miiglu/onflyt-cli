import React from "react";
import { Text, Box } from "ink";
import meow from "meow";
import Help from "./commands/help.js";
import Login from "./commands/login.js";
import Logout from "./commands/logout.js";
import WhoAmI from "./commands/whoami.js";
import ProjectsList from "./commands/projects.js";
import Init from "./commands/init.js";
import Credits from "./commands/credits.js";
import Teams from "./commands/teams.js";
import Deploy from "./commands/deploy.js";
import Logs from "./commands/logs.js";
import Deployments from "./commands/deployments.js";
import Delete from "./commands/delete.js";
import Rollback from "./commands/rollback.js";

const cli = meow(
  `
  Onflyt CLI v0.1.0-beta

  Usage
    $ onflyt <command>

  Commands
    login              Authenticate with Onflyt
    init               Initialize a new project
    deploy             Deploy your project
    projects           Manage projects
    teams              List your teams
    logs               View deployment logs
    deployments        List project deployments
    delete             Delete a project
    rollback           Rollback to previous deployment
    whoami             Show current user
    logout             Sign out
    credits            Check credits balance

  Init Options
    --name <name>      Project name
    --template <id>    Template ID (blank, nextjs, react-vite, etc.)
    --framework <fw>   Framework (nextjs, react, node, etc.)
    --package-manager  Package manager (npm, bun, yarn, pnpm)
    --git / --no-git   Connect or skip git
    --yes              Skip all prompts (use defaults)

  Logs Options
    --live, -l         Stream live logs (SSE)

  Options
    --version, -v      Show CLI version
    --help, -h         Show this help
    --debug            Enable debug mode
    --no-open          Don't open browser automatically
`,
  {
    importMeta: import.meta,
    autoHelp: false,
    flags: {
      version: { type: "boolean", shortFlag: "v" },
      help: { type: "boolean", shortFlag: "h" },
      team: { type: "string", shortFlag: "t" },
      noOpen: { type: "boolean" },
      name: { type: "string" },
      template: { type: "string" },
      framework: { type: "string" },
      packageManager: { type: "string" },
      git: { type: "boolean" },
      yes: { type: "boolean", shortFlag: "y" },
      live: { type: "boolean", shortFlag: "l" },
    },
  },
);

if (
  cli.flags.help ||
  cli.input[0] === "help" ||
  cli.input[0] === "--help" ||
  cli.input[0] === "-h"
) {
  render(<Help />, { exitOnCtrlC: false });
  process.exit(0);
}

import { render } from "ink";
import App from "./App.js";

const command = cli.input[0];

const CommandRouter = () => {
  switch (command) {
    case "login":
      return <Login openBrowser={!cli.flags.noOpen} />;
    case "logout":
      return <Logout />;
    case "whoami":
      return <WhoAmI />;
    case "projects":
      return <ProjectsList />;
    case "init":
      return (
        <Init
          name={cli.flags.name}
          template={cli.flags.template}
          framework={cli.flags.framework}
          packageManager={cli.flags.packageManager}
          git={cli.flags.git}
          yes={cli.flags.yes}
        />
      );
    case "credits":
      return <Credits />;
    case "teams":
      return <Teams />;
    case "deploy":
      return <Deploy teamFlag={cli.flags.team} />;
    case "logs":
      return <Logs deploymentId={cli.input[1]} live={cli.flags.live} />;
    case "deployments":
      return <Deployments projectName={cli.input[1]} />;
    case "delete":
      return <Delete projectId={cli.input[1]} />;
    case "rollback":
      return <Rollback deploymentId={cli.input[1]} />;
    default:
      return <App />;
  }
};

render(<CommandRouter />, { exitOnCtrlC: false });
