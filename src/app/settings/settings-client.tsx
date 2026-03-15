"use client";

import { useState, useEffect } from "react";
import { toast } from "sonner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  buildDefaultConfig,
  type AttributeConfigJson,
} from "@/lib/attributes";
import { DEFAULT_FONT, loadCustomFont } from "@/lib/fonts";
import {
  getAttributeConfig,
  saveAttributeConfig,
  getPresets,
  deletePreset,
  listFonts,
  getPreferences,
  type FontDetail,
} from "@/lib/api";
import { CategoriesTab } from "./categories-tab";
import { PresetsTab, type StylePreset } from "./presets-tab";
import { FontsTab } from "./fonts-tab";

export function SettingsClient() {
  const [config, setConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [fonts, setFonts] = useState<FontDetail[]>([]);
  const [defaultFont, setDefaultFont] = useState(DEFAULT_FONT);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const [configData, presetsData, fontsData, prefs] = await Promise.all([
          getAttributeConfig(),
          getPresets(),
          listFonts(),
          getPreferences(),
        ]);
        setConfig(configData);
        setPresets(presetsData);
        setFonts(fontsData);
        if (prefs.defaultFont) setDefaultFont(prefs.defaultFont);
        for (const f of fontsData) {
          loadCustomFont(f.family, f.url);
        }
      } catch {
        toast.error("Failed to load settings");
      } finally {
        setLoading(false);
      }
    }
    init();
  }, []);

  async function saveConfig(updated: AttributeConfigJson) {
    setConfig(updated);
    try {
      await saveAttributeConfig(updated);
    } catch {
      toast.error("Failed to save");
    }
  }

  async function handleDeletePreset(id: string) {
    try {
      await deletePreset(id);
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
        <PresetsTab presets={presets} onDelete={handleDeletePreset} />
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
