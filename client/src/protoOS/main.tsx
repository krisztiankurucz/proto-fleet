import { RouterProvider } from "react-router-dom";

import { createRouter } from "./router";
import { MinerHostingProvider } from "@/protoOS/contexts/MinerHostingContext";
import { StreamingTelemetryRunner } from "@/protoOS/features/kpis/streaming";
import { NatsAvailabilityProvider, NatsGate } from "@/protoOS/nats";

import "@/shared/styles/index.css";

const router = createRouter();

const Main = () => {
  return (
    <MinerHostingProvider>
      <NatsAvailabilityProvider>
        <NatsGate>
          {/* Keep the live telemetry tail filling on every route, not just the chart pages. */}
          <StreamingTelemetryRunner />
          <RouterProvider router={router} />
        </NatsGate>
      </NatsAvailabilityProvider>
    </MinerHostingProvider>
  );
};

export default Main;
