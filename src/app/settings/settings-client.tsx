"use client";

import { useState, useEffect, useCallback } from "react";
import { useSearchParams, useRouter, usePathname } from "next/navigation";
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
  updatePreferences,
  getCredits,
  type FontDetail,
} from "@/lib/api";
import { GeneralTab } from "./general-tab";
import { AttributesTab } from "./attributes-tab";
import { PresetsTab, type StylePreset } from "./presets-tab";
import { FontsTab } from "./fonts-tab";
import { BillingTab } from "./billing-tab";

const VALID_TABS = ["general", "attributes", "presets", "fonts", "billing"];

export function SettingsClient() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const pathname = usePathname();
  const tabParam = searchParams.get("tab");
  const activeTab = tabParam && VALID_TABS.includes(tabParam) ? tabParam : "general";

  const handleTabChange = useCallback((value: string) => {
    const params = new URLSearchParams(searchParams.toString());
    if (value === "general") {
      params.delete("tab");
    } else {
      params.set("tab", value);
    }
    const query = params.toString();
    router.replace(query ? `${pathname}?${query}` : pathname, { scroll: false });
  }, [searchParams, router, pathname]);

  const [config, setConfig] = useState<AttributeConfigJson>(
    buildDefaultConfig()
  );
  const [presets, setPresets] = useState<StylePreset[]>([]);
  const [fonts, setFonts] = useState<FontDetail[]>([]);
  const [defaultFont, setDefaultFont] = useState(DEFAULT_FONT);
  const [showPrompt, setShowPrompt] = useState(false);
  const [subscriptionStatus, setSubscriptionStatus] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function init() {
      try {
        const [configData, presetsData, fontsData, prefs, creditsData] = await Promise.all([
          getAttributeConfig(),
          getPresets(),
          listFonts(),
          getPreferences(),
          getCredits(),
        ]);
        setConfig(configData);
        setPresets(presetsData);
        setFonts(fontsData);
        if (prefs.defaultFont) setDefaultFont(prefs.defaultFont);
        if (prefs.showPrompt != null) setShowPrompt(prefs.showPrompt);
        if (creditsData.subscriptionStatus) setSubscriptionStatus(creditsData.subscriptionStatus);
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

  async function handleShowPromptChange(checked: boolean) {
    setShowPrompt(checked);
    try {
      await updatePreferences({ showPrompt: checked });
    } catch {
      setShowPrompt(!checked);
      toast.error("Failed to save preference");
    }
  }

  return (
    <Tabs value={activeTab} onValueChange={handleTabChange}>
      <TabsList className="mb-6">
        <TabsTrigger value="general">General</TabsTrigger>
        <TabsTrigger value="attributes">Attributes</TabsTrigger>
        <TabsTrigger value="presets">Style Presets</TabsTrigger>
        <TabsTrigger value="fonts">Fonts</TabsTrigger>
        <TabsTrigger value="billing">Billing</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <GeneralTab
          showPrompt={showPrompt}
          onShowPromptChange={handleShowPromptChange}
          subscriptionStatus={subscriptionStatus}
        />
      </TabsContent>

      <TabsContent value="attributes">
        <AttributesTab config={config} onSave={saveConfig} />
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

      <TabsContent value="billing">
        <BillingTab />
      </TabsContent>
    </Tabs>
  );
}
