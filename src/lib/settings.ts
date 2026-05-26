import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import heroImg from "@/assets/hero.jpg";

export type HeroSettings = {
  title: string;
  subtitle: string;
  badge: string;
  imageUrl: string;
};

const defaultSettings: HeroSettings = {
  title: "Mats woven slowly, to live with you for years.",
  subtitle: "A collection of natural-fibre floor mats, yoga mats, doormats and table linens — each piece worked on a wooden loom by a single pair of hands.",
  badge: "Small batch · Handwoven",
  imageUrl: heroImg,
};

export function useHeroSettings() {
  const [settings, setSettings] = useState<HeroSettings>(defaultSettings);
  const [isLoaded, setIsLoaded] = useState(false);

  useEffect(() => {
    async function loadSettings() {
      try {
        const res = await fetch("/api/site-settings?key=hero");
        if (res.ok) {
          const data = await res.json();
          if (data?.success && data?.value) {
            setSettings({ ...defaultSettings, ...data.value });
          }
        }
      } catch (e) {
        console.error("[useHeroSettings load error]", e);
      } finally {
        setIsLoaded(true);
      }
    }
    loadSettings();
  }, []);

  const updateSettings = async (newSettings: Partial<HeroSettings>) => {
    const updated = { ...settings, ...newSettings };
    setSettings(updated);

    try {
      const { data } = await supabase.auth.getSession();
      const token = data?.session?.access_token;
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (token) headers["Authorization"] = `Bearer ${token}`;

      const res = await fetch("/api/admin/site-settings", {
        method: "POST",
        headers,
        body: JSON.stringify({
          key: "hero",
          value: updated,
        }),
      });

      if (!res.ok) {
        console.error("[useHeroSettings update failed]", await res.text());
      }
    } catch (e) {
      console.error("[useHeroSettings update error]", e);
    }
  };

  return { settings, updateSettings, isLoaded };
}
