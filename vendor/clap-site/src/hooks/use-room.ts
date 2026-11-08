import { useSyncExternalStore } from "react";
import { roomClient } from "@/lib/roomClient";

export const useRoom = () => useSyncExternalStore(roomClient.subscribe, roomClient.snapshot);
