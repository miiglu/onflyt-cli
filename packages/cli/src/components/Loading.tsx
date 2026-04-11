import React from "react";
import { Text, Box } from "ink";

const bigText = (str: string) => {
  return str
    .split("")
    .map((c) => {
      const code = c.toUpperCase().charCodeAt(0);
      if (code >= 65 && code <= 90) {
        return String.fromCharCode(0xff21 + code - 65);
      }
      return c;
    })
    .join("");
};

export const Logo: React.FC = () => (
  <Box flexDirection="column">
    <Box alignItems="center">
      <Text color="rgb(255,191,0)"> ⬡ </Text>
      <Text bold color="rgb(255,191,0)">
        {bigText("Onflyt")}
      </Text>
      <Text> </Text>
      <Text bold color="black" backgroundColor="rgb(255,191,0)">
        {" "}
        v0.1.3-beta{" "}
      </Text>
    </Box>
  </Box>
);
interface LoadingProps {
  message: string;
}

export const Loading: React.FC<LoadingProps> = ({ message }) => (
  <Box flexDirection="column">
    <Logo />
    <Box marginTop={1}>
      <Text>{message}</Text>
    </Box>
  </Box>
);

export const ErrorDisplay: React.FC<{ message: string }> = ({ message }) => (
  <Box flexDirection="column">
    <Logo />
    <Box marginTop={1}>
      <Text bold color="red">
        ✖ Error
      </Text>
    </Box>
    <Box marginTop={1}>
      <Text color="red">{message}</Text>
    </Box>
  </Box>
);

export const Success: React.FC<{ message: string }> = ({ message }) => (
  <Box flexDirection="column">
    <Logo />
    <Box marginTop={1}>
      <Text bold color="green">
        ✓ {message}
      </Text>
    </Box>
  </Box>
);
