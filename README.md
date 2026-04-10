<p align="center">
  <img src="onflyt-logo.svg" alt="Onflyt" width="128" height="128">
</p>

<h1 align="center">Onflyt CLI</h1>

<p align="center">
  <img src="https://img.shields.io/npm/v/onflyt-cli?style=flat-square" alt="npm version">
  <img src="https://img.shields.io/npm/v/onflyt-cli/beta?style=flat-square" alt="beta version">
  <img src="https://img.shields.io/node/v/onflyt-cli?style=flat-square" alt="node version">
  <img src="https://img.shields.io/npm/dm/onflyt-cli?style=flat-square" alt="downloads">
  <img src="https://img.shields.io/github/license/miiglu/onflyt-cli?style=flat-square" alt="license">
  <img src="https://img.shields.io/badge/TypeScript-007ACC?style=flat-square&logo=typescript&logoColor=white" alt="TypeScript">
  <img src="https://img.shields.io/badge/React-61DAFB?style=flat-square&logo=react&logoColor=black" alt="React">
  <img src="https://img.shields.io/badge/Ink-Cli-ff69b4?style=flat-square" alt="Ink CLI">
  <img src="https://img.shields.io/badge/Cloudflare-F38020?style=flat-square&logo=cloudflare&logoColor=white" alt="Cloudflare">
  <img src="https://img.shields.io/badge/Node.js-339933?style=flat-square&logo=node.js&logoColor=white" alt="Node.js">
</p>

<h3 align="center">The official CLI for Onflyt — deploy node and python APIs, agents, and static sites globally from your terminal.</h3>

<p align="center">Deploy your APIs on a stateful serverless pod. Pay only per use - no subscription required.</p>

<p align="center">
  <a href="https://onflyt.com"><img src="https://img.shields.io/badge/Get%20Started%20on%20Onflyt-FFA500?style=for-the-badge&logoColor=black" alt="Get Started on Onflyt"></a>
</p>

<p align="center">
  <small>Manage your deployments, APIs, and applications on the <a href="https://onflyt.com">official Onflyt dashboard</a>.</small>
</p>

## Features

- **Serverless pods** - Secure, isolated pods that survive hibernation
- **Pay per use** - Only pay for what you deploy, no subscriptions
- **Global edge network** - 280+ cities for instant global deployment
- **Quick Deployments** - Deploy projects with a single command
- **GitHub OAuth** - Secure authentication via GitHub
- **AI Agent Templates** - Deploy AI agents and LLM-powered backends
- **Multi-Project Management** - Manage multiple projects across teams
- **Real-time Logs** - Stream live deployment logs
- **Rollback Support** - Revert to previous deployments instantly

## Installation

```bash
npm install -g onflyt-cli
```

### Install via other package managers

```bash
# Using yarn
yarn global add onflyt-cli

# Using pnpm
pnpm add -g onflyt-cli

# Using bun
bun add -g onflyt-cli
```

## Quick Start

```bash
# 1. Authenticate with your account
onflyt login

# 2. Initialize a project in your current directory
onflyt init

# 3. Deploy your project
onflyt deploy
```

## Commands

### Project Management

- `onflyt init` - Initialize a new project
- `onflyt deploy` - Deploy project
- `onflyt projects` - List projects
- `onflyt delete` - Delete a project

### Deployment Management

- `onflyt logs` - View deployment logs
- `onflyt deployments` - List deployments
- `onflyt rollback` - Rollback deployment

### Team & Billing

- `onflyt teams` - List teams
- `onflyt credits` - Check credits

## Support

- [Documentation](https://docs.onflyt.com)
- [Website](https://onflyt.com)
- [Issues](https://github.com/miiglu/onflyt-cli/issues)

---

<p align="center">
  Built by <a href="https://miiglu.com">Miiglu</a>
</p>
