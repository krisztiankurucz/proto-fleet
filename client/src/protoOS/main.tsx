import { RouterProvider } from "react-router-dom";

import { createRouter } from "./router";
import { MinerHostingProvider } from "@/protoOS/contexts/MinerHostingContext";
import { NatsAvailabilityProvider, NatsGate } from "@/protoOS/nats";

import "@/shared/styles/index.css";

const router = createRouter();

const Main = () => {
  return (
    <MinerHostingProvider>
      <NatsAvailabilityProvider>
        <NatsGate>
          <RouterProvider router={router} />
        </NatsGate>
      </NatsAvailabilityProvider>
    </MinerHostingProvider>
  );
};

export default Main;
