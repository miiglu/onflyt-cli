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
    plan?: string;
  };
}

interface Balance {
  balanceUSD: number;
  balanceFormatted: string;
}

interface CreditDisplay {
  team: Team;
  balance: Balance;
}

const MAX_RETRIES = 3;

const Credits = () => {
  const [state, setState] = useState<"loading" | "error" | "done">("loading");
  const [errorMsg, setErrorMsg] = useState("");
  const [retryCount, setRetryCount] = useState(0);
  const [credits, setCredits] = useState<CreditDisplay[]>([]);

  useEffect(() => {
    if (state !== "done") return;

    console.log("\n  Credits Balance\n");
    console.log("  " + "─".repeat(50));

    credits.forEach((item) => {
      const { team, balance } = item;
      const isLow = balance.balanceUSD < 5;
      const plan = team.team.plan || "free";

      console.log(`\n  ${team.team.name} (${plan})`);

      if (isLow) {
        console.log(
          `  \x1b[33m  Credits: ${balance.balanceFormatted} ⚠ Low credits\x1b[0m`,
        );
      } else {
        console.log(
          `  \x1b[32m  Credits: ${balance.balanceFormatted} ✓\x1b[0m`,
        );
      }
    });

    console.log("\n  " + "─".repeat(50));
    console.log("\n  Run 'onflyt add-credits' to add more credits.\n");
  }, [state, credits]);

  useEffect(() => {
    if (!isLoggedIn()) {
      setErrorMsg("Not logged in. Run 'onflyt login' first.");
      setState("error");
      return;
    }

    const fetchCredits = async () => {
      let attempt = 0;

      const attemptFetch = async () => {
        attempt++;
        try {
          console.log(
            `\n  Fetching credits...${attempt > 1 ? ` (retry ${attempt}/${MAX_RETRIES})` : ""}\n`,
          );

          const config = getConfig();
          api.setToken(config.token!);

          const meData = await api.get<any>("/auth/me");
          const userTeams: Team[] = meData.teams || [];

          if (userTeams.length === 0) {
            console.log("\n  No teams found.\n");
            console.log("  You don't have any teams yet.\n");
            return;
          }

          const balancesData: Record<string, Balance> = {};

          await Promise.all(
            userTeams.map(async (team: Team) => {
              try {
                const balanceData = await api.get<any>(
                  `/billing/balance?teamId=${team.team.id}`,
                );
                balancesData[team.team.id] = balanceData.data || balanceData;
              } catch {
                balancesData[team.team.id] = {
                  balanceUSD: 0,
                  balanceFormatted: "$0.00",
                };
              }
            }),
          );

          const creditDisplay: CreditDisplay[] = userTeams.map((team) => ({
            team,
            balance: balancesData[team.team.id] || {
              balanceUSD: 0,
              balanceFormatted: "$0.00",
            },
          }));

          setCredits(creditDisplay);
          setState("done");
        } catch (err) {
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
        setErrorMsg(err.message || "Failed to fetch credits");
        setState("error");
      }
    };

    fetchCredits();
  }, []);

  if (state === "loading") {
    return null;
  }

  if (state === "error") {
    return <ErrorDisplay message={errorMsg} />;
  }

  return null;
};

export default Credits;
