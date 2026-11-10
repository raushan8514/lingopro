import { AdminSettingForm } from "@/components/admin/admin-forms";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  formatAdminDate,
} from "@/components/admin/admin-components";
import { getAdminSettings } from "@/lib/admin/data";

export const metadata = { title: "Platform settings", robots: { index: false, follow: false } };

export default async function AdminSettingsPage() {
  const settings = await getAdminSettings();
  return (
    <div className="student-page admin-page">
      <AdminPageHeader eyebrow="Configuration" title="Platform settings" description="Manage non-secret settings stored in the existing platform configuration model." />
      <AdminPanel eyebrow="Add or update configuration" title="Setting editor">
        <AdminSettingForm />
      </AdminPanel>
      <AdminPanel eyebrow="Stored settings" title={`${settings.length} settings`}>
        {settings.length ? (
          <div className="admin-settings-list">
            {settings.map((setting) => (
              <details className="admin-setting-item" key={setting.setting_key}>
                <summary>
                  <span><strong>{setting.setting_key}</strong><small>{setting.description || "No description"} · Updated {formatAdminDate(setting.updated_at)}</small></span>
                  <span className={`admin-status is-${setting.is_public ? "success" : "neutral"}`}>{setting.is_public ? "public" : "private"}</span>
                </summary>
                <AdminSettingForm setting={setting} />
              </details>
            ))}
          </div>
        ) : <AdminEmptyState title="No platform settings stored" description="Add a non-secret setting using the configuration editor above." />}
      </AdminPanel>
      <p className="admin-capability-note">The current application has no runtime consumers for arbitrary setting keys. Changes are stored and audited, but do not alter registration, moderation, maintenance, or payment behavior unless a later implementation explicitly reads them. Payment configuration is out of scope.</p>
    </div>
  );
}
