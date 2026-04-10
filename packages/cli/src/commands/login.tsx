import React from "react";
import { Text, Box } from "ink";
import Spinner from "ink-spinner";
import open from "open";
import { API_URL, getConfig, saveConfig } from "../lib/config.js";
import { Logo } from "../components/Loading.js";

interface LoginProps {
  openBrowser?: boolean;
}

const LoadingSpinner = () => (
  <Box>
    <Spinner type="dots" />
    <Text> Starting login...</Text>
  </Box>
);

const AlreadyLoggedIn: React.FC<{ user: { name: string; email?: string } }> = ({
  user,
}) => (
  <Box flexDirection="column" padding={1}>
    <Text bold color="green">
      ✓ Welcome back, {user.name}!
    </Text>
    <Box marginTop={1}>
      <Text dimColor>Email: {user.email}</Text>
    </Box>
    <Box marginTop={1}>
      <Text dimColor>Run "onflyt logout" to sign out</Text>
    </Box>
  </Box>
);

const LoginSuccess: React.FC<{ user: { name: string } }> = ({ user }) => (
  <Box flexDirection="column" padding={1}>
    <Text bold color="green">
      ✓ Logged in successfully!
    </Text>
    <Box marginTop={1}>
      <Text>Welcome, {user.name}!</Text>
    </Box>
  </Box>
);

const LoginError: React.FC<{ error: string }> = ({ error }) => (
  <Box flexDirection="column" padding={1}>
    <Text bold color="red">
      ✖ Login failed
    </Text>
    <Text color="red">{error}</Text>
  </Box>
);

interface DeviceData {
  user_code: string;
  verification_uri: string;
  device_code: string;
  interval: number;
}

const Login: React.FC<LoginProps> = ({ openBrowser = true }) => {
  const [deviceData, setDeviceData] = React.useState<DeviceData | null>(null);
  const [error, setError] = React.useState<string | null>(null);
  const [successUser, setSuccessUser] = React.useState<{
    name: string;
    email?: string;
  } | null>(null);
  const [checkedLogin, setCheckedLogin] = React.useState(false);
  const [wasAlreadyLoggedIn, setWasAlreadyLoggedIn] = React.useState(false);
  const browserOpened = React.useRef(false);

  // Check if already logged in
  React.useEffect(() => {
    const config = getConfig();
    if (config.token && config.user) {
      setSuccessUser(config.user);
      setWasAlreadyLoggedIn(true);
    }
    setCheckedLogin(true);
  }, []);

  React.useEffect(() => {
    if (browserOpened.current || !checkedLogin || successUser) return;
    browserOpened.current = true;

    const startAuth = async () => {
      try {
        // Step 1: Get device code from our API
        const deviceRes = await fetch(`${API_URL}/auth/device/code`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
        });

        const deviceData = await deviceRes.json();

        if (!deviceRes.ok || !deviceData.success) {
          setError(deviceData.error || "Failed to get device code");
          return;
        }

        setDeviceData({
          user_code: deviceData.user_code,
          verification_uri: deviceData.verification_uri,
          device_code: deviceData.device_code,
          interval: deviceData.interval || 5,
        });

        // Open browser if enabled
        if (openBrowser) {
          try {
            await open(deviceData.verification_uri, { wait: true });
          } catch {
            // Browser might not open in headless environment
          }
        }

        // Step 2: Poll for token
        let currentInterval = (deviceData.interval || 5) * 1000;
        let remainingAttempts = 150;

        while (remainingAttempts > 0) {
          await new Promise((resolve) => setTimeout(resolve, currentInterval));
          remainingAttempts--;

          const tokenRes = await fetch(`${API_URL}/auth/device/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ device_code: deviceData.device_code }),
          });

          const tokenData = await tokenRes.json();

          if (
            tokenData.success &&
            tokenData.status === "authorized" &&
            tokenData.token
          ) {
            saveConfig({
              ...getConfig(),
              token: tokenData.token,
              user: tokenData.user,
              lastLogin: new Date().toISOString(),
            });
            setSuccessUser(tokenData.user);
            return;
          }

          if (!tokenData.success && tokenData.error) {
            if (tokenData.error === "authorization_pending") {
              continue;
            } else if (tokenData.error === "slow_down") {
              currentInterval += 5000;
              continue;
            } else {
              setError(tokenData.error);
              return;
            }
          }
        }

        setError("Authorization timeout");
      } catch (err: any) {
        setError(err.message || "Failed to start login");
      }
    };

    startAuth();
  }, [checkedLogin, successUser]);

  if (!checkedLogin) return <LoadingSpinner />;
  if (successUser && wasAlreadyLoggedIn)
    return <AlreadyLoggedIn user={successUser} />;
  if (successUser) return <LoginSuccess user={successUser} />;
  if (error) return <LoginError error={error} />;
  if (!deviceData) return <LoadingSpinner />;

  return (
    <Box flexDirection="column" padding={1}>
      <Logo />
      <Box marginTop={1}>
        <Text bold>Login to Onflyt</Text>
      </Box>
      <Box marginTop={1}>
        <Text>Visit: </Text>
        <Text color="cyan" underline>
          {deviceData.verification_uri}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Text>Enter code: </Text>
        <Text bold color="green">
          {deviceData.user_code}
        </Text>
      </Box>
      <Box marginTop={1}>
        <Spinner type="dots" />
        <Text> Waiting for authorization...</Text>
      </Box>
      <Box marginTop={1}>
        <Text dimColor>Press Ctrl+C to cancel</Text>
      </Box>
    </Box>
  );
};

export default Login;
