import React, { useEffect, useState } from "react";
import { api } from "../lib/api.js";
import { getConfig, isLoggedIn } from "../lib/config.js";
import { Logo, ErrorDisplay } from "../components/Loading.js";

interface Team {
  teamId: string;
  role: string;
  team: {
    id: string;
    name: string;
    slug: string;
    createdAt: string;
    plan: string;
  };
}

const MAX_RETRIES = 3;

const Teams = () => {
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [teams, setTeams] = useState<Team[]>([]);

  useEffect(() => {
    if (state !== "done") return;

    console.log("\n");
    console.log("  Your Teams\n");
    console.log("  " + "─".repeat(50));

    if (teams.length === 0) {
      console.log("  No teams found. Create a team from the dashboard.");
      console.log("");
      return;
    }

    teams.forEach((team, index) => {
      const isDefault = index === 0;
      console.log(
        `  ${index + 1}. ${team.team.name} ${isDefault ? "(default)" : ""}`,
      );
      console.log(`     Role: ${team.role}`);
      console.log(`     ID: ${team.team.id}`);
      console.log(`     Slug: ${team.team.slug}`);
      console.log(`     Plan: ${team.team.plan}`);
      console.log(
        `     Created: ${new Date(team.team.createdAt).toLocaleDateString()}`,
      );
      console.log("");
    });

    console.log("  " + "─".repeat(50));
    console.log("\n  Use --team flag: onflyt deploy --team tm_xxx\n");
  }, [state, teams]);

  useEffect(() => {
    if (!isLoggedIn()) {
      setErrorMsg("Not logged in. Run 'onflyt login' first.");
      setState("error");
      return;
    }

    const fetchTeams = async () => {
      let attempt = 0;

      const attemptFetch = async (): Promise<any> => {
        attempt++;
        try {
          console.log(
            `\n  Fetching teams...${attempt > 1 ? ` (retry ${attempt}/${MAX_RETRIES})` : ""}\n`,
          );

          const config = getConfig();
          api.setToken(config.token!);
          const meData = await api.get<any>("/auth/me");
          const userTeams: Team[] = meData.teams || [];
          setTeams(userTeams);
          setState("done");
          return meData;
        } catch (err: any) {
          if (attempt < MAX_RETRIES) {
            setRetryCount(attempt);
            return attemptFetch();
          }
          throw err;
        }
      };

      try {
        await attemptFetch();
      } catch (err: any) {
        setErrorMsg(err.message || "Failed to fetch teams");
        setState("error");
      }
    };

    fetchTeams();
  }, []);

  if (state === "loading") {
    return null;
  }

  if (state === "error") {
    return <ErrorDisplay message={errorMsg} />;
  }

  return null;
};

export default Teams;
