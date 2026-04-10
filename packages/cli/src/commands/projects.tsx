import React, { useEffect, useState } from "react";
import { Text, Box, useInput } from "ink";
import { isLoggedIn, getConfig } from "../lib/config.js";
import { api } from "../lib/api.js";
import { Logo } from "../components/Loading.js";
import Spinner from "ink-spinner";
import { FRAMEWORKS } from "../shared";

type Step =
  | "loading"
  | "loading-projects"
  | "team"
  | "project"
  | "display"
  | "error";

const ProjectsList = () => {
  const [step, setStep] = useState<Step>("loading");

  const [teams, setTeams] = useState<any[]>([]);
  const [projects, setProjects] = useState<any[]>([]);

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
        setStep("display");
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

      setProjects(teamProjects);
      setSelectedProjectIndex(0);
      setStep("project");
    } catch (err: any) {
      setErrorMsg(err.message);
      setStep("error");
    }
  };

  if (step === "loading" || step === "loading-projects") {
    return (
      <Box flexDirection="column" padding={1}>
        <Logo />
        <Box marginTop={1}>
          <Text bold>Projects</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Loading{step === "loading-projects" ? " projects..." : "..."}
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
          <Text bold>Projects</Text>
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
          <Text bold>Projects</Text>
        </Box>
        <Box marginTop={1}>
          <Text dimColor>
            Step 2/2: Select Project - {teams[selectedTeamIndex]?.team.name}
          </Text>
        </Box>
        <Box>
          <Text dimColor>(↑↓ navigate, Enter view details, Esc go back)</Text>
        </Box>

        <Box marginTop={1} flexDirection="column">
          {projects.length === 0 ? (
            <Text dimColor>No projects in this team</Text>
          ) : (
            projects.map((p, idx) => (
              <Box key={p.id} marginTop={1}>
                <Text color={idx === selectedProjectIndex ? "cyan" : "gray"}>
                  {idx === selectedProjectIndex ? "▶ " : "  "}
                </Text>
                <Text bold={idx === selectedProjectIndex}>{p.name}</Text>
                <Text dimColor>
                  {" "}
                  ({FRAMEWORKS[p.framework]?.label || p.framework})
                </Text>
                <Text dimColor>
                  {" "}
                  - {p.status === "active" ? "●" : "○"} {p.status}
                </Text>
              </Box>
            ))
          )}
        </Box>
      </Box>
    );
  }

  const selectedProject = projects[selectedProjectIndex];

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />

      <Box marginTop={1}>
        <Text bold>Project Details</Text>
      </Box>
      <Box>
        <Text dimColor>
          {teams[selectedTeamIndex]?.team.name} / {selectedProject?.name}
        </Text>
      </Box>

      {selectedProject && (
        <Box
          marginTop={1}
          flexDirection="column"
          borderStyle="round"
          borderDimColor
          paddingX={1}
        >
          <Box marginTop={1}>
            <Text bold>Name:</Text>
            <Text> {selectedProject.name}</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold>Framework:</Text>
            <Text>
              {" "}
              {FRAMEWORKS[selectedProject.framework]?.label ||
                selectedProject.framework}
            </Text>
          </Box>
          <Box marginTop={1}>
            <Text bold>Status:</Text>
            <Text> {selectedProject.status}</Text>
          </Box>
          <Box marginTop={1}>
            <Text bold>ID:</Text>
            <Text dimColor> {selectedProject.id}</Text>
          </Box>
          {selectedProject.gitRepoUrl && (
            <Box marginTop={1}>
              <Text bold>Repository:</Text>
              <Text color="cyan"> {selectedProject.gitRepoUrl}</Text>
            </Box>
          )}
          {selectedProject.outputDirectory && (
            <Box marginTop={1}>
              <Text bold>Output:</Text>
              <Text dimColor> {selectedProject.outputDirectory}</Text>
            </Box>
          )}
        </Box>
      )}

      <Box marginTop={1}>
        <Text dimColor>↑↓ navigate projects | Esc go back</Text>
      </Box>
    </Box>
  );
};

export default ProjectsList;
