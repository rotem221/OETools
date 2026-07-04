import { useQuery } from "@tanstack/react-query";
import { api } from "@/lib/api/client";

export function useBackups(udid?: string) {
  return useQuery({
    queryKey: ["backups", udid ?? "all"],
    queryFn: async () => {
      const res = await api.listBackups(udid);
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });
}
