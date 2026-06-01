"use client";

import { useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useAuth } from "@/lib/auth";
import { ChatUnreadProvider } from "@/lib/chatUnread";
import { AppBar } from "@/components/AppBar";
import { BottomNav } from "@/components/BottomNav";
import { FullScreenLoader } from "@/components/Brand";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const isChat = pathname === "/chat";

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading || !user) return <FullScreenLoader />;

  return (
    <ChatUnreadProvider>
      <div className="mx-auto flex h-[100dvh] max-w-md flex-col bg-cream">
        <AppBar />
        <div className="flex min-h-0 flex-1 flex-col overflow-y-auto">{children}</div>
        {!isChat && <BottomNav />}
      </div>
    </ChatUnreadProvider>
  );
}
