import { RouterProvider } from "react-router-dom";

import { createRouter } from "./router";
import { MinerHostingProvider } from "@/protoOS/contexts/MinerHostingContext";
import { NatsProvider } from "@/protoOS/nats";

import "@/shared/styles/index.css";

const router = createRouter();

const Main = () => {
  return (
    <MinerHostingProvider>
      <NatsProvider>
        <RouterProvider router={router} />
      </NatsProvider>
    </MinerHostingProvider>
  );
};

export default Main;
