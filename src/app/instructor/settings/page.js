import Link from "next/link";
import { KeyRound, Mail, Palette, ShieldCheck } from "lucide-react";
import {
  InstructorPageHeader,
  InstructorPanel,
} from "@/components/instructor/instructor-components";
import ThemeSwitcher from "@/components/ui/theme-switcher";
import { getInstructorProfile } from "@/lib/instructor/data";

export const metadata = {
  title: "Instructor settings",
  robots: { index: false, follow: false },
};

export default async function InstructorSettingsPage() {
  const { identity } = await getInstructorProfile();
  return (
    <div className="student-page instructor-page">
      <InstructorPageHeader
        eyebrow="Workspace preferences"
        title="Settings"
        description="Manage the available appearance and account-security preferences for your instructor workspace."
      />
      <div className="instructor-settings-grid">
        <InstructorPanel eyebrow="Appearance" title="Color theme">
          <div className="instructor-setting-row">
            <span className="instructor-setting-icon"><Palette size={18} aria-hidden="true" /></span>
            <div><strong>Workspace theme</strong><p>Choose light, dark, or follow your device. Your selection is saved in this browser.</p></div>
          </div>
          <ThemeSwitcher />
        </InstructorPanel>
        <InstructorPanel eyebrow="Account security" title="Sign-in account">
          <div className="instructor-setting-row">
            <span className="instructor-setting-icon"><Mail size={18} aria-hidden="true" /></span>
            <div><strong>{identity.email || "Email is not available"}</strong><p>Email and role changes are controlled by account-security and platform administration workflows.</p></div>
          </div>
          <div className="instructor-setting-links">
            <Link href="/forgot-password"><KeyRound size={16} aria-hidden="true" /> Reset password</Link>
            <Link href="/instructor/profile"><ShieldCheck size={16} aria-hidden="true" /> Manage profile</Link>
          </div>
        </InstructorPanel>
      </div>
    </div>
  );
}
