import React, { useEffect, useState } from "react";
import { Text, Box, useInput } from "ink";
import { isLoggedIn, getConfig } from "../lib/config.js";
import { api } from "../lib/api.js";
import { Logo } from "../components/Loading.js";
import Spinner from "ink-spinner";

interface RollbackProps {
  deploymentId?: string;
}

const Rollback: React.FC<RollbackProps> = ({ deploymentId }) => {
  const [step, setStep] = useState<
    | "loading"
    | "loading-projects"
    | "loading-deployments"
    | "team"
    | "project"
    | "deploy"
    | "confirm"
    | "rolling"
    | "done"
    | "error"
  >("loading");

  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);

  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [selectedDeployIndex, setSelectedDeployIndex] = useState(0);

  const [targetProject, setTargetProject] = useState<any>(null);
  const [targetDeployment, setTargetDeployment] = useState<any>(null);
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

  useInput((input, key) => {
    if (input === "q" || input === "Q" || (key.ctrl && input === "c")) {
      process.exit(0);
    }

    if (step === "team") {
      if (key.upArrow) {
        setSelectedTeamIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedTeamIndex((i) => Math.min(teams.length - 1, i + 1));
      } else if (key.return) {
        setStep("loading-projects");
        loadProjects(teams[selectedTeamIndex].team.id);
      }
    }

    if (step === "project") {
      if (key.upArrow) {
        setSelectedProjectIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedProjectIndex((i) => Math.min(projects.length - 1, i + 1));
      } else if (key.return) {
        setStep("loading-deployments");
        loadDeploymentsForProject(projects[selectedProjectIndex]);
      } else if (key.escape) {
        setStep("team");
      }
    }

    if (step === "deploy") {
      if (key.upArrow) {
        setSelectedDeployIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedDeployIndex((i) => Math.min(deployments.length - 1, i + 1));
      } else if (key.return) {
        setTargetDeployment(deployments[selectedDeployIndex]);
        setStep("confirm");
      } else if (key.escape) {
        setStep("project");
      }
    }

    if (step === "confirm") {
      if (input === "y" || input === "Y" || key.return) {
        performRollback(targetDeployment.id, targetProject.id);
      } else if (input === "n" || input === "N" || key.escape) {
        setStep("deploy");
      }
    }
  });

  useEffect(() => {
    if (!isLoggedIn()) {
      setErrorMsg("Not logged in. Run 'onflyt login' first.");
      setStep("error");
      return;
    }

    if (deploymentId) {
      setErrorMsg(
        "Direct deployment rollback not yet supported. Please select from list.",
      );
      setStep("error");
      return;
    }

    loadTeams();
  }, []);

  const loadTeams = async () => {
    try {
      const config = getConfig();
      api.setToken(config.token!);
      const meData = await api.get<any>("/auth/me");
      const userTeams = meData.teams || [];

      if (userTeams.length === 0) {
        setErrorMsg("No teams found");
        setStep("error");
        return;
      }

      setTeams(userTeams);

      if (userTeams.length === 1) {
        setSelectedTeamIndex(0);
        setStep("loading-projects");
        loadProjects(userTeams[0].team.id);
      } else {
        setStep("team");
      }
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  };

  const loadProjects = async (teamId: string) => {
    try {
      const projectsRes = await api.get<any>(`/projects/team/${teamId}`);
      const teamProjects = projectsRes.projects || [];

      if (teamProjects.length === 0) {
        setErrorMsg("No projects found in this team");
        setStep("error");
        return;
      }

      setProjects(teamProjects);
      setSelectedProjectIndex(0);
      setStep("project");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  };

  const loadDeploymentsForProject = async (project: any) => {
    try {
      setTargetProject(project);
      const depsRes = await api.get<any>(`/deployments/${project.id}?limit=50`);
      const allDeployments = depsRes.deployments || [];

      if (allDeployments.length === 0) {
        setErrorMsg("No deployments found for this project");
        setStep("error");
        return;
      }

      setDeployments(allDeployments);
      setSelectedDeployIndex(0);
      setStep("deploy");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  };

  const performRollback = async (depId: string, projectId: string) => {
    setStep("rolling");
    try {
      await api.post(`/deployments/${projectId}/${depId}/activate`);
      setStep("done");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  };

  if (step === "loading") {
    return (
      <Box flexDirection="column">
        <Logo />
        <Box marginTop={1}>
          <Text>Loading...</Text>
        </Box>
      </Box>
    );
  }

  if (step === "loading-projects") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Rollback Deployment</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Loading projects...</Text>
        </Box>
        <Box marginTop={1}>
          <Spinner />
        </Box>
      </Box>
    );
  }

  if (step === "loading-deployments") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Rollback Deployment</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Loading deployments...</Text>
        </Box>
        <Box marginTop={1}>
          <Spinner />
        </Box>
      </Box>
    );
  }

  if (step === "error") {
    return (
      <Box flexDirection="column">
        <Logo />
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

  if (step === "rolling") {
    return (
      <Box flexDirection="column">
        <Logo />
        <Box marginTop={1}>
          <Text>Rolling back deployment...</Text>
        </Box>
      </Box>
    );
  }

  if (step === "done") {
    return (
      <Box flexDirection="column">
        <Logo />
        <Box marginTop={1}>
          <Text bold color="green">
            ✓ Rollback successful
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Run 'onflyt logs' to monitor progress</Text>
        </Box>
      </Box>
    );
  }

  if (step === "team") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Rollback Deployment</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 1/3: Select Team (↑↓ navigate, Enter select)
          </Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          {teams.map((t, idx) => (
            <Box key={t.team.id} marginTop={1}>
              <Text color={idx === selectedTeamIndex ? "cyan" : "gray"}>
                {idx === selectedTeamIndex ? "▶ " : "  "}
              </Text>
              <Text bold={idx === selectedTeamIndex}>{t.team.name}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (step === "project") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Rollback Deployment</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 2/3: Select Project - {teams[selectedTeamIndex]?.team.name}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>(↑↓ navigate, Enter select, Esc go back)</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          {projects.map((p, idx) => (
            <Box key={p.id} marginTop={1}>
              <Text color={idx === selectedProjectIndex ? "cyan" : "gray"}>
                {idx === selectedProjectIndex ? "▶ " : "  "}
              </Text>
              <Text bold={idx === selectedProjectIndex}>{p.name}</Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (step === "deploy") {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    const activeDepId = targetProject?.activeDeploymentId;

    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Rollback Deployment</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 3/3: Select Deployment - {targetProject?.name}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>(↑↓ navigate, Enter select, Esc go back)</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          {deployments.map((dep, idx) => {
            const isActive = dep.id === activeDepId;
            const statusColor = isActive
              ? "green"
              : dep.status === "live"
                ? "cyan"
                : "gray";
            const statusLabel = isActive
              ? " [ACTIVE]"
              : dep.status === "live"
                ? " [DEPLOYED]"
                : dep.status === "failed"
                  ? " [FAILED]"
                  : ` [${dep.status.toUpperCase()}]`;

            return (
              <Box key={dep.id} marginTop={1} flexDirection="column">
                <Box>
                  <Text color={idx === selectedDeployIndex ? "cyan" : "gray"}>
                    {idx === selectedDeployIndex ? "▶ " : "  "}
                  </Text>
                  <Text bold={idx === selectedDeployIndex}>
                    {dep.commitMessage || "Manual Upload"}
                  </Text>
                  <Text color={statusColor}>{statusLabel}</Text>
                </Box>
                <Box marginLeft={2}>
                  <Text dimColor>ID: {dep.id}</Text>
                </Box>
                <Box marginLeft={2}>
                  <Text dimColor>{formatDate(dep.createdAt)}</Text>
                </Box>
              </Box>
            );
          })}
        </Box>
      </Box>
    );
  }

  if (step === "confirm") {
    const isActive = targetDeployment?.id === targetProject?.activeDeploymentId;

    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold color="yellow">
            ⚠ Confirm Rollback
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            Project: <Text bold>{targetProject?.name}</Text>
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            Deployment:{" "}
            <Text bold>
              {targetDeployment?.commitMessage || "Manual Upload"}
            </Text>
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>ID: {targetDeployment?.id}</Text>
        </Box>
        {isActive && (
          <Box marginTop={1}>
            <Text color="yellow">
              ⚠ This is the currently active deployment
            </Text>
          </Box>
        )}
        <Box marginTop={2}>
          <Text>[Y] Yes, rollback [N] Cancel</Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export default Rollback;
