import React from "react";
import { Text, Box, useInput } from "ink";
import { existsSync, writeFileSync } from "fs";
import { join } from "path";
import { GitDetector } from "../lib/git.js";
import { FrameworkDetector } from "../lib/framework.js";
import {
  hasProjectConfig,
  saveProjectConfig,
  ProjectConfig,
} from "../lib/config.js";
import { initGitRepo } from "../lib/scaffold.js";
import {
  FRAMEWORKS,
  TEMPLATES,
  getDefaultBuildCommand,
  getDefaultOutputDirectory,
  getDefaultStartCommand,
  getInstallCommand,
} from "../shared";
import { Logo } from "../components/Loading.js";

interface InitProps {
  name?: string;
  framework?: string;
  template?: string;
  packageManager?: string;
  git?: boolean;
  yes?: boolean;
}

type Step =
  | "name"
  | "setupType"
  | "template"
  | "framework"
  | "packageManager"
  | "git"
  | "gitRemote"
  | "saving"
  | "done"
  | "error";

const FRAMEWORK_LIST = Object.entries(FRAMEWORKS).map(([id, config]) => ({
  id,
  name: config.label,
}));

const PACKAGE_MANAGERS = [
  { id: "npm", name: "npm" },
  { id: "bun", name: "Bun" },
  { id: "yarn", name: "Yarn" },
  { id: "pnpm", name: "pnpm" },
  { id: "pip", name: "pip" },
  { id: "poetry", name: "Poetry" },
];

const FOOTER = "↑↓ select/navigate • Enter confirm • Esc back • Ctrl+C cancel";

const Init: React.FC<InitProps> = ({
  name,
  framework,
  template,
  packageManager,
  git,
  yes,
}) => {
  const [step, setStep] = React.useState<Step>("name");
  const [history, setHistory] = React.useState<Step[]>(["name"]);
  const [projectName, setProjectName] = React.useState("");
  const [isEditingName, setIsEditingName] = React.useState(false);
  const [useTemplate, setUseTemplate] = React.useState(0);
  const [selectedTemplate, setSelectedTemplate] = React.useState(0);
  const [selectedFramework, setSelectedFramework] = React.useState(0);
  const [selectedPackageManager, setSelectedPackageManager] = React.useState(0);
  const [connectGit, setConnectGit] = React.useState(true);
  const [hasGit, setHasGit] = React.useState(false);
  const [detectedName, setDetectedName] = React.useState("");
  const [detectedFrameworkId, setDetectedFrameworkId] = React.useState("");
  const [gitUrl, setGitUrl] = React.useState<string | null>(null);
  const [gitBranch, setGitBranch] = React.useState("main");
  const [remoteUrl, setRemoteUrl] = React.useState("");
  const [errorMsg, setErrorMsg] = React.useState("");
  const [savedConfig, setSavedConfig] = React.useState<ProjectConfig | null>(
    null,
  );

  const goTo = (nextStep: Step) => {
    setHistory([...history, nextStep]);
    setStep(nextStep);
  };

  const goBack = () => {
    if (history.length > 1) {
      const newHistory = history.slice(0, -1);
      setHistory(newHistory);
      setStep(newHistory[newHistory.length - 1]);
    }
  };

  React.useEffect(() => {
    detect();
  }, []);

  React.useEffect(() => {
    if (step === "done" || step === "error") {
      const timer = setTimeout(() => {
        process.exit(step === "error" ? 1 : 0);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [step]);

  const detect = async () => {
    const cwd = process.cwd();

    if (hasProjectConfig(cwd)) {
      setErrorMsg(
        "Already initialized. Run 'onflyt deploy' to deploy, or delete onflyt.json to reinitialize.",
      );
      setStep("error");
      return;
    }

    const gitDetector = new GitDetector(cwd);
    const gitInfo = await gitDetector.detect();
    const detectedHasGit = gitInfo.isGitRepo && gitInfo.remotes.length > 0;

    const frameworkDetector = new FrameworkDetector(cwd);
    const detectedFw = frameworkDetector.detect();
    const fwId = detectedFw?.id || "node";

    let detected =
      cwd
        .split("/")
        .pop()
        ?.replace(/[^a-z0-9-]/g, "-")
        .toLowerCase() || "my-project";
    if (detectedHasGit && gitInfo.remotes[0]) {
      const match = gitInfo.remotes[0].url.match(/\/([^\/]+?)(?:\.git)?$/);
      if (match) {
        detected = match[1].replace(/[^a-z0-9-]/g, "-").toLowerCase();
      }
    }

    const fwIndex = FRAMEWORK_LIST.findIndex(
      (f) => f.id === (framework || fwId),
    );
    const pmIndex = PACKAGE_MANAGERS.findIndex((p) => p.id === packageManager);

    setDetectedName(detected);
    setDetectedFrameworkId(fwId);
    setProjectName(name || detected);
    setConnectGit(
      git !== undefined ? git : detectedHasGit && !!gitInfo.remotes[0],
    );
    setSelectedFramework(fwIndex >= 0 ? fwIndex : 0);
    setSelectedPackageManager(pmIndex >= 0 ? pmIndex : 0);
    setHasGit(detectedHasGit);

    if (gitInfo.remotes[0]) {
      setGitUrl(gitInfo.remotes[0].url);
      setGitBranch(gitInfo.currentBranch || "main");
    }

    if (yes) {
      autoSave();
    }
  };

  const getFinalProjectName = () => {
    return projectName || detectedName;
  };

  const cancel = () => {
    console.log("\nCancelled.");
    process.exit(0);
  };

  const autoSave = async () => {
    setStep("saving");

    let fwId: string;
    if (useTemplate === 1) {
      fwId = TEMPLATES[selectedTemplate].framework;
    } else {
      fwId = FRAMEWORK_LIST[selectedFramework].id;
    }

    const pmId = PACKAGE_MANAGERS[selectedPackageManager].id;
    const cwd = process.cwd();

    const frameworkDetector = new FrameworkDetector(cwd);
    const detectedOutputDir = frameworkDetector.detectOutputDirectory(fwId);

    const buildCmd = getDefaultBuildCommand(fwId) || "";
    const installCmd = getInstallCommand(fwId, pmId);
    const outputDir =
      detectedOutputDir || getDefaultOutputDirectory(fwId) || ".";
    const startCmd = getDefaultStartCommand(fwId) || "";

    if (connectGit && !hasGit) {
      initGitRepo(cwd, remoteUrl || undefined);
      createGitignore(cwd);
    }

    const projectConfig: ProjectConfig = {
      name: getFinalProjectName(),
      framework: fwId,
      buildCommand: buildCmd,
      outputDirectory: outputDir,
      installCommand: installCmd,
      startCommand: startCmd,
      gitRepoUrl: connectGit ? remoteUrl || gitUrl || undefined : undefined,
      gitBranch: connectGit ? "main" : undefined,
    };

    saveProjectConfig(projectConfig);
    setSavedConfig(projectConfig);
    setStep("done");
  };

  const createGitignore = (cwd: string) => {
    const gitignorePath = join(cwd, ".gitignore");
    if (!existsSync(gitignorePath)) {
      const defaultGitignore = `node_modules/
dist/
build/
.next/
.output/
.env
.env.local
*.log
.DS_Store
`;
      writeFileSync(gitignorePath, defaultGitignore);
    }
  };

  useInput((input, key) => {
    if (key.ctrl && input === "c") {
      cancel();
      return;
    }

    switch (step) {
      case "name":
        if (key.return) {
          goTo("setupType");
        } else if (key.escape) {
          setIsEditingName(false);
          setProjectName(detectedName);
        } else if (key.backspace || key.delete) {
          setProjectName(projectName.slice(0, -1));
        } else if (input && input.match(/^[a-zA-Z0-9-_]$/)) {
          if (projectName === detectedName && !isEditingName) {
            setProjectName(input);
          } else {
            setProjectName(projectName + input);
          }
          setIsEditingName(true);
        }
        break;

      case "setupType":
        if (key.downArrow || input === "j") {
          setUseTemplate(1);
        } else if (key.upArrow || input === "k") {
          setUseTemplate(0);
        } else if (key.return) {
          if (useTemplate === 0) {
            goTo("framework");
          } else {
            goTo("template");
          }
        } else if (key.escape) {
          goBack();
        }
        break;

      case "template":
        if (key.downArrow || input === "j") {
          setSelectedTemplate((prev) =>
            Math.min(prev + 1, TEMPLATES.length - 1),
          );
        } else if (key.upArrow || input === "k") {
          setSelectedTemplate((prev) => Math.max(prev - 1, 0));
        } else if (key.return) {
          goTo("git");
        } else if (key.escape) {
          goBack();
        }
        break;

      case "framework":
        if (key.downArrow || input === "j") {
          setSelectedFramework((prev) =>
            Math.min(prev + 1, FRAMEWORK_LIST.length - 1),
          );
        } else if (key.upArrow || input === "k") {
          setSelectedFramework((prev) => Math.max(prev - 1, 0));
        } else if (key.return) {
          goTo("packageManager");
        } else if (key.escape) {
          goBack();
        }
        break;

      case "packageManager":
        if (key.downArrow || input === "j") {
          setSelectedPackageManager((prev) =>
            Math.min(prev + 1, PACKAGE_MANAGERS.length - 1),
          );
        } else if (key.upArrow || input === "k") {
          setSelectedPackageManager((prev) => Math.max(prev - 1, 0));
        } else if (key.return) {
          goTo("git");
        } else if (key.escape) {
          goBack();
        }
        break;

      case "git":
        if (key.downArrow || input === "j" || input === " ") {
          setConnectGit((prev) => !prev);
        } else if (key.upArrow || input === "k") {
          setConnectGit((prev) => !prev);
        } else if (key.return) {
          if (connectGit) {
            if (hasGit) {
              autoSave();
            } else {
              goTo("gitRemote");
            }
          } else {
            autoSave();
          }
        } else if (key.escape) {
          goBack();
        }
        break;

      case "gitRemote":
        if (key.return) {
          autoSave();
        } else if (key.escape) {
          goBack();
        } else if (key.backspace || key.delete) {
          setRemoteUrl(remoteUrl.slice(0, -1));
        } else if (input && input.length > 0) {
          setRemoteUrl(remoteUrl + input);
        }
        break;
    }
  });

  if (step === "error") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="red">
          Error
        </Text>
        <Box marginTop={1}>
          <Text color="red">{errorMsg}</Text>
        </Box>
      </Box>
    );
  }

  if (step === "saving") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text>Saving configuration...</Text>
        </Box>
      </Box>
    );
  }

  if (step === "done") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="green">
          ✓ Project initialized!
        </Text>
        <Box marginTop={1}>
          <Text>onflyt.json saved to current directory</Text>
        </Box>
        {savedConfig && (
          <>
            <Box marginTop={1}>
              <Text dimColor>Project: {savedConfig.name}</Text>
            </Box>
            <Box>
              <Text dimColor>
                Framework: {FRAMEWORKS[savedConfig.framework]?.label}
              </Text>
            </Box>
            {savedConfig.gitRepoUrl && (
              <Box>
                <Text dimColor>Git: {savedConfig.gitRepoUrl}</Text>
              </Box>
            )}
          </>
        )}
        <Box marginTop={2}>
          <Text bold>Next steps:</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>1. Run 'onflyt deploy' to deploy</Text>
        </Box>
        <Box>
          <Text dimColor>2. Team selection will happen during deploy</Text>
        </Box>
      </Box>
    );
  }

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />

      {step === "name" && (
        <>
          <Box marginTop={1}>
            <Text>Project Name</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press keys to edit, Enter to continue</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold color="cyan">
              &gt;{" "}
            </Text>
            <Text>{projectName || detectedName}</Text>
            <Text bold color="cyan">
              _
            </Text>
          </Box>
        </>
      )}

      {step === "setupType" && (
        <>
          <Box marginTop={1}>
            <Text>Setup Type</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text>
                {useTemplate === 0 ? "❯ " : "  "}
                Use existing files
              </Text>
            </Box>
            <Box>
              <Text>
                {useTemplate === 1 ? "❯ " : "  "}
                Use a template (scaffold from starter)
              </Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{FOOTER}</Text>
          </Box>
        </>
      )}

      {step === "template" && (
        <>
          <Box marginTop={1}>
            <Text>Select Template</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {TEMPLATES.map((t, i) => (
              <Box key={t.id}>
                <Text>
                  {i === selectedTemplate ? "❯ " : "  "}
                  {t.name} - {t.description}
                </Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{FOOTER}</Text>
          </Box>
        </>
      )}

      {step === "framework" && (
        <>
          <Box marginTop={1}>
            <Text>Select Framework</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Detected: {detectedFrameworkId}</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {FRAMEWORK_LIST.map((fw, i) => (
              <Box key={fw.id}>
                <Text>
                  {i === selectedFramework ? "❯ " : "  "}
                  {fw.name}
                </Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{FOOTER}</Text>
          </Box>
        </>
      )}

      {step === "packageManager" && (
        <>
          <Box marginTop={1}>
            <Text>Select Package Manager</Text>
          </Box>
          <Box marginTop={1} flexDirection="column">
            {PACKAGE_MANAGERS.map((pm, i) => (
              <Box key={pm.id}>
                <Text>
                  {i === selectedPackageManager ? "❯ " : "  "}
                  {pm.name}
                </Text>
              </Box>
            ))}
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{FOOTER}</Text>
          </Box>
        </>
      )}

      {step === "git" && (
        <>
          <Box marginTop={1}>
            <Text>Git Repository</Text>
          </Box>
          {gitUrl && (
            <Box marginTop={1}>
              <Text dimColor>
                Detected: {gitUrl} ({gitBranch})
              </Text>
            </Box>
          )}
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text>
                {connectGit ? "❯ " : "  "}
                {hasGit ? "Yes, connect git repo" : "Initialize git repo"}
              </Text>
            </Box>
            <Box>
              <Text>{!connectGit ? "❯ " : "  "}Skip git (manual deploys)</Text>
            </Box>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>{FOOTER}</Text>
          </Box>
        </>
      )}

      {step === "gitRemote" && (
        <>
          <Box marginTop={1}>
            <Text>Git Remote URL (optional)</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>Press Enter to skip, or enter GitHub repo URL</Text>
          </Box>
          <Box marginTop={1}>
            <Text>&gt; {remoteUrl}</Text>
            <Text bold>_</Text>
          </Box>
          <Box marginTop={1}>
            <Text dimColor>
              Enter paste URL • Backspace delete • Enter continue
            </Text>
          </Box>
        </>
      )}
    </Box>
  );
};

export default Init;
