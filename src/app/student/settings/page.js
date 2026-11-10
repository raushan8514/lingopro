import Link from "next/link";
import { Bell, Languages, Moon, ShieldCheck } from "lucide-react";
import {
  StudentLearningGoalsForm,
  StudentNotificationPreferencesForm,
} from "@/components/student/student-forms";
import { StudentPageHeader } from "@/components/student/student-components";
import {
  getStudentNotificationPreferences,
  getStudentSettingsPageData,
} from "@/lib/student/data";
import ThemeSwitcher from "@/components/ui/theme-switcher";

export const metadata = {
  title: "Student settings",
  robots: { index: false, follow: false },
};

export default async function StudentSettingsPage() {
  const [{ identity, profile, goals }, notificationPreferences] = await Promise.all([
    getStudentSettingsPageData(),
    getStudentNotificationPreferences(),
  ]);

  return (
    <div className="student-page">
      <StudentPageHeader
        eyebrow="Your preferences"
        title="Settings"
        description="Choose how your learning workspace looks and set personal learning preferences."
      />

      <section className="student-panel">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Appearance</p>
            <h2>Color theme</h2>
          </div>
          <Moon size={20} aria-hidden="true" />
        </header>
        <p className="student-settings-description">
          Your choice is saved on this device. System mode follows your operating-system preference.
        </p>
        <ThemeSwitcher className="student-settings-theme" />
      </section>

      <section className="student-panel">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Learning preferences</p>
            <h2>Goals, language, and timezone</h2>
          </div>
          <Languages size={20} aria-hidden="true" />
        </header>
        <p className="student-settings-description">
          These values personalize your goal calculations and profile. They do not alter your role or permissions.
        </p>
        <StudentLearningGoalsForm goals={goals} />
      </section>

      <section className="student-panel">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Account safeguards</p>
            <h2>Account information</h2>
          </div>
          <ShieldCheck size={20} aria-hidden="true" />
        </header>
        <dl className="student-account-details">
          <div>
            <dt>Profile name</dt>
            <dd>{profile.full_name}</dd>
          </div>
          <div>
            <dt>Sign-in email</dt>
            <dd>{identity.email || "Email is not available"}</dd>
          </div>
          <div>
            <dt>Role</dt>
            <dd>Student</dd>
          </div>
        </dl>
        <Link className="student-inline-link" href="/student/profile">
          Edit profile <span aria-hidden="true">→</span>
        </Link>
      </section>

      <section className="student-panel student-settings-notifications">
        <header className="student-panel-heading">
          <div>
            <p className="student-eyebrow">Delivery preferences</p>
            <h2>Notifications</h2>
          </div>
          <Bell size={20} aria-hidden="true" />
        </header>
        <p className="student-settings-description">
          Control which workflow updates appear in your{" "}
          <Link href="/student/notifications">notification center</Link>.
        </p>
        <StudentNotificationPreferencesForm preferences={notificationPreferences} />
      </section>
    </div>
  );
}
