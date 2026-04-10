import React from "react";
import { Text, Box } from "ink";
import { getConfig, isLoggedIn } from "../lib/config.js";
import { Logo, ErrorDisplay } from "../components/Loading.js";

const WhoAmI: React.FC = () => {
  const config = getConfig();

  if (!isLoggedIn()) {
    return <ErrorDisplay message="Not logged in. Run 'onflyt login' first." />;
  }

  const { user, token, lastLogin } = config;

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />
      <Box marginTop={1}>
        <Text bold>Logged in as:</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Name: </Text>
        <Text bold>{user?.name || "Unknown"}</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Email: </Text>
        <Text>{user?.email}</Text>
      </Box>
      {user?.avatar && (
        <Box marginTop={1}>
          <Text dimColor>Avatar: {user.avatar}</Text>
        </Box>
      )}
      <Box marginTop={1}>
        <Text dimColor>User ID: {user?.id}</Text>
      </Box>
      {lastLogin && (
        <Box marginTop={1}>
          <Text dimColor>
            Last login: {new Date(lastLogin).toLocaleString()}
          </Text>
        </Box>
      )}
    </Box>
  );
};

export default WhoAmI;
