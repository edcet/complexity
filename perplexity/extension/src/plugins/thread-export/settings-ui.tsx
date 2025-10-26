import type { PluginId } from "@/__registries__/plugins/meta.types";
import { Image } from "@/components/ui/image";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import useExtensionSettings from "@/services/infra/extension-api-wrappers/extension-settings/useExtensionSettings";
import { EXPORT_TEMPLATES } from "./export-options";
import { useState } from "react";
import TablerStar from "~icons/tabler/star";
import TablerStarFilled from "~icons/tabler/star-filled";

export const pluginId: PluginId = "thread:exportThread";

interface TemplatePreferences {
  starredTemplates: string[];
  vendorFilter: string;
  groupByVendor: boolean;
  recentExports: Array<{
    templateId: string;
    date: string;
    title: string;
  }>;
}

export default function ExportThreadPluginSettingsUi() {
  const { settings, mutation } = useExtensionSettings();
  const pluginSettings = settings?.plugins["thread:exportThread"];
  
  const [templatePrefs, setTemplatePrefs] = useState<TemplatePreferences>({
    starredTemplates: [],
    vendorFilter: "all",
    groupByVendor: true,
    recentExports: [],
  });

  if (!settings) return null;

  const toggleStarTemplate = (templateId: string) => {
    setTemplatePrefs((prev) => ({
      ...prev,
      starredTemplates: prev.starredTemplates.includes(templateId)
        ? prev.starredTemplates.filter((id) => id !== templateId)
        : [...prev.starredTemplates, templateId],
    }));
  };

  const replayExport = (exportItem: TemplatePreferences["recentExports"][0]) => {
    // Replay functionality - could trigger re-export with same template
    console.log("Replaying export:", exportItem);
  };

  return (
    <div className="x:flex x:max-w-3xl x:flex-col x:gap-6">
      {/* Enable/Disable Switch */}
      <Switch
        textLabel="Enable"
        checked={pluginSettings?.enabled ?? false}
        onCheckedChange={({ checked }) => {
          mutation.mutate((draft) => {
            draft.plugins["thread:exportThread"].enabled = checked;
          });
        }}
      />

      {/* Export Templates Configuration */}
      <div className="x:flex x:flex-col x:gap-4">
        <h3 className="x:text-lg x:font-semibold">Export Templates</h3>
        <p className="x:text-sm x:text-muted-foreground">
          Star your favorite templates to show them first in the export menu.
        </p>

        <div className="x:grid x:gap-3">
          {Object.entries(EXPORT_TEMPLATES).map(([id, template]) => {
            const isStarred = templatePrefs.starredTemplates.includes(id);
            return (
              <div
                key={id}
                className="x:flex x:items-center x:justify-between x:rounded-lg x:border x:p-3"
              >
                <div className="x:flex x:flex-col x:gap-1">
                  <div className="x:font-medium">{template.name}</div>
                  {template.tags && (
                    <div className="x:flex x:gap-2">
                      {template.tags.map((tag) => (
                        <span
                          key={tag}
                          className="x:rounded x:bg-secondary x:px-2 x:py-0.5 x:text-xs"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => toggleStarTemplate(id)}
                  className="x:h-8 x:w-8 x:p-0"
                >
                  {isStarred ? (
                    <TablerStarFilled className="x:size-4 x:text-yellow-500" />
                  ) : (
                    <TablerStar className="x:size-4" />
                  )}
                </Button>
              </div>
            );
          })}
        </div>
      </div>

      {/* Export Grouping Options */}
      <div className="x:flex x:flex-col x:gap-4">
        <h3 className="x:text-lg x:font-semibold">Export Organization</h3>
        
        <Checkbox
          label="Group exports by vendor/tag"
          checked={templatePrefs.groupByVendor}
          onCheckedChange={({ checked }) => {
            setTemplatePrefs((prev) => ({
              ...prev,
              groupByVendor: checked as boolean,
            }));
          }}
        />
        
        <div className="x:flex x:flex-col x:gap-2">
          <label className="x:text-sm x:font-medium">Vendor Filter</label>
          <select
            value={templatePrefs.vendorFilter}
            onChange={(e) =>
              setTemplatePrefs((prev) => ({
                ...prev,
                vendorFilter: e.target.value,
              }))
            }
            className="x:rounded x:border x:px-3 x:py-2"
          >
            <option value="all">All Vendors</option>
            <option value="mikrotik">MikroTik</option>
            <option value="cisco">Cisco</option>
            <option value="ubiquiti">Ubiquiti</option>
            <option value="pfsense">pfSense</option>
          </select>
        </div>
      </div>

      {/* Recent Exports / Replay */}
      <div className="x:flex x:flex-col x:gap-4">
        <h3 className="x:text-lg x:font-semibold">Recent Exports</h3>
        <p className="x:text-sm x:text-muted-foreground">
          Quickly replay previous exports with the same template and settings.
        </p>
        
        {templatePrefs.recentExports.length === 0 ? (
          <div className="x:rounded x:border x:border-dashed x:p-4 x:text-center x:text-sm x:text-muted-foreground">
            No recent exports yet. Export a thread to see it here.
          </div>
        ) : (
          <div className="x:grid x:gap-2">
            {templatePrefs.recentExports.map((exportItem, idx) => (
              <div
                key={idx}
                className="x:flex x:items-center x:justify-between x:rounded x:border x:p-3"
              >
                <div className="x:flex x:flex-col">
                  <div className="x:text-sm x:font-medium">{exportItem.title}</div>
                  <div className="x:text-xs x:text-muted-foreground">
                    {EXPORT_TEMPLATES[exportItem.templateId]?.name} • {exportItem.date}
                  </div>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => replayExport(exportItem)}
                >
                  Replay
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Image */}
      <div className="x:mx-auto x:w-full x:max-w-[700px]">
        <Image
          src="https://i.imgur.com/Enn83Eg.png"
          alt="export-thread"
          className="x:w-full"
        />
      </div>
    </div>
  );
}
