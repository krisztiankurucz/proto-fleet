// Set VITE_DEV_CONSOLE_ENABLED=true in your .env file to enable the dev console.
// Vite eliminates this code from production builds when the flag is not set.
export const DEV_CONSOLE_ENABLED = import.meta.env.VITE_DEV_CONSOLE_ENABLED === "true";

export const NATS_WS_PORT = 9222;
export const NATS_WS_URL = `ws://${window.location.hostname}:${NATS_WS_PORT}`;

export const PSU_COUNT = 3;
export const VOLTAGE_STEP_MV = 250;
export const MAX_RAW_MESSAGES = 1000;
