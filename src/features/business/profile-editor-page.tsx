import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { FileCog, Save, Download, Trash2, Plus } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/shared/empty-state";
import { api } from "@/lib/api/client";
import { toast } from "@/lib/store/toast-store";
import type { ProfileTemplate } from "@/lib/db-types";

type PayloadType = "webclip" | "wifi";

export function ProfileEditorPage() {
  const { t } = useTranslation();
  const qc = useQueryClient();

  const [name, setName] = useState("");
  const [type, setType] = useState<PayloadType>("webclip");
  const [label, setLabel] = useState("");
  const [url, setUrl] = useState("");
  const [ssid, setSsid] = useState("");
  const [password, setPassword] = useState("");
  const [hidden, setHidden] = useState(false);

  const { data: templates } = useQuery({
    queryKey: ["profile-templates"],
    queryFn: async () => {
      const res = await api.listProfileTemplates();
      if (!res.success || !res.data) throw new Error(res.error?.message);
      return res.data;
    },
  });

  const reset = () => {
    setName(""); setLabel(""); setUrl(""); setSsid(""); setPassword(""); setHidden(false);
  };

  const save = async () => {
    if (!name.trim()) return;
    const fields =
      type === "wifi"
        ? { ssid, password, hidden }
        : { label, url };
    const tpl: ProfileTemplate = {
      id: "",
      name: name.trim(),
      description: null,
      payload_type: type,
      profile_json: JSON.stringify(fields),
      created_at: "",
      updated_at: "",
    };
    const res = await api.saveProfileTemplate(tpl);
    if (res.success) {
      toast.success(t("businessUi.saved"));
      reset();
      qc.invalidateQueries({ queryKey: ["profile-templates"] });
    } else {
      toast.error(t("toast.error"), res.error?.message);
    }
  };

  const generate = async (id: string) => {
    const dest = await api.selectFolder();
    if (!dest.success || !dest.data) return;
    const res = await api.exportProfileTemplate(id, dest.data);
    if (res.success && res.data) toast.success(t("businessUi.generate"), res.data);
    else toast.error(t("toast.error"), res.error?.message);
  };

  const remove = async (id: string) => {
    const res = await api.deleteProfileTemplate(id);
    if (res.success) qc.invalidateQueries({ queryKey: ["profile-templates"] });
    else toast.error(t("toast.error"), res.error?.message);
  };

  return (
    <>
      <PageHeader
        icon={<FileCog className="h-5 w-5" />}
        title={t("modules.profileEditor.title")}
        description={t("modules.profileEditor.description")}
      />

      <div className="grid gap-4 lg:grid-cols-[380px_1fr]">
        <Card>
          <CardContent className="space-y-3 p-4">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Plus className="h-4 w-4" /> {t("businessUi.newTemplate")}
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="pname">{t("businessUi.templateName")}</Label>
              <Input id="pname" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label>{t("businessUi.payloadType")}</Label>
              <Select value={type} onValueChange={(v) => setType(v as PayloadType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="webclip">{t("businessUi.webclip")}</SelectItem>
                  <SelectItem value="wifi">{t("businessUi.wifi")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {type === "webclip" ? (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="label">{t("businessUi.label")}</Label>
                  <Input id="label" value={label} onChange={(e) => setLabel(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="url">{t("businessUi.url")}</Label>
                  <Input id="url" value={url} onChange={(e) => setUrl(e.target.value)} placeholder="https://" />
                </div>
              </>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="ssid">{t("businessUi.ssid")}</Label>
                  <Input id="ssid" value={ssid} onChange={(e) => setSsid(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="pw">{t("businessUi.password")}</Label>
                  <Input id="pw" type="password" value={password} onChange={(e) => setPassword(e.target.value)} />
                </div>
                <div className="flex items-center justify-between">
                  <Label htmlFor="hidden">{t("businessUi.hidden")}</Label>
                  <Switch id="hidden" checked={hidden} onCheckedChange={setHidden} />
                </div>
              </>
            )}

            <Button className="w-full" onClick={save} disabled={!name.trim()}>
              <Save className="h-4 w-4" /> {t("businessUi.save")}
            </Button>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-0">
            {!templates || templates.length === 0 ? (
              <EmptyState className="border-0" icon={<FileCog className="h-6 w-6" />} title={t("businessUi.noTemplates")} />
            ) : (
              <div className="divide-y divide-border">
                {templates.map((tpl) => (
                  <div key={tpl.id} className="flex items-center gap-3 p-3">
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-medium">{tpl.name}</p>
                      <p className="text-xs capitalize text-muted-foreground">{tpl.payload_type}</p>
                    </div>
                    <Button variant="ghost" size="sm" onClick={() => generate(tpl.id)}>
                      <Download className="h-4 w-4" /> {t("businessUi.generate")}
                    </Button>
                    <Button variant="ghost" size="icon" className="h-8 w-8 text-destructive" onClick={() => remove(tpl.id)}>
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </>
  );
}
