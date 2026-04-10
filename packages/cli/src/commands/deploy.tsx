import React, { useEffect, useState, useCallback } from "react";
import { Box, Text, useInput } from "ink";
import { readFileSync, existsSync } from "fs";
import { isLoggedIn } from "../lib/config.js";
import { GitDetector } from "../lib/git.js";
import {
  Team,
  Balance,
  ProjectConfig,
  INSTANCE_OPTIONS,
  isPodProject,
  getProjectConfig,
  loadTeamsWithBalances,
  getTeamDetails,
  getTeamLimits,
  getTeamPlanLabel,
  findOrCreateProject,
  updateProjectSettings,
  getProjectDetails,
  startDeployment,
  getDeploymentStatus,
  streamLogs,
  DeploymentStatus,
  deployManual,
} from "../lib/deploy-api.js";
import { TIER_HOURLY_PRICE } from "../shared";
import { api } from "../lib/api.js";

type Step =
  | "loading"
  | "team"
  | "config"
  | "instance"
  | "env"
  | "deploying"
  | "done"
  | "error";

type DeployStage = "starting" | "zipping" | "uploading" | "deployed";

interface Props {
  teamFlag?: string;
}

const Deploy: React.FC<Props> = ({ teamFlag }) => {
  const [step, setStep] = useState<Step>("loading");
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleSigInt = () => process.exit(0);
    process.on("SIGINT", handleSigInt);
    return () => {
      process.off("SIGINT", handleSigInt);
    };
  }, []);

  useEffect(() => {
    if (step === "done" || step === "error") {
      const timer = setTimeout(() => process.exit(0), 500);
      return () => clearTimeout(timer);
    }
  }, [step]);
  const [teams, setTeams] = useState<Team[]>([]);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [balances, setBalances] = useState<Record<string, Balance>>({});
  const [projectConfig, setProjectConfig] = useState<ProjectConfig | null>(
    null,
  );
  const [selectedInstanceIndex, setSelectedInstanceIndex] = useState(2);
  const [replicas, setReplicas] = useState(1);
  const [envVars, setEnvVars] = useState<Array<{ key: string; value: string }>>(
    [],
  );
  const [envMessage, setEnvMessage] = useState<string>("");
  const [deploymentId, setDeploymentId] = useState<string>("");
  const [deploymentStatus, setDeploymentStatus] =
    useState<DeploymentStatus>("queued");
  const [liveLogs, setLiveLogs] = useState<string[]>([]);
  const [previewUrl, setPreviewUrl] = useState<string>("");
  const [liveUrl, setLiveUrl] = useState<string>("");
  const [projectId, setProjectId] = useState<string>("");
  const [dotCount, setDotCount] = useState(0);
  const [existingProject, setExistingProject] = useState<any>(null);
  const [isNewProject, setIsNewProject] = useState(false);
  const [projectInstanceSize, setProjectInstanceSize] = useState<string>("");
  const [projectReplicas, setProjectReplicas] = useState<number>(1);
  const [totalLifetimeSpend, setTotalLifetimeSpend] = useState<number>(0);
  const [currentBalance, setCurrentBalance] = useState<{
    balanceUSD: number;
    balanceFormatted: string;
  }>({ balanceUSD: 0, balanceFormatted: "$0.00" });
  const [hasGitRemote, setHasGitRemote] = useState(false);
  const [deployStage, setDeployStage] = useState<DeployStage>("starting");
  const [uploadProgress, setUploadProgress] = useState({
    uploaded: 0,
    total: 0,
  });
  const [zipSize, setZipSize] = useState<number | null>(null);

  const selectedTeam = teams[selectedTeamIndex];
  const limits = getTeamLimits(totalLifetimeSpend);
  const planLabel = getTeamPlanLabel(totalLifetimeSpend);
  const needsPod = isPodProject(projectConfig?.framework);

  const selectedInstance = INSTANCE_OPTIONS[selectedInstanceIndex];
  const estimatedHourlyCost =
    needsPod && selectedInstance
      ? TIER_HOURLY_PRICE[selectedInstance.id] * replicas
      : null;

  const formatEstimatedCost = (cost: number): string => {
    if (cost === 0) return "Free";
    return `$${cost.toFixed(3)}/hr`;
  };

  useEffect(() => {
    if (step !== "loading") return;

    if (!isLoggedIn()) {
      setErrorMsg("Not logged in. Run 'onflyt login' first.");
      setStep("error");
      return;
    }

    const config = getProjectConfig();
    if (!config) {
      setErrorMsg("No onflyt.json found. Run 'onflyt init' first.");
      setStep("error");
      return;
    }
    setProjectConfig(config);

    const loadData = async () => {
      try {
        const gitDetector = new GitDetector(process.cwd());
        const gitInfo = await gitDetector.detect();
        setHasGitRemote(gitInfo.isGitRepo && gitInfo.remotes.length > 0);

        const { teams: loadedTeams, balances: loadedBalances } =
          await loadTeamsWithBalances();
        setTeams(loadedTeams);
        setBalances(loadedBalances);

        const selectedIdx = teamFlag
          ? loadedTeams.findIndex(
              (t) => t.team.id === teamFlag || t.team.slug === teamFlag,
            )
          : 0;
        if (selectedIdx >= 0) setSelectedTeamIndex(selectedIdx);

        const selectedTeamForProject =
          loadedTeams[selectedIdx >= 0 ? selectedIdx : 0];

        if (selectedTeamForProject) {
          try {
            const teamDetails = await getTeamDetails(
              selectedTeamForProject.team.id,
            );
            setTotalLifetimeSpend(teamDetails.totalLifetimeSpend);
            setCurrentBalance({
              balanceUSD: teamDetails.balanceUSD,
              balanceFormatted:
                loadedBalances[selectedTeamForProject.team.id]
                  ?.balanceFormatted || "$0.00",
            });
          } catch {
            setTotalLifetimeSpend(0);
            setCurrentBalance(
              loadedBalances[selectedTeamForProject.team.id] || {
                balanceUSD: 0,
                balanceFormatted: "$0.00",
              },
            );
          }

          try {
            const projectsRes = await api.get<any>(
              `/projects/team/${selectedTeamForProject.team.id}`,
            );
            const existingProject = (projectsRes.projects || []).find(
              (p: any) => p.name === config.name,
            );
            if (existingProject) {
              const fullProject = await getProjectDetails(existingProject.id);
              setExistingProject(fullProject);
              setProjectId(fullProject.id);
              setIsNewProject(false);
              setProjectInstanceSize(fullProject.instanceSize || "micro");
              setProjectReplicas(fullProject.maxInstances || 1);
              const instanceIdx = INSTANCE_OPTIONS.findIndex(
                (i) => i.id === (fullProject.instanceSize || "micro"),
              );
              setSelectedInstanceIndex(instanceIdx >= 0 ? instanceIdx : 2);
            } else {
              setIsNewProject(true);
            }
          } catch {
            setIsNewProject(true);
          }
        }

        setStep("team");
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to load data");
        setStep("error");
      }
    };

    loadData();
  }, [step, teamFlag]);

  useEffect(() => {
    if (step !== "deploying") return;
    if (deploymentStatus === "deployed" || deploymentStatus === "failed")
      return;

    const interval = setInterval(() => {
      setDotCount((c) => (c + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [step, deploymentStatus]);

  const handleDeploy = useCallback(async () => {
    if (!selectedTeam || !projectConfig) return;

    try {
      const project = await findOrCreateProject(
        selectedTeam.team.id,
        projectConfig.name,
        projectConfig.framework,
        projectConfig.gitRepoUrl,
      );

      if (!project.isNew) {
        const fullProject = await getProjectDetails(project.id);
        setExistingProject(fullProject);
        setProjectId(project.id);
        setIsNewProject(false);
        const existingSize = fullProject.instanceSize || "micro";
        const existingReplicas = fullProject.maxInstances || 1;
        setProjectInstanceSize(existingSize);
        setProjectReplicas(existingReplicas);
        if (needsPod) {
          const instanceIdx = INSTANCE_OPTIONS.findIndex(
            (i) => i.id === existingSize,
          );
          setSelectedInstanceIndex(instanceIdx >= 0 ? instanceIdx : 2);
          setReplicas(existingReplicas);
          setStep("instance");
        } else {
          setStep("env");
        }
      } else {
        setProjectId(project.id);
        setIsNewProject(true);
        if (needsPod) {
          setStep("instance");
        } else {
          setStep("env");
        }
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  }, [selectedTeam, projectConfig, needsPod]);

  const triggerDeployment = useCallback(
    async (projId: string) => {
      setStep("deploying");
      setDeployStage("starting");
      setUploadProgress({ uploaded: 0, total: 0 });
      setZipSize(null);

      const hasConfiguredGit = !!projectConfig?.gitRepoUrl;

      if (hasConfiguredGit) {
        try {
          const depId = await startDeployment(
            projId,
            projectConfig?.gitBranch || "main",
            needsPod ? selectedInstance?.id : undefined,
            needsPod ? replicas : undefined,
            envVars.length > 0 ? envVars : undefined,
          );

          setDeploymentId(depId);
          pollStatus(depId);
        } catch (err: any) {
          setStep("error");
          setErrorMsg(err.message);
        }
        return;
      }

      const { join } = await import("path");
      const { tmpdir } = await import("os");
      const { statSync } = await import("fs");
      const zipPath = join(tmpdir(), `onflyt-deploy-${Date.now()}.zip`);

      setDeployStage("zipping");

      setTimeout(async () => {
        try {
          const { createProjectZip } = await import("../lib/deploy-api.js");
          await createProjectZip(process.cwd(), zipPath);

          const size = statSync(zipPath).size;
          setZipSize(size);
          console.log(
            `\x1b[90m  Archive size: ${(size / 1024 / 1024).toFixed(1)} MB\x1b[0m`,
          );

          if (size > 100 * 1024 * 1024) {
            console.log(`\x1b[33m  Warning: File exceeds 100MB limit\x1b[0m`);
          }

          setDeployStage("uploading");
          const { deployManual } = await import("../lib/deploy-api.js");
          const depId = await deployManual(
            projId,
            zipPath,
            projectConfig?.framework,
            needsPod ? selectedInstance?.id : undefined,
            needsPod ? replicas : undefined,
            envVars.length > 0 ? envVars : undefined,
            (uploaded, total) => {
              setUploadProgress({ uploaded, total });
            },
            {
              buildCommand: projectConfig?.buildCommand,
              outputDirectory: projectConfig?.outputDirectory,
              installCommand: projectConfig?.installCommand,
            },
          );

          setDeploymentId(depId);
          pollStatus(depId);
        } catch (err: any) {
          setStep("error");
          setErrorMsg(err.message);
        }
      }, 100);
    },
    [projectConfig, selectedInstance, replicas, envVars, needsPod],
  );

  const handleUpdateAndDeploy = useCallback(async () => {
    try {
      if (needsPod) {
        const instanceToUse = selectedInstance?.id || projectInstanceSize;
        const replicasToUse = replicas || projectReplicas;
        if (instanceToUse || replicasToUse) {
          await updateProjectSettings(
            projectId,
            instanceToUse as any,
            replicasToUse,
          );
        }
      }
      setStep("deploying");
      triggerDeployment(projectId);
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  }, [
    projectId,
    projectInstanceSize,
    projectReplicas,
    selectedInstance,
    replicas,
    needsPod,
    triggerDeployment,
  ]);

  const pollStatus = useCallback(
    (depId: string) => {
      const poll = async () => {
        try {
          const details = await getDeploymentStatus(depId);
          setDeploymentStatus(details.status);

          if (details.status === "building" && liveLogs.length === 0) {
            if (limits.enableLogStreaming) {
              streamLogs(
                depId,
                (log) => {
                  setLiveLogs((prev) => [...prev.slice(-200), log]);
                },
                () => {
                  console.log("\x1b[33m⚠ Live logs unavailable\x1b[0m");
                },
              );
            }
          }

          if (details.status === "live") {
            setLiveUrl(
              details.url || `https://${projectConfig?.name}.onflyt.dev`,
            );
            setPreviewUrl(details.previewUrl || "");
            setStep("done");
            return;
          }

          if (details.status === "failed") {
            setErrorMsg(
              "Deployment failed. Run 'onflyt logs " + depId + "' for details.",
            );
            setStep("error");
            return;
          }

          setTimeout(() => poll(), 3000);
        } catch (err: any) {
          setTimeout(() => poll(), 5000);
        }
      };

      poll();
    },
    [liveLogs.length, limits.enableLogStreaming, projectConfig?.name],
  );

  useInput((input, key) => {
    if (input === "q" || input === "Q" || (key.ctrl && input === "c")) {
      process.exit(0);
    }

    if (key.escape) {
      if (step === "instance") setStep("config");
      if (step === "env") setStep(needsPod ? "instance" : "config");
      return;
    }

    if (key.return) {
      if (step === "team") {
        setStep("config");
      } else if (step === "config") {
        handleDeploy();
      } else if (step === "instance") {
        setStep("env");
      } else if (step === "env") {
        triggerDeployment(projectId);
      }
      return;
    }

    if (step === "config" && input === "1" && needsPod) {
      setStep("instance");
      return;
    }

    if (step === "team") {
      if (key.upArrow) {
        setSelectedTeamIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedTeamIndex((i) => Math.min(teams.length - 1, i + 1));
      }
      return;
    }

    if (step === "instance") {
      if (key.upArrow) {
        setSelectedInstanceIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedInstanceIndex((i) =>
          Math.min(INSTANCE_OPTIONS.length - 1, i + 1),
        );
      } else if (key.leftArrow) {
        setReplicas((r) => Math.max(1, r - 1));
      } else if (key.rightArrow) {
        setReplicas((r) =>
          Math.min(INSTANCE_OPTIONS[selectedInstanceIndex].maxReplicas, r + 1),
        );
      }
      return;
    }

    if (step === "env") {
      if (input === "1") {
        handleImportEnv();
      } else if (input === "2") {
        handleAddEnv();
      } else if (input === "3") {
        handleAddEnv();
      }
      return;
    }

    if (input === "q" || input === "Q") {
      process.exit(0);
    }
  });

  const handleImportEnv = () => {
    try {
      const projectPath = process.cwd();
      const envPath = `${projectPath}/.env`;
      if (existsSync(envPath)) {
        const content = readFileSync(envPath, "utf-8");
        const vars = content
          .split("\n")
          .filter((line: string) => line.includes("=") && !line.startsWith("#"))
          .map((line: string) => {
            const [key, ...rest] = line.split("=");
            return { key: key.trim(), value: rest.join("=").trim() };
          });
        setEnvVars(vars);
      }
    } catch {}
    handleUpdateAndDeploy();
  };

  const handleAddEnv = () => {
    handleUpdateAndDeploy();
  };

  if (step === "loading") {
    return (
      <Box flexDirection="column">
        <Text bold color="rgb(255,191,0)">
          <Text>DEPLOY</Text>
        </Text>
        <Box marginTop={1}>
          <Text>Loading...</Text>
        </Box>
      </Box>
    );
  }

  if (step === "team") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="rgb(255,191,0)">
          <Text>DEPLOY</Text>
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold>Select Team</Text>
          <Text dimColor>Use ↑↓ to navigate, Enter to confirm</Text>

          {teams.map((team, idx) => (
            <Box key={team.team.id} marginTop={1}>
              <Text color={idx === selectedTeamIndex ? "cyan" : "gray"}>
                {idx === selectedTeamIndex ? "▶ " : "  "}
              </Text>
              <Text bold={idx === selectedTeamIndex}>{team.team.name}</Text>
              <Text dimColor> ({team.role})</Text>
            </Box>
          ))}
        </Box>

        <Box marginTop={2}>
          <Text dimColor>[Enter] Deploy to this team [Esc] Cancel</Text>
        </Box>
      </Box>
    );
  }

  if (step === "error") {
    return (
      <Box flexDirection="column">
        <Text bold color="rgb(255,191,0)">
          <Text>DEPLOY</Text>
        </Text>
        <Box marginTop={1}>
          <Text bold color="red">
            ✖ Error
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="red">{errorMsg}</Text>
        </Box>
      </Box>
    );
  }

  if (step === "config") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="rgb(255,191,0)">
          <Text>DEPLOY</Text>
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold>┌─ Project Configuration</Text>
          <Box marginTop={1}>
            <Text color="cyan"> │ Name: </Text>
            <Text bold>{projectConfig?.name || "Unknown"}</Text>
          </Box>
          <Box>
            <Text color="cyan"> │ Type: </Text>
            <Text bold color="yellow">
              {projectConfig?.framework?.toUpperCase() || "STATIC"}
            </Text>
            {needsPod && <Text color="magenta"> (Onflyt Pod)</Text>}
          </Box>
          <Box>
            <Text color="cyan"> │ Deploy: </Text>
            <Text color={hasGitRemote ? "green" : "yellow"}>
              {hasGitRemote ? "Git-based" : "Manual (ZIP)"}
            </Text>
          </Box>
          <Box>
            <Text color="cyan"> └─ Team: </Text>
            <Text>{selectedTeam?.team.name}</Text>
          </Box>
        </Box>

        <Box marginTop={2} flexDirection="column">
          <Text bold>┌─ Usage Plan</Text>
          <Box marginTop={1}>
            <Text color="cyan"> │ Plan: </Text>
            <Text bold color="yellow">
              {planLabel}
            </Text>
          </Box>
          <Box>
            <Text color="cyan"> │ Credits: </Text>
            <Text>{currentBalance.balanceFormatted}</Text>
          </Box>
          <Box>
            <Text color="cyan"> │ Max Replicas: </Text>
            <Text>{limits.maxInstancesPerProject}</Text>
          </Box>
          <Box>
            <Text color="cyan"> └─ Build Time: </Text>
            <Text>{limits.maxBuildMinutes} min</Text>
          </Box>
        </Box>

        {needsPod && (
          <Box marginTop={2} flexDirection="column">
            <Text bold>┌─ Onflyt Pod</Text>
            <Box marginTop={1}>
              <Text color="cyan"> │ Instance: </Text>
              <Text color="yellow">{selectedInstance?.label || "not set"}</Text>
            </Box>
            <Box>
              <Text color="cyan"> │ Replicas: </Text>
              <Text color="yellow">{replicas}</Text>
            </Box>
            <Box>
              <Text color="cyan"> └─ Est. Cost: </Text>
              <Text color="yellow">
                {estimatedHourlyCost !== null
                  ? formatEstimatedCost(estimatedHourlyCost)
                  : "Free"}
              </Text>
            </Box>
          </Box>
        )}

        <Box marginTop={2}>
          <Text bold color="gray">
            {" "}
            ─────────────────────────────────────────────
          </Text>
        </Box>

        <Box marginTop={2} flexDirection="column">
          {needsPod && (
            <Box marginBottom={1}>
              <Text color="gray"> </Text>
              <Text bold color="cyan">
                [1]
              </Text>
              <Text color="gray"> Configure Onflyt Pod</Text>
            </Box>
          )}
          <Box>
            <Text color="gray"> </Text>
            <Text bold color="green">
              ▸
            </Text>
            <Text color="gray"> </Text>
            <Text bold color="green">
              [Enter] Deploy now
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text color="gray"> </Text>
            <Text color="gray">[q] Quit</Text>
          </Box>
        </Box>
      </Box>
    );
  }

  if (step === "instance") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="rgb(255,191,0)">
          <Text>DEPLOY</Text>
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold>┌─ Onflyt Pod Configuration</Text>
          <Text color="gray"> Choose instance size and replica count</Text>

          <Box marginTop={1} flexDirection="column">
            {INSTANCE_OPTIONS.map((option, idx) => (
              <Box key={option.id}>
                <Text color="gray"> </Text>
                <Text
                  bold={selectedInstanceIndex === idx}
                  color={selectedInstanceIndex === idx ? "cyan" : "gray"}
                >
                  {selectedInstanceIndex === idx ? "▸" : " "}[{idx + 1}]{" "}
                  {option.label.padEnd(10)}
                </Text>
                <Text color="gray">
                  {option.cpu} CPU, {option.ram} RAM, {option.disk} Disk
                </Text>
                <Text color="yellow"> - {option.hourly}</Text>
              </Box>
            ))}
          </Box>

          <Box marginTop={1}>
            <Text color="cyan"> │ Selected: </Text>
            <Text bold color="cyan">
              {INSTANCE_OPTIONS[selectedInstanceIndex].label}
            </Text>
            <Text color="gray">
              {" "}
              ({INSTANCE_OPTIONS[selectedInstanceIndex].cpu} CPU,{" "}
              {INSTANCE_OPTIONS[selectedInstanceIndex].ram} RAM)
            </Text>
          </Box>

          <Box marginTop={1}>
            <Text color="cyan"> └─ Replicas: </Text>
            <Text bold color="cyan">
              {replicas}
            </Text>
            <Text color="gray">
              {" "}
              (max{" "}
              {Math.min(
                limits.maxInstancesPerProject,
                INSTANCE_OPTIONS[selectedInstanceIndex].maxReplicas,
              )}
              )
            </Text>
          </Box>
        </Box>

        <Box marginTop={2}>
          <Text color="gray">
            {" "}
            ↑↓ Change instance ←→ Change replicas [Enter] Continue [Esc] Back
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === "env") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="rgb(255,191,0)">
          <Text>DEPLOY</Text>
        </Text>

        <Box marginTop={1} flexDirection="column">
          <Text bold>┌─ Environment Variables</Text>
          <Text color="gray"> Import from .env or add manually</Text>

          <Box marginTop={1}>
            <Text color="gray"> </Text>
            <Text bold color="cyan">
              [1]
            </Text>
            <Text color="gray"> Import from .env</Text>
          </Box>
          <Box>
            <Text color="gray"> </Text>
            <Text bold color="cyan">
              [2]
            </Text>
            <Text color="gray"> Add manually</Text>
          </Box>
          <Box>
            <Text color="gray"> </Text>
            <Text bold color="cyan">
              [3]
            </Text>
            <Text color="gray"> Skip (use existing)</Text>
          </Box>
        </Box>

        <Box marginTop={2}>
          <Text color="gray"> [1/2/3] Select option [Esc] Back</Text>
        </Box>

        {envMessage && (
          <Box marginTop={1}>
            <Text color={envMessage.includes("✓") ? "green" : "yellow"}>
              {envMessage}
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  if (step === "deploying") {
    const dots = ".".repeat(dotCount);
    const statusColors: Record<DeploymentStatus, string> = {
      queued: "yellow",
      building: "cyan",
      provisioning: "magenta",
      deployed: "green",
      failed: "red",
    };
    const statusLabels: Record<DeploymentStatus, string> = {
      queued: "QUEUED",
      building: "BUILDING",
      provisioning: "PROVISIONING",
      deployed: "DEPLOYED",
      failed: "FAILED",
    };
    const statusIcons: Record<DeploymentStatus, string> = {
      queued: "⏳",
      building: "🔨",
      provisioning: "⚙️",
      deployed: "✅",
      failed: "❌",
    };

    const progressPercent =
      uploadProgress.total > 0
        ? Math.round((uploadProgress.uploaded / uploadProgress.total) * 100)
        : 0;

    const getStageInfo = (): { icon: string; label: string; color: string } => {
      switch (deployStage) {
        case "starting":
          return { icon: "⏳", label: "Starting deployment", color: "cyan" };
        case "zipping":
          return { icon: "📦", label: "Creating ZIP archive", color: "cyan" };
        case "uploading":
          if (progressPercent >= 100) {
            return { icon: "✅", label: "Upload completed", color: "green" };
          }
          return {
            icon: "⬆️",
            label: `Uploading ${progressPercent}%`,
            color: "cyan",
          };
        case "deployed":
          return { icon: "✅", label: "Deployed", color: "green" };
        default:
          return { icon: "⏳", label: "Processing", color: "cyan" };
      }
    };

    const stageInfo = getStageInfo();

    const formatBytes = (bytes: number): string => {
      if (bytes === 0) return "0 B";
      const k = 1024;
      const sizes = ["B", "KB", "MB", "GB"];
      const i = Math.floor(Math.log(bytes) / Math.log(k));
      return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + " " + sizes[i];
    };

    const progressBar = (percent: number, width: number = 30): string => {
      const filled = Math.round((percent / 100) * width);
      const empty = width - filled;
      return "█".repeat(filled) + "░".repeat(empty);
    };

    const showProgressBar =
      deployStage === "uploading" && zipSize && progressPercent < 100;

    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="rgb(255,191,0)">
          <Text>DEPLOY</Text>
        </Text>

        <Box marginTop={2}>
          <Text bold color={stageInfo.color}>
            {stageInfo.icon} {stageInfo.label}
          </Text>
          <Text dimColor>{dots}</Text>
        </Box>

        {deployStage === "zipping" && (
          <Box marginTop={1}>
            <Text dimColor>Compressing files...</Text>
          </Box>
        )}

        {showProgressBar && (
          <Box marginTop={1} flexDirection="column">
            <Box>
              <Text dimColor>[{progressBar(progressPercent)}]</Text>
            </Box>
            <Box>
              <Text dimColor>
                {formatBytes(uploadProgress.uploaded)} /{" "}
                {formatBytes(uploadProgress.total)}
              </Text>
            </Box>
          </Box>
        )}

        <Box marginTop={2}>
          <Text bold color="cyan">
            Status:{" "}
          </Text>
          <Text bold color={statusColors[deploymentStatus]}>
            {statusIcons[deploymentStatus]} {statusLabels[deploymentStatus]}
          </Text>
          <Text dimColor>{dots}</Text>
        </Box>
        {deploymentId && (
          <Box>
            <Text bold color="cyan">
              ID:
            </Text>
            <Text> {deploymentId}</Text>
          </Box>
        )}
        <Box>
          <Text bold color="cyan">
            Project:
          </Text>
          <Text> {projectConfig?.name}</Text>
        </Box>

        {liveLogs.length > 0 && (
          <Box marginTop={2} flexDirection="column">
            <Text bold color="cyan">
              Build Logs:
            </Text>
            <Box
              flexDirection="column"
              marginTop={1}
              padding={1}
              borderStyle="round"
              borderDimColor
            >
              {liveLogs.slice(-15).map((log, idx) => (
                <Text key={idx} color="white">
                  {log}
                </Text>
              ))}
            </Box>
          </Box>
        )}

        {deploymentId && (
          <Box marginTop={2}>
            <Text color="gray">
              Run 'onflyt tail {deploymentId}' to watch logs
            </Text>
          </Box>
        )}
      </Box>
    );
  }

  if (step === "done") {
    return (
      <Box flexDirection="column" padding={1}>
        <Text bold color="rgb(255,191,0)">
          DEPLOYED!
        </Text>

        <Box
          marginTop={2}
          flexDirection="column"
          borderStyle="round"
          borderColor="green"
          padding={1}
        >
          <Text bold color="green">
            ✓ Deployment Successful
          </Text>

          <Box marginTop={1}>
            <Text bold color="cyan">
              ID:
            </Text>
            <Text> {deploymentId}</Text>
          </Box>

          <Box marginTop={1}>
            <Text bold color="cyan">
              Live URL:
            </Text>
            <Text bold color="white">
              {" "}
              {liveUrl}
            </Text>
          </Box>

          {previewUrl && (
            <Box marginTop={1}>
              <Text bold color="cyan">
                Preview:
              </Text>
              <Text color="white"> {previewUrl}</Text>
            </Box>
          )}

          {needsPod && (
            <Box marginTop={1}>
              <Text bold color="magenta">
                Onflyt Pod:
              </Text>
              <Text>
                {" "}
                {replicas}x {INSTANCE_OPTIONS[selectedInstanceIndex].label}
              </Text>
            </Box>
          )}
        </Box>

        <Box marginTop={2}>
          <Text color="gray">
            Run 'onflyt logs {deploymentId}' to view logs
          </Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export default Deploy;
