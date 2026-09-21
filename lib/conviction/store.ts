import { LaunchRecord } from "@/types/conviction";

// Very simple in-memory store for the hackathon MVP.
// Later this can be replaced by a real database or on-chain data.

let launches: LaunchRecord[] = [];

export const launchStore = {
  getAll(): LaunchRecord[] {
    return launches;
  },

  getById(id: string): LaunchRecord | undefined {
    return launches.find((l) => l.id === id);
  },

  add(launch: LaunchRecord) {
    launches = [launch, ...launches];
  },

  clear() {
    launches = [];
  },
};