import { Outlet } from "react-router-dom";
import { Sidebar } from "@/components/sidebar/sidebar";
import { Topbar } from "@/components/topbar/topbar";
import { JobDrawer } from "@/features/jobs/job-drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

export function AppShell() {
  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar />
        <ScrollArea className="flex-1">
          <main className="mx-auto w-full max-w-6xl px-6 py-6">
            <Outlet />
          </main>
        </ScrollArea>
      </div>
      <JobDrawer />
    </div>
  );
}
