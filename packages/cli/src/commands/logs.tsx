import React, { useEffect, useState } from "react";
import { Text, Box, useInput } from "ink";
import { isLoggedIn, getConfig } from "../lib/config.js";
import { api } from "../lib/api.js";
import { Logo } from "../components/Loading.js";
import Spinner from "ink-spinner";

interface LogsProps {
  deploymentId?: string;
  live?: boolean;
}

type Step =
  | "loading"
  | "loading-projects"
  | "loading-deployments"
  | "team"
  | "project"
  | "deploy"
  | "displaying"
  | "streaming"
  | "error"
  | "done";

const Logs: React.FC<LogsProps> = ({ deploymentId, live = false }) => {
  const [step, setStep] = useState<Step>("loading");

  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [deployments, setDeployments] = useState<any[]>([]);

  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [selectedDeployIndex, setSelectedDeployIndex] = useState(0);

  const [targetProject, setTargetProject] = useState<any>(null);
  const [targetDeploymentId, setTargetDeploymentId] = useState<string | null>(
    null,
  );

  const [logs, setLogs] = useState<string[]>([]);
  const [errorMsg, setErrorMsg] = useState("");
  const [dotCount, setDotCount] = useState(0);

  useEffect(() => {
    const handleSigInt = () => process.exit(0);
    process.on("SIGINT", handleSigInt);
    return () => {
      process.off("SIGINT", handleSigInt);
    };
  }, []);

  useEffect(() => {
    if (step === "done") {
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
        loadDeployments(projects[selectedProjectIndex]);
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
        const dep = deployments[selectedDeployIndex];
        setTargetDeploymentId(dep.id);
        setTargetProject(targetProject);
        if (live) {
          startLiveStream(dep.id);
        } else {
          fetchStoredLogs(dep.id);
        }
      } else if (key.escape) {
        setStep("project");
      }
    }
  });

  useEffect(() => {
    if (step !== "streaming") return;

    const interval = setInterval(() => {
      setDotCount((c) => (c + 1) % 4);
    }, 500);

    return () => clearInterval(interval);
  }, [step]);

  useEffect(() => {
    if (!isLoggedIn()) {
      setErrorMsg("Not logged in. Run 'onflyt login' first.");
      setStep("error");
      return;
    }

    if (deploymentId) {
      setTargetDeploymentId(deploymentId);
      if (live) {
        startLiveStream(deploymentId);
      } else {
        fetchStoredLogs(deploymentId);
      }
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

  const startLiveStream = (depId: string) => {
    setStep("streaming");
    setLogs([]);

    import("../lib/deploy-api.js").then(({ streamLogs }) => {
      const cancel = streamLogs(
        depId,
        (log: string) => {
          setLogs((prev) => [...prev.slice(-500), log]);
        },
        () => {
          console.log("\n\x1b[33m⚠ Live logs stream ended\x1b[0m");
          setStep("done");
        },
      );

      return () => {
        cancel();
      };
    });
  };

  const fetchStoredLogs = (depId: string) => {
    setStep("loading");
    import("../lib/deploy-api.js").then(({ getStoredLogs }) => {
      getStoredLogs(depId, { limit: 200 })
        .then((result: any) => {
          setLogs(
            result.logs.map(
              (l: any) =>
                `[${new Date(l.timestamp).toISOString()}] [${l.level.toUpperCase()}] ${l.message}`,
            ),
          );
          setStep("displaying");
        })
        .catch((err: any) => {
          setErrorMsg(err.message || "Failed to fetch logs");
          setStep("error");
        });
    });
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
          <Text bold>View Logs</Text>
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
          <Text bold>View Logs</Text>
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
          <Text bold>View Logs</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 2/3: Select Project - {teams[selectedTeamIndex]?.team.name}
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

  if (step === "deploy") {
    const formatDate = (dateStr: string) => {
      const date = new Date(dateStr);
      return date.toLocaleDateString() + " " + date.toLocaleTimeString();
    };

    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>View Logs</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 3/3: Select Deployment - {targetProject?.name}
          </Text>
        </Box>
        <Box>
          <Text dimColor>(↑↓ navigate, Enter select, Esc go back)</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          {deployments.map((dep, idx) => (
            <Box key={dep.id} marginTop={1} flexDirection="column">
              <Box>
                <Text color={idx === selectedDeployIndex ? "cyan" : "gray"}>
                  {idx === selectedDeployIndex ? "▶ " : "  "}
                </Text>
                <Text bold={idx === selectedDeployIndex}>
                  {dep.commitMessage || "Manual Upload"}
                </Text>
                <Text dimColor> [{dep.status}]</Text>
              </Box>
              <Box marginLeft={2}>
                <Text dimColor>ID: {dep.id}</Text>
              </Box>
              <Box marginLeft={2}>
                <Text dimColor>{formatDate(dep.createdAt)}</Text>
              </Box>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  const dots = ".".repeat(dotCount);

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />

      <Box marginTop={1}>
        <Text bold color="cyan">
          Deployment:
        </Text>
        <Text> {targetDeploymentId}</Text>
        {step === "streaming" && <Text dimColor> {dots}</Text>}
        {step === "streaming" && (
          <Box marginLeft={2}>
            <Text dimColor>(Ctrl+C to exit)</Text>
          </Box>
        )}
      </Box>

      <Box marginTop={1}>
        <Text dimColor>
          {live
            ? "Streaming live logs..."
            : `Showing last ${logs.length} log entries`}
        </Text>
      </Box>

      <Box
        marginTop={1}
        flexDirection="column"
        borderStyle="round"
        borderDimColor
        paddingX={1}
      >
        {logs.length === 0 ? (
          <Text dimColor>No logs available</Text>
        ) : (
          logs.map((log, idx) => (
            <Text key={idx} wrap="wrap">
              {log}
            </Text>
          ))
        )}
      </Box>
    </Box>
  );
};

export default Logs;
