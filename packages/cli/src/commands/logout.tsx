import React from "react";
import { Text, Box } from "ink";
import { getConfig, saveConfig } from "../lib/config.js";
import { Logo, ErrorDisplay, Success } from "../components/Loading.js";

const Logout: React.FC = () => {
  const config = getConfig();

  if (!config.token) {
    return <ErrorDisplay message="Not logged in. Nothing to logout from." />;
  }

  // Clear config
  saveConfig({});

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />
      <Box marginTop={1}>
        <Text bold color="green">
          ✓ Logged out successfully
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Token cleared from ~/.onflyt/config.json</Text>
      </Box>
    </Box>
  );
};

export default Logout;
