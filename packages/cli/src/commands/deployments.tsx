import React, { useEffect, useState } from "react";
import { Text, Box, useInput } from "ink";
import { isLoggedIn, getConfig } from "../lib/config.js";
import { api } from "../lib/api.js";
import { Logo } from "../components/Loading.js";
import Spinner from "ink-spinner";

interface DeploymentsProps {
  projectName?: string;
}

type Step =
  | "loading"
  | "loading-projects"
  | "loading-deployments"
  | "team"
  | "project"
  | "display"
  | "error";

const Deployments: React.FC<DeploymentsProps> = ({ projectName }) => {
  const [step, setStep] = useState<Step>("loading");

  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);
  const [targetProject, setTargetProject] = useState<any>(null);

  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [errorMsg, setErrorMsg] = useState("");

  useEffect(() => {
    const handleSigInt = () => process.exit(0);
    process.on("SIGINT", handleSigInt);
    return () => {
      process.off("SIGINT", handleSigInt);
    };
  }, []);

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
        loadDeployments(projects[selectedProjectIndex]);
      } else if (key.escape) {
        setStep("team");
      }
    }
  });

  useEffect(() => {
    if (!isLoggedIn()) {
      setErrorMsg("Not logged in. Run 'onflyt login' first.");
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

  const loadDeployments = async (project: any) => {
    try {
      setTargetProject(project);
      const depsRes = await api.get<any>(`/deployments/${project.id}?limit=50`);
      const allDeployments = depsRes.deployments || [];

      setDeployments(allDeployments);
      setStep("display");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  };

  if (
    step === "loading" ||
    step === "loading-projects" ||
    step === "loading-deployments"
  ) {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Deployments</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Loading
            {step === "loading-projects"
              ? " projects..."
              : step === "loading-deployments"
                ? " deployments..."
                : "..."}
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            <Spinner />
          </Text>
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

  if (step === "team") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Deployments</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 1/2: Select Team (↑↓ navigate, Enter select)
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
          <Text bold>Deployments</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 2/2: Select Project - {teams[selectedTeamIndex]?.team.name}
          </Text>
        </Box>
        <Box>
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

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString() + " " + date.toLocaleTimeString();
  };

  const getStatusColor = (status: string) => {
    switch (status.toLowerCase()) {
      case "live":
      case "deployed":
      case "success":
        return "green";
      case "building":
      case "queued":
      case "provisioning":
        return "cyan";
      case "failed":
        return "red";
      default:
        return "gray";
    }
  };

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />

      <Box marginTop={1}>
        <Text bold>Deployments</Text>
      </Box>
      <Box>
        <Text dimColor>
          {targetProject?.name} - {teams[selectedTeamIndex]?.team.name}
        </Text>
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {deployments.length === 0
            ? "No deployments found"
            : `Found ${deployments.length} deployment(s)`}
        </Text>
      </Box>

      <Box marginTop={1} flexDirection="column">
        {deployments.map((dep, idx) => (
          <Box
            key={dep.id}
            marginTop={1}
            flexDirection="column"
            borderStyle="round"
            borderDimColor
            paddingX={1}
          >
            <Box>
              <Text bold color={getStatusColor(dep.status)}>
                {dep.status.toUpperCase()}
              </Text>
              <Text dimColor> - {formatDate(dep.createdAt)}</Text>
            </Box>
            <Box>
              <Text dimColor>ID: {dep.id}</Text>
            </Box>
            {dep.commitMessage && (
              <Box>
                <Text dimColor wrap="wrap">
                  {dep.commitMessage}
                </Text>
              </Box>
            )}
            {dep.runtimeStatus && (
              <Box>
                <Text dimColor>Runtime: {dep.runtimeStatus}</Text>
              </Box>
            )}
          </Box>
        ))}
      </Box>

      <Box marginTop={2}>
        <Text dimColor>Press Q or Ctrl+C to exit</Text>
      </Box>
    </Box>
  );
};

export default Deployments;
