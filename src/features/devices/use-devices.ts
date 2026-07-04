import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { api } from "@/lib/api/client";
import { useAppStore } from "@/lib/store/app-store";

/** Poll connected devices and keep the global store in sync. */
export function useDevices(pollMs = 8000) {
  const setDevices = useAppStore((s) => s.setDevices);

  const query = useQuery({
    queryKey: ["devices"],
    queryFn: async () => {
      const res = await api.listDevices();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
    refetchInterval: pollMs,
    refetchIntervalInBackground: false,
    refetchOnWindowFocus: false,
    staleTime: pollMs,
  });

  useEffect(() => {
    if (query.data) setDevices(query.data);
  }, [query.data, setDevices]);

  return query;
}

export function useDeviceInfo(udid: string | null) {
  return useQuery({
    queryKey: ["device-info", udid],
    enabled: !!udid,
    queryFn: async () => {
      const res = await api.getDeviceInfo(udid!);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });
}
