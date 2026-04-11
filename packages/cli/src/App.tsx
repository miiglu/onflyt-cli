import React from "react";
import { Text, Box } from "ink";

const App = () => {
  return (
    <Box flexDirection="column">
      <Text bold> ⬡ Onflyt CLI v0.1.4-beta</Text>
      <Text>Type onflyt --help for available commands</Text>
    </Box>
  );
};

export default App;
