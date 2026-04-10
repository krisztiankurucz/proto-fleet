import { RouterProvider } from "react-router-dom";

import { createRouter } from "./router";
import { MinerHostingProvider } from "@/protoOS/contexts/MinerHostingContext";
import { DevConsoleAvailabilityProvider } from "@/protoOS/features/devConsole/DevConsoleAvailabilityProvider";

import "@/shared/styles/index.css";

const router = createRouter();

const Main = () => {
  return (
    <MinerHostingProvider>
      <DevConsoleAvailabilityProvider>
        <RouterProvider router={router} />
      </DevConsoleAvailabilityProvider>
    </MinerHostingProvider>
  );
};

export default Main;
