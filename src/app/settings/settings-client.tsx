"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildDefaultConfig,
  type AttributeConfigJson,
} from "@/lib/attributes";
import { loadCustomFont } from "@/lib/fonts";
import { CategoriesTab } from "./categories-tab";
import { PresetsTab, type StylePreset } from "./presets-tab";
import { FontsTab, type UserFontSettings } from "./fonts-tab";

export function SettingsClient() {
  const [config, setConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [fonts, setFonts] = useState<UserFontSettings[]>([]);
  const [defaultFont, setDefaultFont] = useState("Playfair Display");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      fetch("/api/attributes").then((r) => r.json()),
      fetch("/api/presets").then((r) => r.json()),
      fetch("/api/fonts").then((r) => r.json()),
      fetch("/api/user/preferences").then((r) => r.json()),
    ])
      .then(([configData, presetsData, fontsData, prefs]) => {
        setConfig(configData);
        setPresets(presetsData);
        setFonts(fontsData);
        if (prefs.defaultFont) setDefaultFont(prefs.defaultFont);
        // Load custom fonts for preview
        for (const f of fontsData as UserFontSettings[]) {
          loadCustomFont(f.family, f.url);
        }
      })
      .catch(() => toast.error("Failed to load settings"))
      .finally(() => setLoading(false));
  }, []);

  async function saveConfig(updated: AttributeConfigJson) {
    setConfig(updated);
    try {
      await fetch("/api/attributes", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updated),
      });
    } catch {
      toast.error("Failed to save");
    }
  }

  async function deletePreset(id: string) {
    try {
      await fetch(`/api/presets/${id}`, { method: "DELETE" });
      setPresets((prev) => prev.filter((p) => p.id !== id));
      toast.success("Preset deleted");
    } catch {
      toast.error("Failed to delete preset");
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-muted-foreground">
        Loading...
      </div>
    );
  }

  return (
    <Tabs defaultValue="categories">
      <TabsList className="mb-6">
        <TabsTrigger value="categories">Attribute Categories</TabsTrigger>
        <TabsTrigger value="presets">Style Presets</TabsTrigger>
        <TabsTrigger value="fonts">Fonts</TabsTrigger>
      </TabsList>

      <TabsContent value="categories">
        <CategoriesTab config={config} onSave={saveConfig} />
      </TabsContent>

      <TabsContent value="presets">
        <PresetsTab presets={presets} onDelete={deletePreset} />
      </TabsContent>

      <TabsContent value="fonts">
        <FontsTab
          fonts={fonts}
          setFonts={setFonts}
          defaultFont={defaultFont}
          setDefaultFont={setDefaultFont}
        />
      </TabsContent>
    </Tabs>
  );
}
