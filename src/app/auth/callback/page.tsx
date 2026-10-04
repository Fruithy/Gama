"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/client/api";
import { authConfigured, supabaseClient } from "@/lib/client/supabase";

/** OAuth / magic-link landing: exchange the Supabase session for a linked arcade session. */
export default function AuthCallbackPage() {
  const router = useRouter();
  const [msg, setMsg] = useState("Signing you in…");
  useEffect(() => {
    (async () => {
      if (!authConfigured()) return setMsg("Sign-in is not configured on this server.");
      try {
        const sb = await supabaseClient();
        const { data } = await sb.auth.getSession();
        const token = data.session?.access_token;
        if (!token) return setMsg("Sign-in link expired. Try again from your profile.");
        await api("/api/auth/link", { json: { accessToken: token } });
        router.replace("/me?linked=1");
      } catch {
        setMsg("Couldn't finish signing in. Try again.");
      }
    })();
  }, [router]);
  return <div className="grid min-h-[60dvh] place-items-center px-6 text-center font-display text-xl font-black">{msg}</div>;
}
