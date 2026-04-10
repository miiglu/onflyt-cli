import React, { useEffect, useState } from "react";
import { Text, Box, useInput } from "ink";
import { isLoggedIn, getConfig } from "../lib/config.js";
import { api } from "../lib/api.js";
import { Logo } from "../components/Loading.js";
import Spinner from "ink-spinner";

interface DeleteProps {
  projectId?: string;
  projectName?: string;
}

const Delete: React.FC<DeleteProps> = ({ projectId, projectName }) => {
  const [step, setStep] = useState<
    | "loading"
    | "loading-projects"
    | "team"
    | "select"
    | "confirm"
    | "deleting"
    | "done"
    | "error"
  >("loading");

  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);
  const [selectedTeamIndex, setSelectedTeamIndex] = useState(0);
  const [selectedProjectIndex, setSelectedProjectIndex] = useState(0);
  const [targetProject, setTargetProject] = useState<any>(null);
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

    if (step === "select") {
      if (key.upArrow) {
        setSelectedProjectIndex((i) => Math.max(0, i - 1));
      } else if (key.downArrow) {
        setSelectedProjectIndex((i) => Math.min(projects.length - 1, i + 1));
      } else if (key.return) {
        setTargetProject(projects[selectedProjectIndex]);
        setStep("confirm");
      } else if (key.escape) {
        setStep("team");
      }
    }

    if (step === "confirm") {
      if (input === "y" || input === "Y" || key.return) {
        deleteProject(targetProject.id);
      } else if (input === "n" || input === "N" || key.escape) {
        setStep("select");
      }
    }
  });

  useEffect(() => {
    if (!isLoggedIn()) {
      setErrorMsg("Not logged in. Run 'onflyt login' first.");
      setStep("error");
      return;
    }

    if (projectId) {
      setTargetProject({ id: projectId, name: projectName || projectId });
      setStep("confirm");
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
      setStep("select");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  };

  const deleteProject = async (projId: string) => {
    setStep("deleting");
    try {
      await api.delete(`/projects/${projId}`);
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
          <Text bold>Delete Project</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>Loading projects...</Text>
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

  if (step === "deleting") {
    return (
      <Box flexDirection="column">
        <Logo />
        <Box marginTop={1}>
          <Text>Deleting project...</Text>
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
            ✓ Project deleted successfully
          </Text>
        </Box>
      </Box>
    );
  }

  if (step === "team") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Delete Project</Text>
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

  if (step === "select") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Delete Project</Text>
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
              <Text dimColor> ({p.framework})</Text>
            </Box>
          ))}
        </Box>
      </Box>
    );
  }

  if (step === "confirm") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold color="red">
            ⚠ Confirm Delete
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text>
            Delete project: <Text bold>{targetProject?.name}</Text>?
          </Text>
        </Box>
        <Box marginTop={1}>
          <Text color="red">This action cannot be undone!</Text>
        </Box>
        <Box marginTop={2}>
          <Text>[Y] Yes, delete [N] Cancel</Text>
        </Box>
      </Box>
    );
  }

  return null;
};

export default Delete;
